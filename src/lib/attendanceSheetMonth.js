import { isHalfDayWithGrace } from "@/lib/attendanceRulesEngine";
import { rowHasMeaningfulCheckinOrCheckout } from "@/lib/attendanceMeaningfulPunch";
import { weeklyOffSundayCountsAsPaid, dateToYmdKey } from "@/lib/salaryPayDaysFromAttendance";
import { formatDojDisplay, pickDateOfJoining } from "@/lib/employeeProfileLookup";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function calendarMonthMeta(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return null;
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthIndex = m - 1;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const to = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const monthName = new Date(y, monthIndex, 1).toLocaleString("en-IN", { month: "long" });
  const fyStart = m >= 4 ? y : y - 1;
  const fyEnd = fyStart + 1;
  const days = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, monthIndex, day);
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({
      day,
      ymd,
      dow: DOW[d.getDay()],
      isSunday: d.getDay() === 0,
    });
  }
  return {
    year: y,
    month: m,
    monthName,
    monthLabel: monthName.toUpperCase(),
    from,
    to,
    daysInMonth,
    days,
    dateFromDisplay: `01-${monthName.slice(0, 3)}`,
    dateToDisplay: `${String(daysInMonth).padStart(2, "0")}-${monthName.slice(0, 3)}`,
    fiscalYear: `${fyStart}-${fyEnd}`,
  };
}

function buildLeaveMaps(leaves, username) {
  const leaveMap = new Map();
  const paidLeaveMap = new Map();
  for (const leave of leaves || []) {
    if (String(leave.username) !== String(username)) continue;
    const fromD = new Date(leave.from_date);
    const toD = new Date(leave.to_date);
    for (let d = new Date(fromD); d <= toD; d.setDate(d.getDate() + 1)) {
      const k = d.toLocaleDateString("en-CA");
      leaveMap.set(k, leave);
      if (String(leave.leave_type) === "paid") paidLeaveMap.set(k, leave);
    }
  }
  return { leaveMap, paidLeaveMap };
}

/** Approved leave → L; unpaid → A */
function leaveCode(leave) {
  if (!leave) return "A";
  const t = String(leave.leave_type || "").toLowerCase();
  if (t === "unpaid") return "A";
  return "L";
}

/**
 * @returns {{ code: string, kind: 'present'|'half'|'absent'|'leave'|'holiday'|'sunday'|'empty' }}
 */
export function classifyAttendanceSheetDay(ctx) {
  const {
    ymd,
    log,
    holidayMap,
    leaveMap,
    paidLeaveMap,
    rules,
    dateMap,
    graceHalfDaysUsed,
  } = ctx;

  const d = new Date(ymd + "T12:00:00");
  const isSunday = d.getDay() === 0;
  const isHoliday = holidayMap.has(ymd);
  const hasRealPunch = rowHasMeaningfulCheckinOrCheckout(log);
  const approvedPaidLeave = paidLeaveMap.get(ymd);

  if (approvedPaidLeave) {
    const leaveIsHalfDay =
      approvedPaidLeave.is_half_day == 1 || approvedPaidLeave.leave_type === "half-day";
    const treatAsHalfDay = hasRealPunch || leaveIsHalfDay;
    if (treatAsHalfDay) return { code: "HD", kind: "half" };
    return { code: "L", kind: "leave" };
  }

  if (log && hasRealPunch) {
    const { isHalfDay, graceUsed } = isHalfDayWithGrace(log, rules, graceHalfDaysUsed);
    if (isHalfDay) return { code: "HD", kind: "half", graceHalfDaysUsed: graceUsed };
    return { code: "P", kind: "present", graceHalfDaysUsed: graceUsed };
  }

  if (isHoliday) return { code: "H", kind: "holiday" };

  if (isSunday) {
    const paidWeeklyOff = weeklyOffSundayCountsAsPaid(ymd, { holidayMap, dateMap });
    if (paidWeeklyOff) return { code: "S", kind: "sunday" };
    return { code: "A", kind: "absent" };
  }

  const leaveInfo = leaveMap.get(ymd);
  if (leaveInfo) {
    const leaveIsHalfDay =
      leaveInfo.is_half_day == 1 || leaveInfo.leave_type === "half-day";
    if (leaveIsHalfDay) return { code: "HD", kind: "half" };
    return { code: leaveCode(leaveInfo), kind: "leave" };
  }

  return { code: "A", kind: "absent" };
}

function countTowardTotalPresent(code) {
  if (code === "P" || code === "L") return 1;
  if (code === "HD") return 0.5;
  return 0;
}

export function buildEmployeeAttendanceSheetRow({
  meta,
  username,
  displayName,
  profile,
  emp,
  logs,
  holidays,
  leaves,
  rules,
}) {
  const holidayMap = new Map();
  for (const h of holidays || []) {
    const k = dateToYmdKey(h.holiday_date);
    if (k) holidayMap.set(k, h);
  }

  const dateMap = new Map();
  for (const log of logs || []) {
    const k = dateToYmdKey(log.date);
    if (k) dateMap.set(k, log);
  }

  const { leaveMap, paidLeaveMap } = buildLeaveMaps(leaves, username);
  let graceHalfDaysUsed = 0;
  const cells = [];
  let totalPresent = 0;

  for (const dayCol of meta.days) {
    const log = dateMap.get(dayCol.ymd);
    const ctx = {
      ymd: dayCol.ymd,
      log,
      holidayMap,
      leaveMap,
      paidLeaveMap,
      rules,
      dateMap,
      graceHalfDaysUsed,
    };
    const classified = classifyAttendanceSheetDay(ctx);
    const { code, kind } = classified;
    if (classified.graceHalfDaysUsed != null) {
      graceHalfDaysUsed = classified.graceHalfDaysUsed;
    }
    cells.push({
      day: dayCol.day,
      ymd: dayCol.ymd,
      code,
      kind: dayCol.isSunday && kind === "sunday" ? "sunday" : kind,
      isSunday: dayCol.isSunday,
    });
    totalPresent += countTowardTotalPresent(code);
  }

  const doj = pickDateOfJoining(profile);
  let dobDisplay = "";
  if (profile?.date_of_birth) {
    dobDisplay = formatDojDisplay(profile.date_of_birth);
  }

  return {
    username,
    name: displayName || username,
    date_of_birth_display: dobDisplay,
    date_of_joining_display: doj ? formatDojDisplay(doj) : "",
    designation: emp?.userRole || emp?.userDepartment || profile?.designation || "",
    cells,
    total_present: totalPresent % 1 === 0 ? totalPresent : Number(totalPresent.toFixed(1)),
  };
}
