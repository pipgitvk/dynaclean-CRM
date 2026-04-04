// app/api/empcrm/attendance/fetch-all/route.js
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

/** Match attendance row `date` with regularization `log_date` (MySQL DATE / string / Date). */
function attendanceDateKey(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export async function GET(request) {
  try {

    console.log(`Fetching all attendance logs for admin view.`);

    const db = await getDbConnection();
    console.log("Database connection established.");

    // Query to fetch all attendance logs
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


    // Fetch holidays
    const [holidays] = await db.query(
      `SELECT holiday_date, title, description
       FROM holidays
       ORDER BY holiday_date DESC`
    );

    // Fetch all approved leaves
    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason
       FROM employee_leaves
       WHERE status = 'approved'
       ORDER BY from_date DESC`
    );

    // db.end();
    console.log("Database connection closed.");
    console.log("Fetched all attendance logs for admin view.");
    console.log(`this is the rows: ${JSON.stringify(rows)}`);
    console.log("this is the holidays", holidays);
    console.log("this is the approved leaves", leaves);

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
      const schedule =
        scheduleByUser.get(normalizeUserKey(u)) || null;
      rulesByUsername[u] = mergeGlobalRulesWithEmployeeSchedule(
        globalRules,
        schedule
      );
    }

    const regMap = new Map();
    try {
      const [regRows] = await db.query(
        `SELECT ar.username, ar.log_date, ar.reason, ar.reviewed_by
         FROM attendance_regularization_requests ar
         INNER JOIN (
           SELECT username, log_date, MAX(id) AS mid
           FROM attendance_regularization_requests
           WHERE status = 'approved'
           GROUP BY username, log_date
         ) t
           ON ar.username COLLATE utf8mb4_unicode_ci = t.username COLLATE utf8mb4_unicode_ci
           AND ar.log_date = t.log_date
           AND ar.id = t.mid
         WHERE ar.status = 'approved'`
      );
      for (const r of regRows || []) {
        const dk = attendanceDateKey(r.log_date);
        const key = `${r.username}|${dk}`;
        regMap.set(key, {
          createdBy: r.username,
          approvedBy: r.reviewed_by || "—",
          reason: r.reason && String(r.reason).trim() ? r.reason : "—",
        });
      }
    } catch (e) {
      console.warn("attendance regularization metadata skipped:", e.message);
    }

    for (const row of rows) {
      const dk = attendanceDateKey(row.date);
      const meta = regMap.get(`${row.username}|${dk}`);
      row.regularization = meta || null;
    }

    return NextResponse.json({ attendance: rows, holidays, leaves, rulesByUsername });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}
