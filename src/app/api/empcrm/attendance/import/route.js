import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { parseImportDateToYmd } from "@/lib/attendanceImportParse";

/**
 * Match rep_list.username, then employee_profiles.full_name (exact, case-insensitive).
 */
async function resolveEmployeeUsername(conn, raw) {
  const q = raw != null ? String(raw).trim() : "";
  if (!q) return { ok: false, message: "username is required." };

  const [exact] = await conn.execute(
    `SELECT username FROM rep_list WHERE status = 1 AND username = ? LIMIT 1`,
    [q]
  );
  if (exact.length) return { ok: true, username: exact[0].username };

  const [exactLower] = await conn.execute(
    `SELECT username FROM rep_list WHERE status = 1 AND LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 1`,
    [q]
  );
  if (exactLower.length) return { ok: true, username: exactLower[0].username };

  try {
    const [byName] = await conn.execute(
      `SELECT r.username FROM rep_list r
       INNER JOIN employee_profiles ep ON LOWER(TRIM(ep.username)) = LOWER(TRIM(r.username))
       WHERE r.status = 1 AND LOWER(TRIM(COALESCE(ep.full_name, ''))) = LOWER(TRIM(?))
       LIMIT 3`,
      [q]
    );
    if (byName.length === 1) return { ok: true, username: byName[0].username };
    if (byName.length > 1) {
      return {
        ok: false,
        message: `Multiple employees match this name — use login username: ${byName.map((r) => r.username).join(", ")}`,
      };
    }
  } catch {
    /* employee_profiles missing */
  }

  return { ok: false, message: `Unknown or inactive employee: ${q}` };
}

const HR_ATTENDANCE_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

const TIME_FIELDS = [
  "checkin_time",
  "checkout_time",
  "break_morning_start",
  "break_morning_end",
  "break_lunch_start",
  "break_lunch_end",
  "break_evening_start",
  "break_evening_end",
];

function isHrRole(role) {
  return role != null && HR_ATTENDANCE_ROLES.includes(String(role));
}

function normalizeMysqlDatetime(s) {
  if (s == null || String(s).trim() === "") return null;
  const t = String(s).trim();
  const m = t.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return null;
  const hh = String(parseInt(m[4], 10)).padStart(2, "0");
  const mm = String(parseInt(m[5], 10)).padStart(2, "0");
  const ss = m[6] != null ? String(parseInt(m[6], 10)).padStart(2, "0") : "00";
  return `${m[1]}-${m[2]}-${m[3]} ${hh}:${mm}:${ss}`;
}

function combineDateAndTimeForDb(dateYmd, timeVal) {
  if (!dateYmd || timeVal == null || String(timeVal).trim() === "") return null;
  const t = String(timeVal).trim();
  const full = normalizeMysqlDatetime(t);
  if (full) return full;
  const hm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!hm) return null;
  const hh = String(parseInt(hm[1], 10)).padStart(2, "0");
  const mm = String(parseInt(hm[2], 10)).padStart(2, "0");
  const ss = hm[3] != null ? String(parseInt(hm[3], 10)).padStart(2, "0") : "00";
  return normalizeMysqlDatetime(`${dateYmd} ${hh}:${mm}:${ss}`);
}

