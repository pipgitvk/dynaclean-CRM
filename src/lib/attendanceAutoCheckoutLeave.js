/** Server helpers: half-day leave days must not get system auto check-out. */

function attendanceDateKey(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA");
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function leaveDateRangeKeys(fromDate, toDate) {
  const from = attendanceDateKey(fromDate);
  const to = attendanceDateKey(toDate);
  if (!from || !to) return [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const keys = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    keys.push(d.toLocaleDateString("en-CA"));
  }
  return keys;
}

/**
 * Matches empcrm admin attendance: half-day leave, or paid leave on a day the employee punched in.
 */
export function approvedLeaveBlocksAutoCheckout(leave) {
  if (!leave || leave.status !== "approved") return false;
  const isHalfDay =
    leave.is_half_day == 1 || leave.leave_type === "half-day";
  if (isHalfDay) return true;
  if (leave.leave_type === "paid") return true;
  return false;
}

/** Set of `username|yyyy-mm-dd` (username lowercased). */
export function buildAutoCheckoutSkipKeySet(leaves) {
  const set = new Set();
  for (const leave of leaves || []) {
    if (!approvedLeaveBlocksAutoCheckout(leave)) continue;
    const userKey = String(leave.username ?? "").trim().toLowerCase();
    if (!userKey) continue;
    for (const dateYmd of leaveDateRangeKeys(leave.from_date, leave.to_date)) {
      set.add(`${userKey}|${dateYmd}`);
    }
  }
  return set;
}

export function autoCheckoutSkipKey(username, dateYmd) {
  const userKey = String(username ?? "").trim().toLowerCase();
  const dk = attendanceDateKey(dateYmd);
  if (!userKey || !dk) return "";
  return `${userKey}|${dk}`;
}
