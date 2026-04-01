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