/**
 * POST — bulk insert attendance_logs from parsed rows (HR).
 * Rows for (username, date) that already have a log are skipped (not updated).
 * Body: { rows: Array<{ username, date, checkin_time?, checkout_time?, breaks..., checkin_address?, checkout_address? }> }
 * Time values: "HH:mm" or "HH:mm:ss" or "YYYY-MM-DD HH:mm:ss" (IST wall clock).
 */
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (!isHrRole(payload.role)) {
      return NextResponse.json(
        { message: "Only HR / SUPERADMIN can import attendance." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rowsIn = Array.isArray(body.rows) ? body.rows : [];
    if (rowsIn.length === 0) {
      return NextResponse.json(
        { message: "No rows to import.", errors: [] },
        { status: 400 }
      );
    }
    if (rowsIn.length > 2000) {
      return NextResponse.json(
        { message: "Maximum 2000 rows per request." },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rowsIn.length; i++) {
      const raw = rowsIn[i] || {};
      const rowNum = i + 2;
      const usernameRaw =
        raw.username != null ? String(raw.username).trim() : "";
      const dateStr = parseImportDateToYmd(
        raw.date != null ? String(raw.date).trim() : ""
      );

      if (!usernameRaw) {
        errors.push({ row: rowNum, message: "username is required." });
        continue;
      }
      if (!dateStr) {
        errors.push({
          row: rowNum,
          message: "date is invalid (use YYYY-MM-DD or DD/MM/YYYY).",
        });
        continue;
      }

      let username;
      try {
        const resolved = await resolveEmployeeUsername(conn, usernameRaw);
        if (!resolved.ok) {
          errors.push({ row: rowNum, message: resolved.message });
          continue;
        }
        username = resolved.username;
      } catch (e) {
        errors.push({ row: rowNum, message: e.message || "User lookup failed" });
        continue;
      }

      const times = {};
      let timeParseError = null;
      for (const col of TIME_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(raw, col)) {
          times[col] = undefined;
          continue;
        }
        const v = raw[col];
        if (v == null || String(v).trim() === "") {
          times[col] = null;
          continue;
        }
        const normalized = combineDateAndTimeForDb(dateStr, v);
        if (!normalized) {
          timeParseError = `Invalid time for ${col}: ${v}`;
          break;
        }
        times[col] = normalized;
      }
      if (timeParseError) {
        errors.push({ row: rowNum, message: timeParseError });
        continue;
      }

      const hasAnyTime = TIME_FIELDS.some((col) => times[col] != null);
      if (!hasAnyTime) {
        errors.push({
          row: rowNum,
          message: "Provide at least one time field to import.",
        });
        continue;
      }

      const checkinAddr =
        raw.checkin_address != null && String(raw.checkin_address).trim() !== ""
          ? String(raw.checkin_address).trim()
          : null;
      const checkoutAddr =
        raw.checkout_address != null &&
        String(raw.checkout_address).trim() !== ""
          ? String(raw.checkout_address).trim()
          : null;

      try {
        const [existingRows] = await conn.execute(
          `SELECT * FROM attendance_logs WHERE username = ? AND date = ? LIMIT 1`,
          [username, dateStr]
        );
        const ex = existingRows[0] || null;

        if (ex) {
          skipped++;
          continue;
        }

        const cin = times.checkin_time ?? null;
        const cout = times.checkout_time ?? null;
        const bms = times.break_morning_start ?? null;
        const bme = times.break_morning_end ?? null;
        const bls = times.break_lunch_start ?? null;
        const ble = times.break_lunch_end ?? null;
        const bes = times.break_evening_start ?? null;
        const bee = times.break_evening_end ?? null;

        const cinLat = cin != null ? 0 : null;
        const cinLon = cin != null ? 0 : null;
        const cinA = cin != null ? checkinAddr || "HR bulk import" : null;
        const coutLat = cout != null ? 0 : null;
        const coutLon = cout != null ? 0 : null;
        const coutA = cout != null ? checkoutAddr || "HR bulk import" : null;

        await conn.execute(
          `INSERT INTO attendance_logs (
              username, date,
              checkin_time, checkout_time,
              break_morning_start, break_morning_end,
              break_lunch_start, break_lunch_end,
              break_evening_start, break_evening_end,
              checkin_latitude, checkin_longitude, checkin_address,
              checkout_latitude, checkout_longitude, checkout_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            username,
            dateStr,
            cin,
            cout,
            bms,
            bme,
            bls,
            ble,
            bes,
            bee,
            cinLat,
            cinLon,
            cinA,
            coutLat,
            coutLon,
            coutA,
          ]
        );
        inserted++;
      } catch (err) {
        errors.push({
          row: rowNum,
          message: err.message || "Database error",
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      inserted,
      skipped,
      failed: errors.length,
      errors,
    });
  } catch (err) {
    console.error("empcrm attendance import POST:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
