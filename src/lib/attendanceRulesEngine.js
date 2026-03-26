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
  const logDate = new Date(logTime);
  if (Number.isNaN(logDate.getTime())) return null;
  const logM = logDate.getHours() * 60 + logDate.getMinutes();
  const standardM = parseTimeToMinutes(r.checkin);
  const graceEndM = standardM + r.gracePeriodMinutes;
  const halfDayM = parseTimeToMinutes(r.halfDayCheckin);
  if (logM <= standardM) return "onTime";
  if (logM <= graceEndM) return "grace";
  if (logM < halfDayM) return "late";
  return "halfDay";
}

/** @param {string|null|undefined} logTime */
export function getCheckoutStatus(logTime, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!logTime) return null;
  const logDate = new Date(logTime);
  if (Number.isNaN(logDate.getTime())) return null;
  const logM = logDate.getHours() * 60 + logDate.getMinutes();
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
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMinutes = Math.floor((end - start) / (1000 * 60));
  const allowedDuration = r.breakDurations[breakType];
  const graceLimit = allowedDuration + r.breakGracePeriodMinutes;
  if (durationMinutes <= allowedDuration) return "green";
  if (durationMinutes <= graceLimit) return "yellow";
  return "red";
}

export function isHalfDayByRules(log, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!log?.checkin_time || !log?.checkout_time) return false;
  const logDateIn = new Date(log.checkin_time);
  const logDateOut = new Date(log.checkout_time);
  const inM = logDateIn.getHours() * 60 + logDateIn.getMinutes();
  const outM = logDateOut.getHours() * 60 + logDateOut.getMinutes();
  const halfInM = parseTimeToMinutes(r.halfDayCheckin);
  const halfOutM = parseTimeToMinutes(r.halfDayCheckout);
  /* Matches former isLate(checkin, halfDayCheckin) || isEarly(checkout, halfDayCheckout) */
  return inM > halfInM || outM < halfOutM;
}

/** Same as former isLate(checkin) || isEarly(checkout) against standard times (summary “late days”). */
export function isLateDaySummary(log, rules) {
  const r = rules || DEFAULT_ATTENDANCE_RULES;
  if (!log?.checkin_time || !log?.checkout_time) return false;
  const inM =
    new Date(log.checkin_time).getHours() * 60 +
    new Date(log.checkin_time).getMinutes();
  const outM =
    new Date(log.checkout_time).getHours() * 60 +
    new Date(log.checkout_time).getMinutes();
  const standardIn = parseTimeToMinutes(r.checkin);
  const standardOut = parseTimeToMinutes(r.checkout);
  return inM > standardIn || outM < standardOut;
}
