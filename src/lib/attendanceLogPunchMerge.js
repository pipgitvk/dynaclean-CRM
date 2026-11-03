import { attendanceDateKey } from "@/lib/leaveDateRange";
import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import { parseAttendanceClockMinutes } from "@/lib/istDateTime";
import { isAutomaticCheckoutAddress } from "@/lib/attendanceAutoCheckoutConstants";

/**
 * One calendar day can have several attendance_logs rows (CRM app punch and
 * biometric/machine copies). Payroll must use the same punch as the attendance
 * screen: the earlier check-in, and the later real check-out.
 */
function logDateKey(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return attendanceDateKey(value);
}

function isMachineAddress(address) {
  return String(address ?? "").trim().toLowerCase() === "machine";
}

function earlierPunch(current, candidate, timeField) {
  if (!candidate || !isMeaningfulAttendancePunch(candidate[timeField])) return current;
  if (!current) return candidate;
  const nextMin = parseAttendanceClockMinutes(candidate[timeField]);
  const curMin = parseAttendanceClockMinutes(current[timeField]);
  if (nextMin == null) return current;
  if (curMin == null || nextMin < curMin) return candidate;
  return current;
}

function laterPunch(current, candidate, timeField) {
  if (!candidate || !isMeaningfulAttendancePunch(candidate[timeField])) return current;
  if (!current) return candidate;
  const nextMin = parseAttendanceClockMinutes(candidate[timeField]);
  const curMin = parseAttendanceClockMinutes(current[timeField]);
  if (nextMin == null) return current;
  if (curMin == null || nextMin > curMin) return candidate;
  return current;
}

function mergeGroup(rows) {
  if (!rows?.length) return null;
  if (rows.length === 1) return rows[0];

  let earliestIn = null;
  let latestOut = null;
  let latestRealOut = null;
  for (const row of rows) {
    earliestIn = earlierPunch(earliestIn, row, "checkin_time");
    latestOut = laterPunch(latestOut, row, "checkout_time");
    if (!isAutomaticCheckoutAddress(row?.checkout_address)) {
      latestRealOut = laterPunch(latestRealOut, row, "checkout_time");
    }
  }
  const checkoutRow = latestRealOut || latestOut;

  const base =
    rows.find(
      (row) =>
        !isMachineAddress(row?.checkin_address) &&
        !isMachineAddress(row?.checkout_address) &&
        (isMeaningfulAttendancePunch(row?.checkin_time) ||
          isMeaningfulAttendancePunch(row?.checkout_time))
    ) ||
    rows.find(
      (row) =>
        isMeaningfulAttendancePunch(row?.checkin_time) ||
        isMeaningfulAttendancePunch(row?.checkout_time)
    ) ||
    rows[0];

  const merged = { ...base };
  if (earliestIn) {
    merged.checkin_time = earliestIn.checkin_time;
    if (earliestIn.checkin_address) merged.checkin_address = earliestIn.checkin_address;
    if (earliestIn.checkin_latitude != null) merged.checkin_latitude = earliestIn.checkin_latitude;
    if (earliestIn.checkin_longitude != null) merged.checkin_longitude = earliestIn.checkin_longitude;
  }
  if (checkoutRow) {
    merged.checkout_time = checkoutRow.checkout_time;
    merged.checkout_address = checkoutRow.checkout_address ?? merged.checkout_address;
    merged.checkout_latitude = checkoutRow.checkout_latitude ?? null;
    merged.checkout_longitude = checkoutRow.checkout_longitude ?? null;
    if (checkoutRow.auto_checkout_approval_status != null) {
      merged.auto_checkout_approval_status = checkoutRow.auto_checkout_approval_status;
    }
  }
  return merged;
}

/** Collapse duplicate same-day rows to earliest check-in and latest check-out. */
export function mergeSameDayAttendanceLogs(logs) {
  const groups = new Map();
  const order = [];
  for (const log of logs || []) {
    const key = logDateKey(log?.date);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(log);
  }
  return order.map((key) => mergeGroup(groups.get(key))).filter(Boolean);
}
