/**
 * Salary “pay days” from attendance, aligned with AttendanceSummaryGrid / cell logic.
 * Formula:
 *   present + sunday + holiday + paid_leave − LOP − (half_day × 0.5)
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
 * @param {import("@/lib/attendanceRulesEngine").AttendanceRulesShape} p.rules
 */
export function computeSalaryPayDaysForUser(p) {
  const { monthStr, logs, holidaysAll, leavesAll, username, rules } = p;
  const [y, m] = monthStr.split("-").map(Number);
  const monthIndex = m - 1;
  const daysInMonth = new Date(y, monthIndex + 1, 0).getDate();
  const today = startOfDay(new Date());

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
  let holiday = 0;
  let lop = 0;
  let paid_leave = 0;
  const sundayWorkedDates = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, monthIndex, day);
    const cellDate = startOfDay(d);
    if (cellDate > today) continue;

    const dateString = ymdKey(y, m, day);
    const existingLog = dateMap.get(dateString);
    const isSunday = d.getDay() === 0;
    const isHoliday = holidayMap.has(dateString);
    const isOnLeave = leaveDates.has(dateString);

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
    if (isSunday) {
      sunday++;
      continue;
    }
    if (isHoliday) {
      holiday++;
      continue;
    }
    if (isOnLeave) {
      paid_leave++;
      continue;
    }
    lop++;
  }

  const pay_days = Math.max(
    0,
    present + sunday + holiday + paid_leave - lop - 0.5 * half_day
  );

  return {
    present,
    half_day,
    sunday,
    holiday,
    lop,
    paid_leave,
    pay_days,
    sunday_worked_dates: sundayWorkedDates,
  };
}
