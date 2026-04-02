/**
 * Salary "pay days" from attendance (payroll-oriented).
 *
 * Pay days (for salary):
 *   periodDays = eligible calendar days in month (after DOJ, not after today).
 *   requiredWorkingDays = days in period that are not Sunday and not (company) holiday.
 *   totalAttendance = full-day present count + (half_day × 0.5).
 *   Half-day for pay uses `isHalfDayByRules` (same as Attendance details / Monthly card).
 *   Missing check-in or check-out does not count as half-day (matches card Half-Days row).
 *   deductionDays = max(0, requiredWorkingDays − totalAttendance)
 *   pay_days = periodDays − deductionDays
 *
 * - Days before date_of_joining are skipped (not LOP, not paid).
 */
import { isHalfDayByRules } from "@/lib/attendanceRulesEngine";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Stable YYYY-MM-DD for a local calendar date (avoids TZ shifts vs ISO date strings). */
function ymdKey(year, month1to12, day) {
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Normalize DB date (MySQL DATE / datetime / JS Date) to YYYY-MM-DD in local calendar.
 * Prefer raw "YYYY-MM-DD" from strings so we never shift a day across timezones.
 */
export function dateToYmdKey(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return ymdKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function buildLeaveDateSetForUser(leaves, username) {
  const set = new Set();
  const u = String(username ?? "").trim().toLowerCase();
  for (const leave of leaves || []) {
    if (String(leave.username ?? "").trim().toLowerCase() !== u) continue;
    const from = new Date(leave.from_date);
    const to = new Date(leave.to_date);
    for (let x = new Date(from); x <= to; x.setDate(x.getDate() + 1)) {
      set.add(ymdKey(x.getFullYear(), x.getMonth() + 1, x.getDate()));
    }
  }
  return set;
}

/**
 * @param {Object} p
 * @param {string} p.monthStr - "YYYY-MM"
 * @param {Array<{date:string|Date, checkin_time?:string, checkout_time?:string}>} p.logs
 * @param {Array<{holiday_date:string|Date}>} p.holidaysAll
 * @param {Array<{username:string, from_date:string, to_date:string}>} p.leavesAll
 * @param {string} p.username
 * @param {string|Date|null|undefined} p.dateOfJoining — skip calendar days before this (exclusive of LOP/present).
 * @param {import("@/lib/attendanceRulesEngine").AttendanceRulesShape} p.rules
 */
export function computeSalaryPayDaysForUser(p) {
  const { monthStr, logs, holidaysAll, leavesAll, username, rules, dateOfJoining } = p;
  const [y, m] = monthStr.split("-").map(Number);
  const monthIndex = m - 1;
  const daysInMonth = new Date(y, monthIndex + 1, 0).getDate();
  const today = startOfDay(new Date());
  let dojValid = false;
  let doj = null;
  if (dateOfJoining != null && String(dateOfJoining).trim() !== "") {
    const parsed = startOfDay(new Date(dateOfJoining));
    if (!Number.isNaN(parsed.getTime())) {
      doj = parsed;
      dojValid = true;
    }
  }

  const holidayMap = new Map();
  for (const h of holidaysAll || []) {
    const k = dateToYmdKey(h.holiday_date);
    if (k) holidayMap.set(k, h);
  }

  const dateMap = new Map();
  for (const log of logs || []) {
    const k = dateToYmdKey(log.date);
    if (k) dateMap.set(k, log);
  }

  const leaveDates = buildLeaveDateSetForUser(leavesAll, username);

  let present = 0;
  let half_day = 0;
  let sunday = 0;
  /** Sundays with no log (paid weekly off; not LOP). Saturday is not included. */
  let weekend_off = 0;
  let holiday = 0;
  let lop = 0;
  let paid_leave = 0;
  const sundayWorkedDates = [];

  /** Eligible days in month (same loop scope as pay-days formula). */
  let periodDays = 0;
  /** Non-Sunday, non-holiday days in period (expected attendance slots). */
  let requiredWorkingDays = 0;
  /** For UI: Sundays in eligible period (incl. Sunday that is also a company holiday). */
  let sundaysInPeriod = 0;
  /** Company holidays on Mon–Sat in period (not double-counted with Sundays). */
  let holidayWeekdaysInPeriod = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, monthIndex, day);
    const cellDate = startOfDay(d);
    if (cellDate > today) continue;
    if (dojValid && cellDate < doj) continue;

    const dateString = ymdKey(y, m, day);
    const existingLog = dateMap.get(dateString);
    const dow = d.getDay();
    const isSunday = dow === 0;
    const isHoliday = holidayMap.has(dateString);
    const isOnLeave = leaveDates.has(dateString);

    periodDays++;
    if (isSunday) sundaysInPeriod++;
    if (isHoliday && !isSunday) holidayWeekdaysInPeriod++;
    if (!isSunday && !isHoliday) {
      requiredWorkingDays++;
    }

    if (existingLog) {
      if (isHalfDayByRules(existingLog, rules)) {
        half_day++;
      } else {
        present++;
      }
      if (isSunday) {
        sundayWorkedDates.push(dateString);
      }
      continue;
    }
    if (isHoliday) {
      holiday++;
      continue;
    }
    if (isSunday) {
      sunday++;
      weekend_off++;
      continue;
    }
    if (isOnLeave) {
      paid_leave++;
      continue;
    }
    lop++;
  }

  const totalAttendance = present + 0.5 * half_day;
  const deductionDays = Math.max(0, requiredWorkingDays - totalAttendance);
  const payDays = periodDays - deductionDays;

  return {
    present,
    half_day,
    sunday,
    weekend_off,
    holiday,
    lop,
    paid_leave,
    pay_days: payDays,
    pay_days_raw: payDays,
    sunday_worked_dates: sundayWorkedDates,
    period_days: periodDays,
    sundays_in_period: sundaysInPeriod,
    holiday_weekdays_in_period: holidayWeekdaysInPeriod,
    required_working_days: requiredWorkingDays,
    total_attendance: totalAttendance,
    deduction_days: deductionDays,
  };
}
