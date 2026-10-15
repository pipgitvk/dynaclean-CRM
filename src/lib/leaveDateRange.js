/**
 * Calendar YYYY-MM-DD for leaves/holidays/attendance (IST, no UTC drift).
 */

import dayjs from "dayjs";
import { getISTDateString } from "@/lib/istDateTime";

export function attendanceDateKey(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const prefix = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (prefix && !/[T\s]/.test(s)) return prefix[1];
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) return getISTDateString(parsed);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getISTDateString(value);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return getISTDateString(parsed);
  return "";
}

/** Inclusive YYYY-MM-DD between from_date and to_date (calendar days). */
export function leaveDateRangeKeys(fromDate, toDate) {
  const from = attendanceDateKey(fromDate);
  const to = attendanceDateKey(toDate);
  if (!from || !to) return [];

  let cur = dayjs(from, "YYYY-MM-DD", true);
  const end = dayjs(to, "YYYY-MM-DD", true);
  if (!cur.isValid() || !end.isValid()) return [];

  const keys = [];
  while (cur.isBefore(end) || cur.isSame(end, "day")) {
    keys.push(cur.format("YYYY-MM-DD"));
    cur = cur.add(1, "day");
  }
  return keys;
}
