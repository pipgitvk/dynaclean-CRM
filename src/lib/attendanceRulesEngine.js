import { parseAttendanceClockMinutes } from "@/lib/istDateTime";

/** True when there is no usable clock-out time (null, empty, or unparsable). */
function isMissingCheckoutTime(log) {
  if (log == null) return true;
  const t = log.checkout_time;
  if (t == null) return true;
  if (String(t).trim() === "") return true;
  return parseAttendanceClockMinutes(t) == null;
}

/**
 * Shared attendance rule evaluation (matches previous hardcoded behaviour, driven by API rules).
 * @typedef {Object} AttendanceRulesShape
 * @property {string} checkin — "HH:mm:ss"
 * @property {string} checkout
 * @property {number} gracePeriodMinutes
 * @property {string} halfDayCheckin
 * @property {string} halfDayCheckout
 * @property {string} break_morning_start
 * @property {string} break_lunch_start
 * @property {string} break_evening_start
 * @property {{ morning: number, lunch: number, evening: number }} breakDurations
 * @property {number} breakGracePeriodMinutes
 */

export const DEFAULT_ATTENDANCE_RULES = {
  checkin: "09:30:00",
  checkout: "18:30:00",
  gracePeriodMinutes: 15,
  halfDayCheckin: "10:00:00",
  halfDayCheckout: "18:14:00",
  break_morning_start: "11:15:00",
  break_lunch_start: "13:30:00",
  break_evening_start: "17:45:00",
  breakDurations: {
    morning: 15,
    lunch: 30,
    evening: 15,
  },
  breakGracePeriodMinutes: 5,
};

export function parseTimeToMinutes(t) {
  if (t == null || t === "") return 0;
  const s = String(t).trim();
  const parts = s.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/** Add minutes to a same-day "HH:mm:ss" / "HH:mm" time; wraps past midnight. */
export function addMinutesToTimeString(hhmmss, deltaMin) {
  const s = String(hhmmss ?? "").trim();
  if (!s) return s;
  const base = parseTimeToMinutes(s.slice(0, 8));
  let total = base + Number(deltaMin);
  total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** e.g. "11:46 am" from "11:46:00" */
export function formatTime12h(hhmmss) {
  if (hhmmss == null || hhmmss === "") return "—";
  const s = String(hhmmss).trim().slice(0, 8);
  const parts = s.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

/** Allowed break window as "11:46 am - 12:02 pm" (uses start + duration minutes). */
export function formatBreakWindowRange(startHHMMSS, durationMin) {
  if (
    startHHMMSS == null ||
    startHHMMSS === "" ||
    durationMin == null ||
    Number.isNaN(Number(durationMin))
  ) {
    return "—";
  }
  const start = formatTime12h(startHHMMSS);
  const end = formatTime12h(addMinutesToTimeString(startHHMMSS, Number(durationMin)));
  return `${start} - ${end}`;
}

/** @param {string|null|undefined} logTime ISO / datetime string */
export function getCheckinStatus(logTime, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!logTime) return null;
  const logM = parseAttendanceClockMinutes(logTime);
  if (logM == null) return null;
  const standardM = parseTimeToMinutes(r.checkin);
  const halfDayM = parseTimeToMinutes(r.halfDayCheckin);
  const graceEndM = standardM + r.gracePeriodMinutes;

  if (logM <= standardM) return "onTime";
  if (logM <= graceEndM) return "grace";
  if (halfDayM > graceEndM && logM >= halfDayM) return "halfDay";
  return "late";
}

/** @param {string|null|undefined} logTime */
export function getCheckoutStatus(logTime, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  /* No punch-out → same classification as half-day (see isHalfDayByRules). */
  if (!logTime) return "halfDay";
  const logM = parseAttendanceClockMinutes(logTime);
  if (logM == null) return null;
  const standardM = parseTimeToMinutes(r.checkout);
  const graceStartM = standardM - r.gracePeriodMinutes;
  const halfDayM = parseTimeToMinutes(r.halfDayCheckout);
  if (logM < halfDayM) return "halfDay";
  if (logM < graceStartM) return "late";
  if (logM < standardM) return "grace";
  return "onTime";
}

export function getBreakStatus(startTime, endTime, breakType, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!startTime || !endTime) return null;
  const startM = parseAttendanceClockMinutes(startTime);
  const endM = parseAttendanceClockMinutes(endTime);
  if (startM == null || endM == null) return null;
  const durationMinutes = Math.max(0, endM - startM);
  const allowedDuration = r.breakDurations[breakType];
  const graceLimit = allowedDuration + r.breakGracePeriodMinutes;
  if (durationMinutes <= allowedDuration) return "green";
  if (durationMinutes <= graceLimit) return "yellow";
  return "red";
}

export function classifyAttendanceDay(log, rules, graceHalfDaysUsed) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  const used = Number(graceHalfDaysUsed) || 0;
  const inStatus = getCheckinStatus(log?.checkin_time, r);
  const outStatus = getCheckoutStatus(log?.checkout_time, r);

  // Early checkout should result in half-day, not late-day
  if (outStatus === "halfDay") {
    return { kind: "halfDay", graceHalfDaysUsed: used };
  }
  // Late checkout (after grace period) results in late-day
  if (outStatus === "late") {
    return { kind: "lateDay", graceHalfDaysUsed: used };
  }
  // Grace period check-ins: first 3 are regular, after that late-day
  if (inStatus === "grace") {
    if (used < 3) return { kind: "regular", graceHalfDaysUsed: used + 1 };
    return { kind: "lateDay", graceHalfDaysUsed: used };
  }
  // Late check-in results in late-day
  if (inStatus === "late" || inStatus === "halfDay" || inStatus == null) {
    return { kind: "lateDay", graceHalfDaysUsed: used };
  }
  return { kind: "regular", graceHalfDaysUsed: used };
}

