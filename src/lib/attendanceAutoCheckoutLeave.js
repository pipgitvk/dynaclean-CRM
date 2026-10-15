/** Server helpers: leave-aware system auto check-out times. */

import { AUTO_CHECKOUT_WALL_TIME } from "@/lib/attendanceAutoCheckoutConstants";
import {
  attendanceDateKey,
  leaveDateRangeKeys,
} from "@/lib/leaveDateRange";

export function isLeaveActiveForAutoCheckout(leave) {
  if (!leave) return false;
  const s = String(leave.status ?? "").trim().toLowerCase();
  return s === "pending" || s === "approved";
}

/** @deprecated Use leave-aware resolver; kept for tests / legacy imports. */
export function approvedLeaveBlocksAutoCheckout(leave) {
  if (!leave || leave.status !== "approved") return false;
  const isHalfDay =
    leave.is_half_day == 1 || leave.leave_type === "half-day";
  if (isHalfDay) return true;
  if (leave.leave_type === "paid") return true;
  return false;
}

/** @deprecated */
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

export function findLeaveForUserOnDate(leaves, username, dateYmd) {
  const userKey = String(username ?? "").trim().toLowerCase();
  const dk = attendanceDateKey(dateYmd);
  if (!userKey || !dk) return null;

  for (const leave of leaves || []) {
    if (!isLeaveActiveForAutoCheckout(leave)) continue;
    if (String(leave.username ?? "").trim().toLowerCase() !== userKey) continue;
    for (const d of leaveDateRangeKeys(leave.from_date, leave.to_date)) {
      if (d === dk) return leave;
    }
  }
  return null;
}

/**
 * Resolve system auto check-out for an attendance day.
 * Pending or approved leave → no system auto check-out (rejected leave is ignored).
 *
 * @returns {{ wallTime: string, skipAuto: boolean, leaveStartMinutes: number|null }}
 */
export function resolveAutoCheckoutForAttendanceDay({
  leave,
  dateYmd: _dateYmd,
  scheduleRow: _scheduleRow,
  checkinTime: _checkinTime,
}) {
  const defaultWall = AUTO_CHECKOUT_WALL_TIME;
  if (!leave) {
    return { wallTime: defaultWall, skipAuto: false, leaveStartMinutes: null };
  }

  if (isLeaveActiveForAutoCheckout(leave)) {
    return { wallTime: defaultWall, skipAuto: true, leaveStartMinutes: null };
  }

  return { wallTime: defaultWall, skipAuto: false, leaveStartMinutes: null };
}
