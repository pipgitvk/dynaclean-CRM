/**
 * Same counts as empcrm/admin-dashboard/attendance summary cards (Present … Late Days)
 * for one calendar month. Timeline rules match generateAttendanceTimeline + summary reduce;
 * date keys use dateToYmdKey (stable for DB strings) like the rest of payroll.
 */
import {
  isHalfDayWithGrace,
  isLateDaySummary,
} from "@/lib/attendanceRulesEngine";
import {
  dateToYmdKey,
  weeklyOffSundayCountsAsPaid,
  isSalaryMonthFullyElapsed,
  getCalendarDaysInMonth,
} from "@/lib/salaryPayDaysFromAttendance";
import { rowHasMeaningfulCheckinOrCheckout } from "@/lib/attendanceMeaningfulPunch";
import {
  sanitizeAttendanceLogForPayroll,
  isPayrollHalfDayFromUnapprovedAutoCheckout,
} from "@/lib/attendanceLogForPayroll";
import { eachDayInLeaveRange } from "@/lib/leaveContinuousDays";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Match admin page: exact username on leaves (see attendance page leave filter). */
function buildLeaveMapForUser(leaves, username) {
  const map = new Map();
  (leaves || [])
    .filter((leave) => leave.username === username)
    .forEach((leave) => {
      const fromKey = dateToYmdKey(leave.from_date);
      const toKey = dateToYmdKey(leave.to_date);
      if (!fromKey || !toKey) return;
      for (const day of eachDayInLeaveRange(fromKey, toKey)) {
        const k = dateToYmdKey(day);
        if (k) map.set(k, leave);
      }
    });
  return map;
}

/**
 * @param {Object} p
 * @param {string} p.monthStr - "YYYY-MM"
 * @param {string} p.username
 * @param {Array} p.logs - attendance rows for the month
 * @param {Array} p.holidaysAll
 * @param {Array} p.leavesAll - approved leaves
 * @param {string|Date|null|undefined} [p.dateOfJoining]
 */
export function computeAttendanceDetailsCardSummaryForMonth(p) {
  const { monthStr, username, logs, holidaysAll, leavesAll, rules, dateOfJoining } = p;
  const [y, m] = monthStr.split("-").map(Number);
  const monthIndex = m - 1;
  const daysInMonth = getCalendarDaysInMonth(y, m);
  const today = startOfDay(new Date());
  const payrollMonthElapsed = isSalaryMonthFullyElapsed(monthStr, today);

  const holidayMap = new Map();
  for (const h of holidaysAll || []) {
    const k = dateToYmdKey(h.holiday_date);
    if (k) holidayMap.set(k, h);
  }

  const dateMap = new Map();
  for (const log of logs || []) {
    const k = dateToYmdKey(log.date);
    if (k) dateMap.set(k, sanitizeAttendanceLogForPayroll(log));
  }

  const leaveMap = buildLeaveMapForUser(leavesAll, username);

  // All paid leaves (incl. half-day) — same priority as attendance timeline
  const paidLeaveMap = new Map();
  for (const leave of leavesAll || []) {
    if (String(leave.username ?? "").trim().toLowerCase() !== String(username ?? "").trim().toLowerCase()) continue;
    if (leave.leave_type !== "paid") continue;
    const fromKey = dateToYmdKey(leave.from_date);
    const toKey = dateToYmdKey(leave.to_date);
    if (!fromKey || !toKey) continue;
    for (const day of eachDayInLeaveRange(fromKey, toKey)) {
      const k = dateToYmdKey(day);
      if (k) paidLeaveMap.set(k, leave);
    }
  }

  let dojValid = false;
  let doj = null;
  if (dateOfJoining != null && String(dateOfJoining).trim() !== "") {
    const parsed = startOfDay(new Date(dateOfJoining));
    if (!Number.isNaN(parsed.getTime())) {
      doj = parsed;
      dojValid = true;
    }
  }

  /** Dates that count toward the Leaves card (same month loop as `leaves` total). */
  const leave_dates = [];

  const summary = {
    present: 0,
    absents: 0,
    leaves: 0,
    sundays: 0,
    holidays: 0,
    halfDays: 0,
    lateDays: 0,
    leave_dates,
  };
  /** Grace counter for half-day calculation (first 3 grace period days not counted as half-days) */
  let halfDayGraceUsed = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, monthIndex, day);
    const cellDate = startOfDay(d);
    if (!payrollMonthElapsed && cellDate > today) continue;
    if (dojValid && cellDate < doj) continue;

    const dateString = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existingLog = dateMap.get(dateString);
    const isWeekend = d.getDay() === 0;
    const isHoliday = holidayMap.has(dateString);
    const isOnLeave = leaveMap.has(dateString);

    const hasRealPunch = rowHasMeaningfulCheckinOrCheckout(existingLog);
    const approvedPaidLeave = paidLeaveMap.get(dateString);

    // Paid leave before punch — same order as generateAttendanceTimeline
    if (approvedPaidLeave) {
      const leaveIsHalfDay =
        approvedPaidLeave.is_half_day == 1 ||
        approvedPaidLeave.leave_type === "half-day";
      const treatAsHalfDay = hasRealPunch || leaveIsHalfDay;
      if (treatAsHalfDay) {
        summary.leaves += 0.5;
        summary.present += 0.5;
        leave_dates.push(dateString);
        if (hasRealPunch && isLateDaySummary(existingLog, rules)) {
          summary.lateDays++;
        }
      } else {
        summary.leaves += 1;
        leave_dates.push(dateString);
      }
    } else if (
      existingLog &&
      isPayrollHalfDayFromUnapprovedAutoCheckout(existingLog)
    ) {
      summary.present += 0.5;
      summary.halfDays++;
    } else if (existingLog && hasRealPunch) {
      // Punch wins over half-day leave on same date (attendance page)
      summary.present++;
      const { isHalfDay, graceUsed } = isHalfDayWithGrace(
        existingLog,
        rules,
        halfDayGraceUsed
      );
      halfDayGraceUsed = graceUsed;
      if (isHalfDay) summary.halfDays++;
      if (isLateDaySummary(existingLog, rules)) summary.lateDays++;
    } else if (isOnLeave) {
      const leave = leaveMap.get(dateString);
      if (leave?.leave_type === "unpaid") {
        summary.absents++;
      } else {
        const leaveIsHalfDay =
          leave?.is_half_day == 1 || leave?.leave_type === "half-day";
        if (leaveIsHalfDay) summary.halfDays++;
        else {
          summary.leaves += 1;
          leave_dates.push(dateString);
        }
      }
    } else if (isHoliday) {
      summary.holidays++;
    } else if (isWeekend) {
      if (
        weeklyOffSundayCountsAsPaid(dateString, {
          holidayMap,
          dateMap,
          today,
          dateOfJoining,
        })
      ) {
        summary.sundays++;
      } else {
        summary.absents++;
      }
    } else {
      summary.absents++;
    }
  }

  return summary;
}
