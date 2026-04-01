/**
 * India Standard Time (IST) wall-clock strings for attendance storage.
 * Avoids UTC from Date/ISO and MySQL NOW()/CURDATE() when the DB should store local business time.
 */

export const IST_TIMEZONE = "Asia/Kolkata";

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

/**
 * Minutes from midnight for rule checks. Naive "YYYY-MM-DD HH:mm:ss" is treated as IST wall clock.
 * ISO strings with Z/offset use that instant, then read clock in Asia/Kolkata.
 * @param {string|Date|null|undefined} value
 * @returns {number|null}
 */
export function parseAttendanceClockMinutes(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: IST_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(value);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return h * 60 + m;
  }
  const s = String(value).trim();
  const naive = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  if (naive && !hasExplicitTz) {
    const h = parseInt(naive[2], 10);
    const m = parseInt(naive[3], 10);
    return h * 60 + m;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return h * 60 + m;
}

/**
 * Display attendance DATETIME in UI. Naive MySQL strings are shown as stored wall clock (no UTC→IST double shift).
 * Values with explicit timezone are formatted in Asia/Kolkata.
 * @param {string|Date|null|undefined} value
 * @returns {string}
 */
export function formatAttendanceTimeForDisplay(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  if (!hasExplicitTz) {
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      let h = parseInt(m[2], 10);
      const min = parseInt(m[3], 10);
      const h12 = h % 12 || 12;
      const period = h >= 12 ? "pm" : "am";
      return `${String(h12).padStart(2, "0")}:${String(min).padStart(2, "0")} ${period}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
