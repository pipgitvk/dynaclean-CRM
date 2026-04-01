import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  rowToAttendanceRulesShape,
  mergeGlobalRulesWithEmployeeSchedule,
} from "@/lib/attendanceRulesDb";
import { computeSalaryPayDaysForUser } from "@/lib/salaryPayDaysFromAttendance";

function normalizeUserKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].includes(payload.role)) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // Format: YYYY-MM

    if (!month) {
      return NextResponse.json({ message: "Month is required." }, { status: 400 });
    }

    const db = await getDbConnection();

    const [employees] = await db.query(`
      SELECT username, username as full_name, userRole, userDepartment 
      FROM rep_list 
      WHERE status = 1
    `);

    const [attendance] = await db.query(
      `
      SELECT username, date, checkin_time, checkout_time,
        break_morning_start, break_morning_end,
        break_lunch_start, break_lunch_end,
        break_evening_start, break_evening_end
      FROM attendance_logs 
      WHERE date LIKE ? 
    `,
      [`${month}%`]
    );

    const [holidays] = await db.query(
      `SELECT holiday_date, title, description FROM holidays ORDER BY holiday_date DESC`
    );

    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason
       FROM employee_leaves
       WHERE status = 'approved'`
    );

    const globalRow = await loadGlobalAttendanceRulesRow(db);
    const globalRules = rowToAttendanceRulesShape(globalRow);
    await ensureEmployeeAttendanceScheduleTable();
    const [schedules] = await db.query(`SELECT * FROM employee_attendance_schedule`);
    const scheduleByUser = new Map(
      (schedules || []).map((s) => [normalizeUserKey(s.username), s])
    );

    const logsByUser = {};
    for (const row of attendance) {
      const uk = normalizeUserKey(row.username);
      if (!logsByUser[uk]) logsByUser[uk] = [];
      logsByUser[uk].push(row);
    }

    const employeeSummary = employees.map((emp) => {
      const rules = mergeGlobalRulesWithEmployeeSchedule(
        globalRules,
        scheduleByUser.get(normalizeUserKey(emp.username)) || null
      );
      const logs = logsByUser[normalizeUserKey(emp.username)] || [];
      const stats = computeSalaryPayDaysForUser({
        monthStr: month,
        logs,
        holidaysAll: holidays,
        leavesAll: leaves,
        username: emp.username,
        rules,
      });

      return {
        username: emp.username,
        full_name: emp.full_name,
        present_days: stats.present,
        half_day_count: stats.half_day,
        sunday_count: stats.sunday,
        holiday_count: stats.holiday,
        lop_count: stats.lop,
        paid_leave_days: stats.paid_leave,
        /** present + sunday + holiday + paid_leave − LOP − 0.5×half_day */
        pay_days: Number(stats.pay_days),
        /** Legacy: total distinct log days (same as present + half_day + sunday worked). */
        attendance_log_days: logs.length,
        dates_worked: logs.map((l) => l.date),
        sunday_worked_dates: stats.sunday_worked_dates,
      };
    });

    return NextResponse.json({
      success: true,
      employees: employeeSummary,
    });
  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
