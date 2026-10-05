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
import { computeAttendanceDetailsCardSummaryForMonth } from "@/lib/attendanceDetailsCardSummary";
import { getPayrollAttendanceLogDateRange } from "@/lib/payrollLogDateRange";
import {
  computePayrollBreakdown,
  getSalaryRateFromStructure,
  countLeaveTypeDaysInMonth,
} from "@/lib/salaryPayrollBreakdown";
import {
  normalizeUserKey,
  buildEmployeeProfileIndex,
  resolveEmployeeProfile,
  pickDateOfJoining,
  pickFatherOrSpouseName,
  formatDojDisplay,
  loadEmployeeProfilesRows,
} from "@/lib/employeeProfileLookup";

const HR_SALARY_ROLES = [
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

function pickLatestStructure(rows) {
  const byUser = new Map();
  for (const row of rows || []) {
    const key = normalizeUserKey(row.username);
    const existing = byUser.get(key);
    if (!existing) {
      byUser.set(key, row);
      continue;
    }
    const a = new Date(existing.effective_from || 0).getTime();
    const b = new Date(row.effective_from || 0).getTime();
    if (b >= a) byUser.set(key, row);
  }
  return byUser;
}

function groupDeductionsByUser(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = normalizeUserKey(row.username);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !HR_SALARY_ROLES.includes(payload.role)) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    if (!month) {
      return NextResponse.json({ message: "Month is required (YYYY-MM)." }, { status: 400 });
    }

    const logRange = getPayrollAttendanceLogDateRange(month);
    if (!logRange) {
      return NextResponse.json({ message: "Invalid month format." }, { status: 400 });
    }

    const db = await getDbConnection();

    const [employees] = await db.query(`
      SELECT username, empId, userRole, userDepartment
      FROM rep_list
      WHERE status = 1
        AND UPPER(TRIM(userRole)) <> 'SUPERADMIN'
      ORDER BY username ASC
    `);

    const profileRows = await loadEmployeeProfilesRows(db);
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
      WHERE a.date >= ? AND a.date <= ?
    `,
      [logRange.from, logRange.to]
    );

    const logsByUser = {};
    for (const row of attendance) {
      const uk = normalizeUserKey(row.username);
      if (!logsByUser[uk]) logsByUser[uk] = [];
      logsByUser[uk].push(row);
    }

    const [structures] = await db.query(`
      SELECT * FROM employee_salary_structure WHERE is_active = 1
    `);
    const structureByUser = pickLatestStructure(structures);

    const monthEnd = `${month}-31`;
    const monthStart = `${month}-01`;
    const [deductionRows] = await db.query(
      `
      SELECT esd.*, sdt.deduction_name, sdt.deduction_code, sdt.calculation_type, sdt.is_mandatory
      FROM employee_salary_deductions esd
      JOIN salary_deduction_types sdt ON esd.deduction_type_id = sdt.id
      WHERE esd.is_active = 1
      AND esd.effective_from <= ? AND (esd.effective_to IS NULL OR esd.effective_to >= ?)
    `,
      [monthEnd, monthStart]
    );
    const deductionsByUser = groupDeductionsByUser(deductionRows);

    const [monthlyRecords] = await db.query(
      `SELECT username, overtime_hours FROM monthly_salary_records WHERE salary_month = ?`,
      [month]
    );
    const recordByUser = new Map(
      (monthlyRecords || []).map((r) => [normalizeUserKey(r.username), r])
    );

    const rows = employees.map((emp) => {
      const uk = normalizeUserKey(emp.username);
      const profile = resolveEmployeeProfile(emp, profileIndex) || {};
      const dateOfJoining = pickDateOfJoining(profile);
      const rules = mergeGlobalRulesWithEmployeeSchedule(
        globalRules,
        scheduleByUser.get(uk) || null
      );
      const logs = logsByUser[uk] || [];

      const stats = computeSalaryPayDaysForUser({
        monthStr: month,
        logs,
        holidaysAll: holidays,
        leavesAll: leaves,
        username: emp.username,
        rules,
        dateOfJoining,
      });

      const cards = computeAttendanceDetailsCardSummaryForMonth({
        monthStr: month,
        username: emp.username,
        logs,
        holidaysAll: holidays,
        leavesAll: leaves,
        rules,
        dateOfJoining,
      });

      const present =
        cards?.present != null ? Number(cards.present) : Number(stats.present) || 0;
      let payDays = stats.pay_days != null ? Number(stats.pay_days) : 0;
      if (present === 0) payDays = 0;

      const structure = structureByUser.get(uk) || null;
      const rate = getSalaryRateFromStructure(structure);
      const monthlyRecord = recordByUser.get(uk);
      const overtimeHours = monthlyRecord?.overtime_hours != null
        ? Number(monthlyRecord.overtime_hours)
        : 0;
      const breakdown = computePayrollBreakdown({
        salaryStructure: structure,
        deductions: deductionsByUser.get(uk) || [],
        presentDays: payDays,
        overtimeHours,
      });

      const earnedTotal = breakdown != null ? breakdown.totalEarnings : null;

      const fatherOrSpouse = pickFatherOrSpouseName(profile);

      const sickLeave = countLeaveTypeDaysInMonth(leaves, emp.username, month, "sick");
      const paidLeave = countLeaveTypeDaysInMonth(leaves, emp.username, month, "paid");
      const otherLeave = countLeaveTypeDaysInMonth(leaves, emp.username, month, "unpaid");

      return {
        username: emp.username,
        employee_code: profile.employee_code || emp.empId || profile.empId || "",
        employee_name: profile.full_name || emp.username,
        date_of_joining: dateOfJoining,
        date_of_joining_display: formatDojDisplay(dateOfJoining),
        father_or_spouse_name: fatherOrSpouse,
        has_salary_structure: !!structure,
        rate_basic: rate.basic,
        rate_hra: rate.hra,
        rate_other_allow: rate.otherAllow,
        rate_total: rate.total,
        attendance: {
          present,
          absent:
            cards?.absents != null
              ? Number(cards.absents) || 0
              : Number(stats.lop) || 0,
          weekly_off:
            (Number(stats.weekend_off) || 0) + (Number(stats.holiday) || 0),
          sick_leave: sickLeave,
          paid_leave: paidLeave,
          other_leave: otherLeave,
          paid_days: payDays,
        },
        earned: breakdown
          ? {
              basic: breakdown.basicSalary,
              hra: breakdown.hra,
              other_allow: breakdown.otherAllowanceEarned,
              overtime_hours: overtimeHours || null,
              overtime_pay: breakdown.overtimeAmount,
              incentive: null,
              total: earnedTotal,
            }
          : null,
        deductions: breakdown
          ? {
              pf: breakdown.pf,
              esi: breakdown.esi,
              advance: breakdown.advanceDeduction,
              other: breakdown.otherDeductions,
              total: breakdown.totalDeductions,
            }
          : null,
        net_salary: breakdown ? breakdown.netSalary : null,
      };
    });

    const [y, m] = month.split("-").map(Number);
    const monthLabel = new Date(y, m - 1, 1).toLocaleString("en-IN", {
      month: "short",
      year: "numeric",
    });

    return NextResponse.json({
      success: true,
      month,
      month_label: monthLabel.toUpperCase(),
      company_name: "DYNACLEAN INDUSTRIES PRIVATE LIMITED",
      rows,
    });
  } catch (error) {
    console.error("salary-sheet API error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
