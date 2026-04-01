/**
 * Salary “pay days” from attendance, aligned with AttendanceSummaryGrid / cell logic.
 * Formula: Present + Sunday + Holiday − LOP − (half_day × 0.5).
 * Paid approved leave is counted separately (`paid_leave`); add it manually to Present Days if policy pays for leave.
 */
import { isHalfDayByRules } from "@/lib/attendanceRulesEngine";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildLeaveDateSetForUser(leaves, username) {
  const set = new Set();
  const u = String(username ?? "").trim();
  for (const leave of leaves || []) {
    if (String(leave.username ?? "").trim() !== u) continue;
    const from = new Date(leave.from_date);
    const to = new Date(leave.to_date);
    for (let x = new Date(from); x <= to; x.setDate(x.getDate() + 1)) {
      set.add(x.toLocaleDateString("en-CA"));
    }
  }
  return set;
}

/**
 * @param {Object} p
 * @param {string} p.monthStr - "YYYY-MM"
 * @param {Array<{date:string|Date, checkin_time?:string, checkout_time?:string}>} p.logs - user's logs in that month
 * @param {Array<{holiday_date:string|Date}>} p.holidaysAll
 * @param {Array<{username:string, from_date:string, to_date:string}>} p.leavesAll - approved leaves (filtered per user via buildLeaveDateSet)
 * @param {string} p.username
 * @param {import("@/lib/attendanceRulesEngine").AttendanceRulesShape} p.rules
 * @returns {{
 *   present: number,
 *   half_day: number,
 *   sunday: number,
 *   holiday: number,
 *   lop: number,
 *   paid_leave: number,
 *   pay_days: number,
 *   sunday_worked_dates: string[],
 * }}
 */
export function computeSalaryPayDaysForUser(p) {
  const { monthStr, logs, holidaysAll, leavesAll, username, rules } = p;
  const [y, m] = monthStr.split("-").map(Number);
  const monthIndex = m - 1;
  const daysInMonth = new Date(y, monthIndex + 1, 0).getDate();
  const today = startOfDay(new Date());

  const holidayMap = new Map(
    (holidaysAll || []).map((h) => [new Date(h.holiday_date).toLocaleDateString("en-CA"), h])
  );

  const dateMap = new Map(
    (logs || []).map((log) => [new Date(log.date).toLocaleDateString("en-CA"), log])
  );

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

    const dateString = d.toLocaleDateString("en-CA");
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
    present + sunday + holiday - lop - 0.5 * half_day
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
