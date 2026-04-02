/**
 * Salary "pay days" from attendance (payroll-oriented).
 *
 * Pay days (for salary):
 *   periodDays = eligible calendar days in month (after DOJ, not after today).
 *   requiredWorkingDays = days in period that are not Sunday and not (company) holiday.
 *   totalAttendance = full-day present count + (half_day × 0.5), using salary 15‑min grace rules.
 *   deductionDays = max(0, requiredWorkingDays − totalAttendance)
 *   pay_days = periodDays − deductionDays
 *   (equivalent to: totalAttendance + paid Sundays/holidays in period − shortfall vs required slots.)
 *
 * - Salary uses a fixed 15 min grace from configured check-in / check-out times (not a wider DB gracePeriodMinutes).
 * - Days before date_of_joining are skipped (not LOP, not paid).
 */
import {
  parseTimeToMinutes,
  DEFAULT_ATTENDANCE_RULES,
} from "@/lib/attendanceRulesEngine";
import { parseAttendanceClockMinutes } from "@/lib/istDateTime";

/** Salary only: grace window is exactly 15 minutes from standard in/out times. */
const SALARY_GRACE_MINUTES = 15;

/**
 * @param {string|null|undefined} logTime
 * @param {import("@/lib/attendanceRulesEngine").AttendanceRulesShape} rules
 * @returns {"onTime"|"grace"|"late"|null}
 */
function getSalaryCheckinBand(logTime, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  const logM = parseAttendanceClockMinutes(logTime);
  if (logM == null) return null;
  const standardM = parseTimeToMinutes(r.checkin);
  const graceEndM = standardM + SALARY_GRACE_MINUTES;
  if (logM <= standardM) return "onTime";
  if (logM <= graceEndM) return "grace";
  return "late";
}

/**
 * @param {string|null|undefined} logTime
 * @param {import("@/lib/attendanceRulesEngine").AttendanceRulesShape} rules
 * @returns {"onTime"|"grace"|"late"|null}
 */
function getSalaryCheckoutBand(logTime, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  const logM = parseAttendanceClockMinutes(logTime);
  if (logM == null) return null;
  const standardM = parseTimeToMinutes(r.checkout);
  const graceStartM = standardM - SALARY_GRACE_MINUTES;
  if (logM >= standardM) return "onTime";
  if (logM >= graceStartM) return "grace";
  return "late";
}

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

  /**
   * @returns {boolean} true = full day (present), false = half-day
   */
  function punchDayIsFullDay(log) {
    const cin = getSalaryCheckinBand(log?.checkin_time, rules);
    const cout = getSalaryCheckoutBand(log?.checkout_time, rules);
    if (cin == null || cout == null) return false;

    if (cin === "onTime" && cout === "onTime") return true;

    if (cin === "grace" && cout === "onTime") return true;
    if (cin === "onTime" && cout === "grace") return true;
    if (cin === "grace" && cout === "grace") return true;

    if (cin === "late") return false;

    if (cout === "late") return false;

    return false;
  }

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
    if (!isSunday && !isHoliday) {
      requiredWorkingDays++;
    }

    if (existingLog) {
      if (punchDayIsFullDay(existingLog)) {
        present++;
      } else {
        half_day++;
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
  };
}
