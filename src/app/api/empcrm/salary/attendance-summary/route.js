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

const ATT_SELECT = `
      a.username, a.date, a.checkin_time, a.checkout_time,
      a.break_morning_start, a.break_morning_end,
      a.break_lunch_start, a.break_lunch_end,
      a.break_evening_start, a.break_evening_end
`;

function mapOneEmployeeSummary(emp, logs, holidays, leaves, globalRules, scheduleByUser) {
  const rules = mergeGlobalRulesWithEmployeeSchedule(
    globalRules,
    scheduleByUser.get(normalizeUserKey(emp.username)) || null
  );
  const stats = computeSalaryPayDaysForUser({
    monthStr: emp._monthStr,
    logs,
    holidaysAll: holidays,
    leavesAll: leaves,
    username: emp.username,
    rules,
    dateOfJoining: emp.date_of_joining ?? null,
  });

  return {
    username: emp.username,
    full_name: emp.full_name,
    present_days: stats.present,
    half_day_count: stats.half_day,
    sunday_count: stats.sunday,
    weekend_off_count: stats.weekend_off,
    holiday_count: stats.holiday,
    lop_count: stats.lop,
    paid_leave_days: stats.paid_leave,
    pay_days: Number(stats.pay_days),
    pay_days_raw: stats.pay_days_raw != null ? Number(stats.pay_days_raw) : null,
    attendance_log_days: logs.length,
    dates_worked: logs.map((l) => l.date),
    sunday_worked_dates: stats.sunday_worked_dates,
  };
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].includes(payload.role)) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // Format: YYYY-MM
    const usernameFilter = searchParams.get("username"); // optional: one employee (matches rep_list)

    if (!month) {
      return NextResponse.json({ message: "Month is required." }, { status: 400 });
    }

    const db = await getDbConnection();

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

    /** Single-employee path: join logs to rep_list so usernames always match Attendance screens. */
    if (usernameFilter != null && String(usernameFilter).trim() !== "") {
      const [empRows] = await db.query(
        `
        SELECT username, username AS full_name, userRole, userDepartment
        FROM rep_list
        WHERE status = 1 AND LOWER(TRIM(username)) = LOWER(TRIM(?))
        LIMIT 1
      `,
        [usernameFilter]
      );

      if (!empRows.length) {
        return NextResponse.json({ success: false, message: "Employee not found." }, { status: 404 });
      }

      let dateOfJoining = null;
      try {
        const [profileRows] = await db.query(
          `SELECT date_of_joining FROM employee_profiles WHERE username = ? LIMIT 1`,
          [empRows[0].username]
        );
        dateOfJoining = profileRows[0]?.date_of_joining ?? null;
      } catch {
        /* table/column missing in some DBs */
      }

      const emp = { ...empRows[0], _monthStr: month, date_of_joining: dateOfJoining };

      const [attendance] = await db.query(
        `
        SELECT ${ATT_SELECT}
        FROM attendance_logs a
        INNER JOIN rep_list r
          ON a.username COLLATE utf8mb4_unicode_ci = r.username COLLATE utf8mb4_unicode_ci
        WHERE r.status = 1 AND r.username = ? AND a.date LIKE ?
      `,
        [emp.username, `${month}%`]
      );

      const summary = mapOneEmployeeSummary(emp, attendance, holidays, leaves, globalRules, scheduleByUser);

      return NextResponse.json({
        success: true,
        employees: [summary],
      });
    }

    const [employees] = await db.query(`
      SELECT username, username as full_name, userRole, userDepartment 
      FROM rep_list 
      WHERE status = 1
    `);

    let dojByUser = new Map();
    try {
      const [profileRows] = await db.query(
        `SELECT username, date_of_joining FROM employee_profiles`
      );
      dojByUser = new Map(
        (profileRows || []).map((p) => [normalizeUserKey(p.username), p.date_of_joining])
      );
    } catch {
      /* employee_profiles missing */
    }

    const [attendance] = await db.query(
      `
      SELECT ${ATT_SELECT}
      FROM attendance_logs 
      WHERE date LIKE ? 
    `,
      [`${month}%`]
    );

    const logsByUser = {};
    for (const row of attendance) {
      const uk = normalizeUserKey(row.username);
      if (!logsByUser[uk]) logsByUser[uk] = [];
      logsByUser[uk].push(row);
    }

    const employeeSummary = employees.map((emp) => {
      const logs = logsByUser[normalizeUserKey(emp.username)] || [];
      const dateOfJoining = dojByUser.get(normalizeUserKey(emp.username)) ?? null;
      return mapOneEmployeeSummary(
        { ...emp, _monthStr: month, date_of_joining: dateOfJoining },
        logs,
        holidays,
        leaves,
        globalRules,
        scheduleByUser
      );
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
