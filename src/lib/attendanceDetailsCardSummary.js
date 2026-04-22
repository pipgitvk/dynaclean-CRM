/**
 * Same counts as empcrm/admin-dashboard/attendance summary cards (Present … Late Days)
 * for one calendar month. Timeline rules match generateAttendanceTimeline + summary reduce;
 * date keys use dateToYmdKey (stable for DB strings) like the rest of payroll.
 */
import {
  classifyAttendanceDayForSalary,
} from "@/lib/attendanceRulesEngine";
import { dateToYmdKey } from "@/lib/salaryPayDaysFromAttendance";

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
      const fromDate = new Date(leave.from_date);
      const toDate = new Date(leave.to_date);
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        const k = dateToYmdKey(d);
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
 * @param {import("@/lib/attendanceRulesEngine").AttendanceRulesShape} p.rules
 */
export function computeAttendanceDetailsCardSummaryForMonth(p) {
  const { monthStr, username, logs, holidaysAll, leavesAll, rules } = p;
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

  const leaveMap = buildLeaveMapForUser(leavesAll, username);

  const summary = {
    present: 0,
    absents: 0,
    leaves: 0,
    sundays: 0,
    holidays: 0,
    halfDays: 0,
    lateDays: 0,
  };
  let freeGraceUsed = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, monthIndex, day);
    const cellDate = startOfDay(d);
    if (cellDate > today) continue;

    const dateString = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existingLog = dateMap.get(dateString);
    const isWeekend = d.getDay() === 0;
    const isHoliday = holidayMap.has(dateString);
    const isOnLeave = leaveMap.has(dateString);

    if (existingLog) {
      summary.present++;
      const cls = classifyAttendanceDayForSalary(existingLog, rules, freeGraceUsed);
      freeGraceUsed = cls.freeGraceUsed;
      if (cls.kind === "lateDay") summary.lateDays++;
    } else if (isWeekend) {
      summary.sundays++;
    } else if (isHoliday) {
      summary.holidays++;
    } else if (isOnLeave) {
      summary.leaves++;
    } else {
      summary.absents++;
    }
  }

  return summary;
}
