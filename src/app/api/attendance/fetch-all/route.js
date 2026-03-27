import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  rowToAttendanceRulesShape,
  mergeGlobalRulesWithEmployeeSchedule,
} from "@/lib/attendanceRulesDb";

function normalizeUserKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function GET() {
  try {
    const db = await getDbConnection();

    const [rows] = await db.query(
      `SELECT
      a.date,
      a.username,
      a.checkin_time,
      a.checkout_time,
      a.break_morning_start,
      a.break_morning_end,
      a.break_lunch_start,
      a.break_lunch_end,
      a.break_evening_start,
      a.break_evening_end,
      a.checkin_address,
      a.checkout_address
   FROM attendance_logs a
   INNER JOIN rep_list r
      ON a.username COLLATE utf8mb4_unicode_ci = r.username COLLATE utf8mb4_unicode_ci
   WHERE r.status = 1
   ORDER BY a.date DESC`
    );

    const [holidays] = await db.query(
      `SELECT holiday_date, title, description
       FROM holidays
       ORDER BY holiday_date DESC`
    );

    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason
       FROM employee_leaves
       WHERE status = 'approved'
       ORDER BY from_date DESC`
    );

    const globalRow = await loadGlobalAttendanceRulesRow(db);
    const globalRules = rowToAttendanceRulesShape(globalRow);
    await ensureEmployeeAttendanceScheduleTable();
    const [schedules] = await db.query(`SELECT * FROM employee_attendance_schedule`);
    const scheduleByUser = new Map(
      (schedules || []).map((s) => [normalizeUserKey(s.username), s])
    );
    const uniqueUsernames = [...new Set(rows.map((r) => r.username))];
    const rulesByUsername = {};
    for (const u of uniqueUsernames) {
      const schedule = scheduleByUser.get(normalizeUserKey(u)) || null;
      rulesByUsername[u] = mergeGlobalRulesWithEmployeeSchedule(
        globalRules,
        schedule
      );
    }

    return NextResponse.json({
      attendance: rows,
      holidays,
      leaves,
      rulesByUsername,
    });
  } catch (error) {
    console.error("attendance fetch-all:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}
