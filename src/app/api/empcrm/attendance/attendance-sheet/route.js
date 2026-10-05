import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  rowToAttendanceRulesShape,
  mergeGlobalRulesWithEmployeeSchedule,
} from "@/lib/attendanceRulesDb";
import {
  normalizeUserKey,
  buildEmployeeProfileIndex,
  resolveEmployeeProfile,
  loadEmployeeProfilesRows,
} from "@/lib/employeeProfileLookup";
import {
  calendarMonthMeta,
  buildEmployeeAttendanceSheetRow,
} from "@/lib/attendanceSheetMonth";
import {
  PAYROLL_ACTIVE_EMPLOYEE_SQL,
  buildEmployeeProfileByUsername,
  dedupeEmployeesForPayrollSheet,
  filterEmployeesForAttendanceSheet,
} from "@/lib/payrollActiveEmployees";
import { dateToYmdKey } from "@/lib/salaryPayDaysFromAttendance";

const HR_ROLES = [
  "SUPERADMIN",
  "HR HEAD",
  "HR",
  "HR Executive",
  "JUNIOR HR EXECUTIVE",
  "HR RECRUITER",
  "ACCOUNTANT",
  "PRODUCTION ACCOUNTANT",
];

const ATT_SELECT = `
      a.username, a.date, a.checkin_time, a.checkout_time,
      a.break_morning_start, a.break_morning_end,
      a.break_lunch_start, a.break_lunch_end,
      a.break_evening_start, a.break_evening_end
`;

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !HR_ROLES.includes(payload.role)) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    if (!month) {
      return NextResponse.json({ message: "Month is required (YYYY-MM)." }, { status: 400 });
    }

    const meta = calendarMonthMeta(month);
    if (!meta) {
      return NextResponse.json({ message: "Invalid month format." }, { status: 400 });
    }

    const db = await getDbConnection();

    const [employeeRows] = await db.query(PAYROLL_ACTIVE_EMPLOYEE_SQL);
    const profileRows = await loadEmployeeProfilesRows(db);
    const profileByUser = buildEmployeeProfileByUsername(profileRows);
    const filtered = filterEmployeesForAttendanceSheet(
      employeeRows,
      profileRows,
      meta.to
    );
    const { employees, relatedUsernamesByWinner } = dedupeEmployeesForPayrollSheet(
      filtered,
      profileRows
    );
    const profileIndex = buildEmployeeProfileIndex(profileRows);

    const [holidays] = await db.query(
      `SELECT holiday_date, title, description FROM holidays ORDER BY holiday_date DESC`
    );

    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason, is_half_day, half_day_type, status
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

    const [attendance] = await db.query(
      `
      SELECT ${ATT_SELECT}
      FROM attendance_logs a
      INNER JOIN rep_list r
        ON a.username COLLATE utf8mb4_unicode_ci = r.username COLLATE utf8mb4_unicode_ci
      WHERE r.status = 1
        AND UPPER(TRIM(COALESCE(r.userRole, ''))) <> 'SUPERADMIN'
        AND a.date >= ? AND a.date <= ?
    `,
      [meta.from, meta.to]
    );

    const logsByUser = {};
    for (const row of attendance) {
      const uk = normalizeUserKey(row.username);
      if (!logsByUser[uk]) logsByUser[uk] = [];
      logsByUser[uk].push(row);
    }

    const rows = employees.map((emp, index) => {
      const uk = normalizeUserKey(emp.username);
      const profile =
        profileByUser.get(uk) || resolveEmployeeProfile(emp, profileIndex) || {};
      const related = relatedUsernamesByWinner.get(emp.username) || [emp.username];
      const rules = mergeGlobalRulesWithEmployeeSchedule(
        globalRules,
        scheduleByUser.get(uk) || null
      );
      const logs = [];
      const logDates = new Set();
      for (const uname of related) {
        for (const log of logsByUser[normalizeUserKey(uname)] || []) {
          const dk = dateToYmdKey(log.date);
          if (dk && logDates.has(dk)) continue;
          if (dk) logDates.add(dk);
          logs.push(log);
        }
      }
      const row = buildEmployeeAttendanceSheetRow({
        meta,
        username: emp.username,
        relatedUsernames: related,
        displayName: profile.full_name || emp.username,
        profile,
        emp,
        logs,
        holidays,
        leaves,
        rules,
      });
      return { sno: index + 1, ...row };
    });

    return NextResponse.json({
      success: true,
      month,
      company_name: "DYNACLEAN INDUSTRIES PRIVATE LIMITED",
      title: "ATTENDANCE RECORD",
      ...meta,
      rows,
    });
  } catch (error) {
    console.error("attendance-sheet API error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