export function classifyAttendanceDayForSalary(log, rules, freeGraceUsed) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  const used = Number(freeGraceUsed) || 0;
  const inStatus = getCheckinStatus(log?.checkin_time, r);
  const outStatus = getCheckoutStatus(log?.checkout_time, r);

  // Early checkout should result in half-day, not late-day
  if (outStatus === "halfDay") {
    return { kind: "halfDay", freeGraceUsed: used };
  }
  // Late checkout (after grace period) results in late-day
  if (outStatus === "late") {
    return { kind: "lateDay", freeGraceUsed: used };
  }
  // Grace period check-ins: first 3 are regular, after that late-day
  if (inStatus === "grace") {
    if (used < 3) return { kind: "regular", freeGraceUsed: used + 1 };
    return { kind: "lateDay", freeGraceUsed: used };
  }
  // Late check-in results in late-day
  if (inStatus === "late" || inStatus === "halfDay" || inStatus == null) {
    return { kind: "lateDay", freeGraceUsed: used };
  }
  return { kind: "regular", freeGraceUsed: used };
}

export function isHalfDayByRules(log, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!log?.checkin_time) return false;
  const inM = parseAttendanceClockMinutes(log.checkin_time);
  if (inM == null) return false;
  /* Check-in but no check-out → half day (salary + cards match admin expectation). */
  if (isMissingCheckoutTime(log)) return true;
  const outM = parseAttendanceClockMinutes(log.checkout_time);
  if (outM == null) return true;
  const halfInM = parseTimeToMinutes(r.halfDayCheckin);
  const halfOutM = parseTimeToMinutes(r.halfDayCheckout);
  // Early checkout always counts as half-day (even if check-in is late)
  if (outM < halfOutM) {
    return true;
  }
  // Late check-in also counts as half-day
  return inM > halfInM;
}

/** Late days summary: only counts grace period check-ins (15 min late), not early checkout */
export function isLateDaySummary(log, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  const inStatus = getCheckinStatus(log?.checkin_time, r);
  // Only count grace period check-ins as late days (early checkout is half-day, not late)
  return inStatus === "late";
}

/**
 * Check if a day is half-day considering grace period (15 min lateness).
 * First 3 grace period days are NOT half-days, after that they are half-days.
 * Missing checkout or early checkout always counts as half-day (even if check-in is late).
 * @param {Object} log - attendance log
 * @param {Object} rules - attendance rules
 * @param {number} graceUsed - number of grace period days already used
 * @returns {Object} { isHalfDay: boolean, graceUsed: number }
 */
export function isHalfDayWithGrace(log, rules, graceUsed = 0) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!log?.checkin_time) return { isHalfDay: false, graceUsed };
  const inM = parseAttendanceClockMinutes(log.checkin_time);
  if (inM == null) return { isHalfDay: false, graceUsed };

  // Check-in but no check-out → half day (regardless of check-in time)
  if (isMissingCheckoutTime(log)) return { isHalfDay: true, graceUsed };

  const outM = parseAttendanceClockMinutes(log.checkout_time);
  if (outM == null) return { isHalfDay: true, graceUsed };

  const halfInM = parseTimeToMinutes(r.halfDayCheckin);
  const halfOutM = parseTimeToMinutes(r.halfDayCheckout);
  const inStatus = getCheckinStatus(log.checkin_time, r);

  // Early checkout (before half-day checkout time) → half day (always, regardless of grace period)
  if (outM < halfOutM) {
    return { isHalfDay: true, graceUsed };
  }

  // Check if it's a grace period arrival (within 15 minutes of standard time)
  if (inStatus === "grace") {
    // First 3 grace period days are NOT half-days
    if (graceUsed < 3) {
      return { isHalfDay: false, graceUsed: graceUsed + 1 };
    }
    // After 3 grace period days, it becomes half-day
    return { isHalfDay: true, graceUsed: graceUsed + 1 };
  }

  // Late check-in (after half-day check-in time) → half day
  return { isHalfDay: inM > halfInM, graceUsed };
}
