// app/api/empcrm/attendance/fetch/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { applyAutomaticCheckouts } from "@/lib/attendanceAutoCheckout";
import { ensureAttendanceAutoCheckoutApprovalsTable } from "@/lib/ensureAttendanceAutoCheckoutApprovalsTable";
import {
  loadMachineCodeMaps,
  loadMachineDailyByUsername,
  mergeAttendanceListWithMachine,
} from "@/lib/attendanceMachineMerge";
import {
  applyCanonicalUsernameToRow,
  normalizeUsernameKey,
} from "@/lib/attendanceCanonicalUsername";

export const dynamic = 'force-dynamic';

async function usernamesForSameEmployee(conn, loginUsername) {
  const [rows] = await conn.query(
    `SELECT r2.username
     FROM rep_list r1
     INNER JOIN rep_list r2
       ON r1.empId = r2.empId
      AND r2.status = 1
     WHERE r1.username = ?
       AND r1.status = 1
       AND r1.empId IS NOT NULL`,
    [loginUsername]
  );
  const set = new Set([String(loginUsername || "").trim()]);
  for (const r of rows || []) {
    const u = String(r.username || "").trim();
    if (u) set.add(u);
  }
  return [...set];
}

export async function GET(request) {
  try {
    let username = "Unknown";
    const payload = await getSessionPayload();
    if (!payload) {
      console.log("Error: No session payload found. Unauthorized access attempt.");
      return NextResponse.json(
        { message: "Unauthorized access." },
        { status: 401 }
      );
    }
    username = payload.username;

    const db = await getDbConnection();
    await applyAutomaticCheckouts(db, { username });
    await ensureAttendanceAutoCheckoutApprovalsTable(db);

    const { machineCodeToUsername, canonicalMaps, resolveCanonicalUsername: resolveCanon } =
      await loadMachineCodeMaps(db);
    const canonicalLogin = resolveCanon(username, canonicalMaps);
    const loginAliases = await usernamesForSameEmployee(db, username);
    const placeholders = loginAliases.map(() => "?").join(", ");

    const [rows] = await db.query(
      `SELECT
        a.username,
        a.date,
        COALESCE(a.employee_id, r.empId) AS employee_id,
        COALESCE(NULLIF(TRIM(a.machine_code), ''), NULLIF(TRIM(r.machine_code), '')) AS machine_code,
        a.checkin_time,
        a.checkout_time,
        a.checkin_address,
        a.checkout_address,
        a.checkin_latitude,
        a.checkin_longitude,
        a.checkout_latitude,
        a.checkout_longitude,
        a.break_morning_start,
        a.break_morning_end,
        a.break_lunch_start,
        a.break_lunch_end,
        a.break_evening_start,
        a.break_evening_end,
        a.checkin_photo,
        ap.status AS auto_checkout_approval_status
      FROM attendance_logs a
      LEFT JOIN rep_list r
        ON r.username COLLATE utf8mb4_unicode_ci = a.username COLLATE utf8mb4_unicode_ci
       AND r.status = 1
      LEFT JOIN attendance_auto_checkout_approvals ap
        ON ap.username = a.username AND ap.log_date = a.date
      WHERE a.username IN (${placeholders})
      ORDER BY a.date DESC`,
      loginAliases
    );

    for (const row of rows) {
      applyCanonicalUsernameToRow(row, canonicalMaps);
    }

    const machineByUserDate = await loadMachineDailyByUsername(
      db,
      machineCodeToUsername,
    );
    let mergedRows = mergeAttendanceListWithMachine(rows, machineByUserDate);
    const byKey = new Map();
    for (const row of mergedRows) {
      const dk =
        row.date && String(row.date).slice(0, 10)
          ? String(row.date).slice(0, 10)
          : row.date;
      const key = `${normalizeUsernameKey(row.username)}|${dk}`;
      if (!byKey.has(key)) byKey.set(key, row);
    }
    mergedRows = [...byKey.values()];

    const [holidays] = await db.query(
      `SELECT holiday_date, title, description
       FROM holidays
       ORDER BY holiday_date DESC`
    );

    const leaveUsers = [...new Set([...loginAliases, canonicalLogin])];
    const leavePlaceholders = leaveUsers.map(() => "?").join(", ");
    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason, is_half_day, half_day_type, start_time, end_time
       FROM employee_leaves
       WHERE username IN (${leavePlaceholders})
       AND status = 'approved'
       ORDER BY from_date DESC`,
      leaveUsers
    );

    return NextResponse.json({
      username: canonicalLogin,
      attendance: mergedRows,
      holidays,
      leaves: leaves.map((leave) => ({
        ...leave,
        username: resolveCanon(leave.username, canonicalMaps),
      })),
    });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}