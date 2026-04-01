/**
 * Salary "pay days" from attendance (payroll-oriented).
 * Pay days (for salary / UI) = full-day present + Sunday weekly off + holidays − (half_day × 0.5).
 * - Salary uses a fixed 15 min grace from configured check-in / check-out times (not a wider DB gracePeriodMinutes).
 * - Check-in: on time = at/before standard; grace = within 15 min after standard; after that = late (half-day).
 * - Check-out: on time = at/after standard; grace = within 15 min before standard; earlier = late (half-day).
 * - Clock times use the wall time from DB strings (YYYY-MM-DD HH:mm:ss) when present so server TZ does not shift 10:30 → wrong band.
 * - Other combinations (e.g. late check-out) are half-day unless covered above.
 * - sunday_off: Sundays with no punch only (Saturday is a normal working day for LOP).
 * - Days before date_of_joining are skipped (not LOP, not paid).
 */
import {
  parseTimeToMinutes,
  DEFAULT_ATTENDANCE_RULES,
} from "@/lib/attendanceRulesEngine";

/** Salary only: grace window is exactly 15 minutes from standard in/out times. */
const SALARY_GRACE_MINUTES = 15;

/**
 * Minutes since midnight for a punch time. Prefer MySQL-style "YYYY-MM-DD HH:mm:ss" so
 * 10:30 stays 10:30 (avoids Node/UTC shifting getHours() vs stored local wall time).
 * @param {string|Date|null|undefined} logTime
 * @returns {number|null}
 */
function parseLogClockMinutes(logTime) {
  if (logTime == null) return null;
  if (logTime instanceof Date) {
    if (Number.isNaN(logTime.getTime())) return null;
    return logTime.getHours() * 60 + logTime.getMinutes();
  }
  const s = String(logTime).trim();
  const m = s.match(/\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const h = parseInt(m[1], 10) || 0;
    const min = parseInt(m[2], 10) || 0;
    return h * 60 + min;
  }
  const d = new Date(logTime);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * @param {string|null|undefined} logTime
 * @param {import("@/lib/attendanceRulesEngine").AttendanceRulesShape} rules
 * @returns {"onTime"|"grace"|"late"|null}
 */
function getSalaryCheckinBand(logTime, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  const logM = parseLogClockMinutes(logTime);
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
  const logM = parseLogClockMinutes(logTime);
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

  const payDays = Math.max(
    0,
    present + weekend_off + holiday - 0.5 * half_day
  );

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
