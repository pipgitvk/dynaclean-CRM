/**
 * Salary "pay days" from attendance (payroll-oriented).
 *
 * Pay days (for salary):
 *   periodDays = eligible calendar days in month (after DOJ; for **current** salary month only,
 *   not after today — past months use the full calendar month).
 *   requiredWorkingDays = days in period that are not Sunday and not (company) holiday.
 *   totalAttendance = sum of weekday (non‑Sun, non‑holiday) credits: **1 day** per eligible
 *   punched day, **0.5** only when `isHalfDayByRules` (e.g. no checkout / half‑day timing).
 *   Late / grace / classifyAttendanceDayForSalary do **not** reduce pay-days — they only split
 *   present vs late_days for reporting; salary amount can still use finer rules separately.
 *   deductionDays = max(0, requiredWorkingDays − totalAttendance)
 *   pay_days_base = periodDays − deductionDays
 *   Weekly-off Sunday unpaid if Mon–Sat of that calendar week had no meaningful punch on any
 *   non‑holiday weekday (whole week absent); if that week had at least one such punch, WO Sunday stays paid.
 *   pay_days = pay_days_base − count(such Sundays).
 *
 * - Days before date_of_joining are skipped (not LOP, not paid).
 * - Fetch logs from a few days before month start (`getPayrollAttendanceLogDateRange`) so cross‑month weeks resolve.
 * - For payroll **past months** (`isSalaryMonthFullyElapsed`), days are not capped at today — full calendar month applies.
 */
import {
  classifyAttendanceDayForSalary,
  isHalfDayByRules,
} from "@/lib/attendanceRulesEngine";
import { rowHasMeaningfulCheckinOrCheckout } from "@/lib/attendanceMeaningfulPunch";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** True when calendar month `monthStr` (YYYY-MM) ended before today's month — count every day that month for payroll/cards (not capped at "today"). */
export function isSalaryMonthFullyElapsed(monthStr, todayDate = startOfDay(new Date())) {
  const [yy, mm] = String(monthStr ?? "")
    .split("-")
    .map((n) => Number(n));
  if (!Number.isFinite(yy) || !Number.isFinite(mm)) return false;
  const ty = todayDate.getFullYear();
  const tm = todayDate.getMonth() + 1;
  return yy < ty || (yy === ty && mm < tm);
}

function parseLocalYmd(ymd) {
  const p = String(ymd || "").slice(0, 10).split("-");
  if (p.length < 3) return null;
  const yy = Number(p[0]);
  const mm = Number(p[1]);
  const dd = Number(p[2]);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return startOfDay(new Date(yy, mm - 1, dd));
}

function addCalendarDays(date, delta) {
  const x = new Date(date.getTime());
  x.setDate(x.getDate() + delta);
  return startOfDay(x);
}

