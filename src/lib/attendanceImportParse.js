/**
 * Shared parsing for HR attendance bulk import (CSV / Excel).
 */

const CANONICAL_HEADERS = new Set([
  "username",
  "date",
  "checkin_time",
  "checkout_time",
  "break_morning_start",
  "break_morning_end",
  "break_lunch_start",
  "break_lunch_end",
  "break_evening_start",
  "break_evening_end",
  "checkin_address",
  "checkout_address",
]);

const HEADER_ALIASES = {
  user: "username",
  checkin: "checkin_time",
  checkout: "checkout_time",
  "check-in": "checkin_time",
  "check-out": "checkout_time",
  checkinaddress: "checkin_address",
  checkoutaddress: "checkout_address",
  checkin_ad: "checkin_address",
  checkin_addr: "checkin_address",
  checkout_ad: "checkout_address",
  checkout_addr: "checkout_address",
  checkout_t: "checkout_time",
};

/** Excel duplicate truncated headers → start/end pairs (two adjacent same tokens). */
const BREAK_PAIR_TOKENS = {
  break_morn: ["break_morning_start", "break_morning_end"],
  break_lunc: ["break_lunch_start", "break_lunch_end"],
  break_ever: ["break_evening_start", "break_evening_end"],
};

export function normalizeImportHeaderCell(h) {
  const s = String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!s) return "";
  if (CANONICAL_HEADERS.has(s)) return s;
  if (HEADER_ALIASES[s]) return HEADER_ALIASES[s];
  if (s === "break_morn" || s === "break_morning") return "break_morn";
  if (s === "break_lunc" || s === "break_lunch") return "break_lunc";
  if (s === "break_ever" || s === "break_evening") return "break_ever";
  return s;
}

export function disambiguatePairHeaders(headers) {
  const out = headers.slice();
  for (let i = 0; i < out.length - 1; i++) {
    const pair = BREAK_PAIR_TOKENS[out[i]];
    if (pair && out[i + 1] === out[i]) {
      out[i] = pair[0];
      out[i + 1] = pair[1];
      i++;
    }
  }
  return out;
}

/** Excel serial day → YYYY-MM-DD (UTC; matches typical xlsx day serials). */
function excelSerialToYmd(serial) {
  const n = Math.floor(Number(serial));
  if (!Number.isFinite(n) || n < 1 || n > 10000000) return "";
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  if (y < 1980 || y > 2110) return "";
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {string|number|Date|null|undefined} value
 * @returns {string} YYYY-MM-DD or "" if invalid / empty
 */

export function parseImportDateToYmd(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 59 && value < 2000000) {
      const ymd = excelSerialToYmd(value);
      if (ymd) return ymd;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const t = String(value).trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d+(\.\d+)?$/.test(t)) {
    const ymd = excelSerialToYmd(parseFloat(t));
    if (ymd) return ymd;
  }

  const slash = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (slash) {
    const a = parseInt(slash[1], 10);
    const b = parseInt(slash[2], 10);
    const y = slash[3];
    let day;
    let month;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return "";
}
