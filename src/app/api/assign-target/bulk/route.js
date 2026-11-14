import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  sqlActiveTargetEligibleEmployees,
  TARGET_ELIGIBLE_EMPLOYEE_ROLE_PARAMS,
} from "@/lib/targetEligibleEmployeesSql";

const ASSIGN_ROLES = new Set(["SUPERADMIN", "ADMIN"]);

function normalizeYmd(value) {
  if (!value) return null;
  const s = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseTargetAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function assertCanAssign(payload) {
  if (!payload?.username) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  const role = String(payload.role || payload.userRole || "")
    .trim()
    .toUpperCase();
  if (!ASSIGN_ROLES.has(role)) {
    return { ok: false, status: 403, message: "Access denied" };
  }
  return { ok: true, createdBy: payload.username };
}

/** Latest overlapping target per username for a date range (inclusive). */
async function fetchTargetsForRange(conn, startYmd, endYmd) {
  const [rows] = await conn.execute(
    `SELECT t.id, t.username, t.target, t.target_start_date, t.target_end_date
     FROM target t
     INNER JOIN (
       SELECT username, MAX(id) AS max_id
       FROM target
       WHERE target_start_date <= ?
         AND target_end_date >= ?
       GROUP BY username
     ) latest
       ON t.id = latest.max_id`,
    [endYmd, startYmd],
  );
  const byUser = new Map();
  for (const row of rows || []) {
    const u = String(row.username || "").trim();
    if (!u) continue;
    byUser.set(u, row);
  }
  return byUser;
}

async function fetchActiveEmployees(conn) {
  const sql = `
    SELECT username
    FROM rep_list rl
    WHERE ${sqlActiveTargetEligibleEmployees("rl")}
    ORDER BY username ASC
  `;
  const [rows] = await conn.execute(sql, TARGET_ELIGIBLE_EMPLOYEE_ROLE_PARAMS);
  return (rows || []).map((r) => String(r.username || "").trim()).filter(Boolean);
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    const auth = await assertCanAssign(payload);
    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const params = new URL(request.url).searchParams;
    const legacyDate = normalizeYmd(params.get("date"));
    const startYmd =
      normalizeYmd(params.get("startDate")) ||
      normalizeYmd(params.get("target_start_date")) ||
      legacyDate;
    const endYmd =
      normalizeYmd(params.get("endDate")) ||
      normalizeYmd(params.get("target_end_date")) ||
      legacyDate ||
      startYmd;

    if (!startYmd || !endYmd) {
      return NextResponse.json(
        { message: "Valid start and end dates (YYYY-MM-DD) are required." },
        { status: 400 },
      );
    }

    const rangeStart = startYmd <= endYmd ? startYmd : endYmd;
    const rangeEnd = startYmd <= endYmd ? endYmd : startYmd;

    const conn = await getDbConnection();
    const [employees, targetByUser] = await Promise.all([
      fetchActiveEmployees(conn),
      fetchTargetsForRange(conn, rangeStart, rangeEnd),
    ]);

    const rows = employees.map((username) => {
      const hit = targetByUser.get(username);
      return {
        username,
        id: hit?.id ?? null,
        target: hit?.target != null && hit.target !== "" ? String(hit.target) : "",
        target_start_date: hit?.target_start_date ?? null,
        target_end_date: hit?.target_end_date ?? null,
      };
    });

    return NextResponse.json(
      {
        target_start_date: rangeStart,
        target_end_date: rangeEnd,
        employees: rows,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("assign-target bulk GET:", error);
    return NextResponse.json(
      { message: "Failed to load bulk targets.", error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    const auth = await assertCanAssign(payload);
    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const body = await request.json();
    const legacyDate = normalizeYmd(body?.date);
    const startRaw =
      normalizeYmd(body?.target_start_date) ||
      normalizeYmd(body?.startDate) ||
      legacyDate;
    const endRaw =
      normalizeYmd(body?.target_end_date) ||
      normalizeYmd(body?.endDate) ||
      legacyDate ||
      startRaw;
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (!startRaw || !endRaw) {
      return NextResponse.json(
        { message: "Valid start and end dates (YYYY-MM-DD) are required." },
        { status: 400 },
      );
    }

    const startYmd = startRaw <= endRaw ? startRaw : endRaw;
    const endYmd = startRaw <= endRaw ? endRaw : startRaw;

    if (!rows.length) {
      return NextResponse.json(
        { message: "No employee rows to save." },
        { status: 400 },
      );
    }

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      const activeSet = new Set(await fetchActiveEmployees(conn));
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    await conn.beginTransaction();

    for (const row of rows) {
      const username = String(row?.username || "").trim();
      if (!username || !activeSet.has(username)) {
        skipped += 1;
        continue;
      }

      const amount = parseTargetAmount(row?.target);
      if (amount == null) {
        skipped += 1;
        continue;
      }

      const rowId = row?.id != null ? Number(row.id) : null;

      if (rowId && Number.isFinite(rowId)) {
        const [own] = await conn.execute(
          `SELECT id, username FROM target WHERE id = ? LIMIT 1`,
          [rowId],
        );
        if (own?.[0] && String(own[0].username).trim() === username) {
          await conn.execute(
            `UPDATE target
             SET target = ?, updated_at = NOW()
             WHERE id = ?`,
            [amount, rowId],
          );
          updated += 1;
          continue;
        }
      }

      const [exact] = await conn.execute(
        `SELECT id FROM target
         WHERE username = ?
           AND target_start_date = ?
           AND target_end_date = ?
         LIMIT 1`,
        [username, startYmd, endYmd],
      );

      if (exact?.length) {
        await conn.execute(
          `UPDATE target
           SET target = ?, updated_at = NOW()
           WHERE id = ?`,
          [amount, exact[0].id],
        );
        updated += 1;
        continue;
      }

      const [overlap] = await conn.execute(
        `SELECT id FROM target
         WHERE username = ?
           AND target_start_date <= ?
           AND target_end_date >= ?
         ORDER BY id DESC
         LIMIT 1`,
        [username, endYmd, startYmd],
      );

      if (overlap?.length) {
        await conn.execute(
          `UPDATE target
           SET target = ?,
               target_start_date = ?,
               target_end_date = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [amount, startYmd, endYmd, overlap[0].id],
        );
        updated += 1;
        continue;
      }

      await conn.execute(
        `INSERT INTO target
          (username, target, target_start_date, target_end_date, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [username, amount, startYmd, endYmd, auth.createdBy],
      );
      inserted += 1;
    }

    await conn.commit();

    return NextResponse.json(
      {
        message: "Targets saved successfully.",
        inserted,
        updated,
        skipped,
        target_start_date: startYmd,
        target_end_date: endYmd,
      },
      { status: 200 },
    );
    } catch (error) {
      try {
        await conn.rollback();
      } catch (_) {
        /* ignore */
      }
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("assign-target bulk POST:", error);
    return NextResponse.json(
      { message: "Failed to save targets.", error: error.message },
      { status: 500 },
    );
  }
}