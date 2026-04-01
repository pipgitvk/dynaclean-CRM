/**
 * India Standard Time (IST) wall-clock strings for attendance storage.
 * Avoids UTC from Date/ISO and MySQL NOW()/CURDATE() when the DB should store local business time.
 */

export const IST_TIMEZONE = "Asia/Kolkata";
const ATTENDANCE_DB_NAIVE_IS_UTC =
  process.env.NEXT_PUBLIC_ATTENDANCE_DB_NAIVE_IS_UTC === "1";

function pad2(n) {
  const x = typeof n === "string" ? parseInt(n, 10) : n;
  if (Number.isNaN(x)) return "00";
  return String(x).padStart(2, "0");
}

/** @param {Date} [date] */
export function getISTDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/** MySQL DATETIME-friendly "YYYY-MM-DD HH:mm:ss" in IST. @param {Date} [date] */
export function getISTDateTimeString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const da = parts.find((p) => p.type === "day")?.value;
  const h = pad2(parts.find((p) => p.type === "hour")?.value ?? 0);
  const min = pad2(parts.find((p) => p.type === "minute")?.value ?? 0);
  const s = pad2(parts.find((p) => p.type === "second")?.value ?? 0);
  return `${y}-${mo}-${da} ${h}:${min}:${s}`;
}

function getISTHourMinuteFromDate(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { h, m };
}

/** Parse MySQL DATETIME-like string as UTC instant (for UTC-stored DB). */
function parseNaiveDateTimeAsUtcDate(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const mi = parseInt(m[5], 10);
  const sec = parseInt(m[6] ?? "0", 10);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
}

/**
 * Minutes from midnight for rule checks.
 * - Naive "YYYY-MM-DD HH:mm:ss" is interpreted as wall-clock by default.
 * - Set NEXT_PUBLIC_ATTENDANCE_DB_NAIVE_IS_UTC=1 to treat naive values as UTC.
 * - ISO strings with Z/offset are also converted to IST clock.
 * @param {string|Date|null|undefined} value
 * @returns {number|null}
 */
export function parseAttendanceClockMinutes(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const { h, m } = getISTHourMinuteFromDate(value);
    return h * 60 + m;
  }
  const s = String(value).trim();
  const naiveUtcDate = parseNaiveDateTimeAsUtcDate(s);
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  if (naiveUtcDate && !hasExplicitTz) {
    if (!ATTENDANCE_DB_NAIVE_IS_UTC) {
      const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (m) return parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    }
    const { h, m } = getISTHourMinuteFromDate(naiveUtcDate);
    return h * 60 + m;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const { h, m } = getISTHourMinuteFromDate(d);
  return h * 60 + m;
}

/**
 * Display attendance DATETIME in UI.
 * - Naive MySQL strings are rendered as wall-clock by default.
 * - Set NEXT_PUBLIC_ATTENDANCE_DB_NAIVE_IS_UTC=1 to treat naive values as UTC.
 * - Values with explicit timezone are also rendered in IST.
 * @param {string|Date|null|undefined} value
 * @returns {string}
 */
export function formatAttendanceTimeForDisplay(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  if (!hasExplicitTz && !ATTENDANCE_DB_NAIVE_IS_UTC) {
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const h = parseInt(m[2], 10);
      const min = parseInt(m[3], 10);
      const h12 = h % 12 || 12;
      const period = h >= 12 ? "pm" : "am";
      return `${String(h12).padStart(2, "0")}:${String(min).padStart(2, "0")} ${period}`;
    }
  }
  const d = !hasExplicitTz
    ? parseNaiveDateTimeAsUtcDate(s)
    : value instanceof Date
      ? value
      : new Date(value);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
