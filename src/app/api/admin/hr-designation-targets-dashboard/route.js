import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import {
  buildItemsForHrUsername,
  computeCompletedForDesignation,
} from "@/lib/hrTargetMonthlyCompleted";

function assertSuperadmin(payload) {
  if (!payload?.username) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const roleKey = normalizeRoleKey(payload.role ?? payload.userRole);
  if (roleKey !== "SUPERADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function hasHrUsernameColumn(conn) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM hr_designation_monthly_targets LIKE 'hr_username'`);
  return rows.length > 0;
}

function periodLabels(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const fmt = (d) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return { start_date: fmt(start), end_date: fmt(end) };
}

async function loadDisplayByLower(conn, canonicalUsernames) {
  const byLower = {};
  for (const u of canonicalUsernames) {
    const c = String(u || "").trim();
    if (c) byLower[c.toLowerCase()] = c;
  }
  const lower = Object.keys(byLower);
  if (!lower.length) return byLower;

  const ph = lower.map(() => "?").join(", ");
  const [rows] = await conn.execute(
    `SELECT rl.username,
            COALESCE(NULLIF(TRIM(ep.full_name), ''), rl.username) AS display_name
     FROM rep_list rl
     LEFT JOIN employee_profiles ep ON LOWER(TRIM(ep.username)) = LOWER(TRIM(rl.username))
     WHERE LOWER(TRIM(rl.username)) IN (${ph})`,
    lower
  );
  for (const r of rows || []) {
    const u = String(r.username || "").trim();
    const label = String(r.display_name || r.username || "").trim() || u;
    byLower[u.toLowerCase()] = label;
  }
  return byLower;
}

/**
 * GET ?month=&year=
 * Chart: per-HR totals (target vs achieved) for the month.
 * Rows: each assignment with achieved for that designation.
 */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const now = new Date();
    let month = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);
    let year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
    if (Number.isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
    if (Number.isNaN(year) || year < 2000 || year > 2100) year = now.getFullYear();

    const conn = await getDbConnection();
    const withUser = await hasHrUsernameColumn(conn);
    const { start_date, end_date } = periodLabels(year, month);

    if (!withUser) {
      return NextResponse.json({
        success: true,
        hasHrUsernameColumn: false,
        month,
        year,
        chart: [],
        rows: [],
        period: { start_date, end_date },
      });
    }

    const [targetsRows] = await conn.execute(
      `SELECT id, designation, hr_username, target_amount, month, year, created_at, updated_at
       FROM hr_designation_monthly_targets
       WHERE year = ? AND month = ?
       ORDER BY hr_username ASC, designation ASC`,
      [year, month]
    );

    const rows = targetsRows || [];
    const hrKeys = new Map();
    for (const row of rows) {
      const hu = String(row.hr_username || "").trim();
      if (!hu) continue;
      const k = hu.toLowerCase();
      if (!hrKeys.has(k)) hrKeys.set(k, hu);
    }

    const displayByLower = await loadDisplayByLower(conn, [...hrKeys.values()]);

    const chart = [];
    for (const canonicalUn of hrKeys.values()) {
      const items = await buildItemsForHrUsername(conn, canonicalUn, year, month);
      const target_total = items.reduce((s, i) => s + (Number(i.target) || 0), 0);
      const achieved_total = items.reduce((s, i) => s + (Number(i.completed) || 0), 0);
      const label =
        displayByLower[canonicalUn.toLowerCase()] || canonicalUn;
      chart.push({
        hr_username: canonicalUn,
        display_label: label,
        chart_name: label.length > 22 ? `${label.slice(0, 20)}…` : label,
        target_total,
        achieved_total,
      });
    }

    chart.sort((a, b) => String(a.display_label).localeCompare(String(b.display_label)));

    const listRows = [];
    for (const row of rows) {
      const hu = String(row.hr_username || "").trim();
      let achieved = 0;
      if (hu) {
        achieved = await computeCompletedForDesignation(conn, hu, year, month, row.designation);
      }
      listRows.push({
        id: row.id,
        designation: row.designation,
        hr_username: hu || "—",
        target_amount: row.target_amount != null ? Number(row.target_amount) : 0,
        month: row.month,
        year: row.year,
        achieved,
        start_date,
        end_date,
        assigned_by: payload.username || "—",
      });
    }

    return NextResponse.json({
      success: true,
      hasHrUsernameColumn: true,
      month,
      year,
      chart,
      rows: listRows,
      period: { start_date, end_date },
    });
  } catch (error) {
    console.error("[admin/hr-designation-targets-dashboard]", error);
    const msg = error?.message || "";
    if (msg.includes("hr_designation_monthly_targets") || msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Targets table missing. Run migration: admin-dashboard/hr-designation-targets/migration_hr_designation_monthly_targets.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