/** Stable YYYY-MM-DD for a local calendar date (avoids TZ shifts vs ISO date strings). */
function ymdKey(year, month1to12, day) {
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Weekly-off Sunday counts as paid (salary + purple card) only if Mon–Sat same week has ≥1
 * in-scope punch on a non-holiday weekday. If the week had expected slots but none punched → false.
 * If there were no expected weekday slots (e.g. whole week holidays / out of scope) → true.
 */
export function weeklyOffSundayCountsAsPaid(sunDateYmd, {
  holidayMap,
  dateMap,
  today = null,
  dateOfJoining = null,
}) {
  const sunDate = parseLocalYmd(sunDateYmd);
  if (!sunDate) return true;
  const todayStart = today != null ? startOfDay(today) : startOfDay(new Date());
  let doj = null;
  let dojValid = false;
  if (dateOfJoining != null && String(dateOfJoining).trim() !== "") {
    const parsed = startOfDay(new Date(dateOfJoining));
    if (!Number.isNaN(parsed.getTime())) {
      doj = parsed;
      dojValid = true;
    }
  }
  const todayCmp = todayStart.getTime();
  let weekHasExpectedWeekdaySlot = false;
  let weekHasAttendancePunch = false;
  for (let delta = -6; delta <= -1; delta++) {
    const wdDate = addCalendarDays(sunDate, delta);
    if (wdDate.getTime() > todayCmp) continue;
    if (dojValid && wdDate.getTime() < doj.getTime()) continue;
    const wk = ymdKey(wdDate.getFullYear(), wdDate.getMonth() + 1, wdDate.getDate());
    if (holidayMap.has(wk)) continue;
    if (wdDate.getDay() === 0) continue;
    weekHasExpectedWeekdaySlot = true;
    const log = dateMap.get(wk);
    if (rowHasMeaningfulCheckinOrCheckout(log)) {
      weekHasAttendancePunch = true;
      break;
    }
  }
  if (weekHasExpectedWeekdaySlot && !weekHasAttendancePunch) return false;
  return true;
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
  const payrollMonthElapsed = isSalaryMonthFullyElapsed(monthStr, today);
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
  let late_days = 0;
  let sunday = 0;
  /** Sundays with no log (paid weekly off; not LOP). Saturday is not included. */
  let weekend_off = 0;
  let holiday = 0;
  let lop = 0; 
  let paid_leave = 0;
  const sundayWorkedDates = [];
  /** Paid weekly-off Sundays in period (must align with week rule below). */
  const weeklyOffSundayDates = [];
  let freeGraceUsed = 0;

  /** Eligible days in month (same loop scope as pay-days formula). */
  let periodDays = 0;
  /** Non-Sunday, non-holiday days in period (expected attendance slots). */
  let requiredWorkingDays = 0;
  /** For UI: Sundays in eligible period (incl. Sunday that is also a company holiday). */
  let sundaysInPeriod = 0;
  /** Company holidays on Mon–Sat in period (not double-counted with Sundays). */
  let holidayWeekdaysInPeriod = 0;

  /** Mon–Sat (non‑holiday) payroll credits toward required slots: 1 or 0.5 for structural half-days. */
  let weekdayPayCredits = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, monthIndex, day);
    const cellDate = startOfDay(d);
    if (!payrollMonthElapsed && cellDate > today) continue;
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

    const hasRealPunch = rowHasMeaningfulCheckinOrCheckout(existingLog);
    if (existingLog && hasRealPunch) {
      const cls = classifyAttendanceDayForSalary(existingLog, rules, freeGraceUsed);
      freeGraceUsed = cls.freeGraceUsed;
      if (cls.kind === "lateDay") late_days++;
      else present++;
      if (!isSunday && !isHoliday) {
        const structuralHalf = isHalfDayByRules(existingLog, rules);
        if (structuralHalf) half_day++;
        weekdayPayCredits += structuralHalf ? 0.5 : 1;
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
      weeklyOffSundayDates.push(dateString);
      continue;
    }
    if (isOnLeave) {
      paid_leave++;
      continue;
    }
    lop++;
  }

  const totalAttendance = weekdayPayCredits;
  const deductionDays = Math.max(0, requiredWorkingDays - totalAttendance);
  const payDaysBase = periodDays - deductionDays;

  let sundaysUnpaidNoWeekPresence = 0;

  for (const sunStr of weeklyOffSundayDates) {
    if (
      !weeklyOffSundayCountsAsPaid(sunStr, {
        holidayMap,
        dateMap,
        today,
        dateOfJoining,
      })
    ) {
      sundaysUnpaidNoWeekPresence++;
    }
  }

  const payDays = payDaysBase - sundaysUnpaidNoWeekPresence;

  /** Every day with a meaningful punch is either `present` (regular) or `late_days` (salary classifier). Sum matches attendance “Present” when ranges align. */
  const total_punched_days = present + late_days;

  return {
    present,
    half_day,
    late_days,
    total_punched_days,
    sunday,
    weekend_off,
    holiday,
    lop,
    paid_leave,
    pay_days: payDays,
    pay_days_raw: payDays,
    pay_days_base: payDaysBase,
    sundays_unpaid_whole_week_off: sundaysUnpaidNoWeekPresence,
    sunday_worked_dates: sundayWorkedDates,
    period_days: periodDays,
    sundays_in_period: sundaysInPeriod,
    holiday_weekdays_in_period: holidayWeekdaysInPeriod,
    required_working_days: requiredWorkingDays,
    total_attendance: totalAttendance,
    deduction_days: deductionDays,
  };
}
