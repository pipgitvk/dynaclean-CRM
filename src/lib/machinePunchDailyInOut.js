import {
  parseAttendanceClockMinutes,
  parseAttendanceDateTime,
} from "@/lib/istDateTime";

const NOON_IST_MINUTES = 12 * 60;

/**
 * Last punch before 12:00 PM IST is not check-out (e.g. two morning scans).
 */
export function machinePunchIsEligibleAsCheckout(punchDatetime) {
  const mins = parseAttendanceClockMinutes(punchDatetime);
  if (mins == null) return false;
  return mins >= NOON_IST_MINUTES;
}

/**
 * @param {string[]} punchDatetimes sorted not required — MySQL daily punch list
 */
export function resolveMachineDailyCheckInOut(punchDatetimes) {
  const sorted = (punchDatetimes || [])
    .map((raw) => {
      const d = parseAttendanceDateTime(raw);
      return d ? { raw, t: d.getTime() } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);

  if (!sorted.length) {
    return { checkInDatetime: null, checkOutDatetime: null };
  }

  const checkInDatetime = sorted[0].raw;
  let checkOutDatetime = null;
  if (sorted.length > 1) {
    const last = sorted[sorted.length - 1];
    if (machinePunchIsEligibleAsCheckout(last.raw)) {
      checkOutDatetime = last.raw;
    }
  }

  return { checkInDatetime, checkOutDatetime };
}