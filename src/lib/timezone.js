// Timezone conversion utilities
// Handles conversion between IST and UTC based on server timezone

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// Check if server is running in UTC (production) or IST (local dev)
const isServerUTC = process.env.SERVER_TIMEZONE === 'UTC' || process.env.NODE_ENV === 'production';

/** IST offset (+05:30) in minutes — used for display only (India has no DST). */
const IST_OFFSET_MINUTES = 330;

/**
 * True when `customers_followup` / TL follow-up MySQL datetimes are stored as UTC
 * (matches `convertISTtoUTC` in this file). Client bundles only see NODE_ENV unless
 * NEXT_PUBLIC_* is set, so this mirrors production behaviour for deployed users.
 */
export function isCrmDbStoredUtc() {
  if (typeof process === 'undefined' || !process.env) return true;
  return process.env.SERVER_TIMEZONE === 'UTC' || process.env.NODE_ENV === 'production';
}

/**
 * Parse a CRM datetime for display/sort: naive strings are UTC wall-clock when DB
 * stores UTC; otherwise treated as local wall-clock (typical local dev).
 */
export function parseCrmDatetimeToDayjs(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  if (hasExplicitTz) {
    return dayjs(s);
  }
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  if (isCrmDbStoredUtc()) {
    return dayjs.utc(normalized);
  }
  return dayjs(normalized);
}

/**
 * Format follow-up / next-follow-up / external ISO datetimes for the UI in IST.
 * Use for fields saved via `convertISTtoUTC` in production.
 */
export function formatCrmDatetimeForISTDisplay(value, format = 'DD MMM, YYYY hh:mm A') {
  const d = parseCrmDatetimeToDayjs(value);
  if (!d || !d.isValid()) return '';
  return d.utcOffset(IST_OFFSET_MINUTES).format(format);
}

/** Format an instant already parsed with {@link parseCrmDatetimeToDayjs} (e.g. from TL pick helpers) for IST display. */
export function formatCrmDayjsForISTDisplay(d, format = 'DD MMM, YYYY HH:mm') {
  if (!d || !d.isValid()) return '';
  return d.utcOffset(IST_OFFSET_MINUTES).format(format);
}

/** Calendar day key (YYYY-MM-DD) in IST — for grouping rows. */
export function getCrmDateKeyIST(value) {
  const d = parseCrmDatetimeToDayjs(value);
  if (!d || !d.isValid()) return 'no-date';
  return d.utcOffset(IST_OFFSET_MINUTES).format('YYYY-MM-DD');
}

/** Epoch ms for sorting (latest first). */
export function getCrmInstantMs(value) {
  const d = parseCrmDatetimeToDayjs(value);
  return d && d.isValid() ? d.valueOf() : 0;
}

function toMysqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Convert an IST date/datetime string to UTC (MySQL DATETIME)
 * Accepts:
 * - "YYYY-MM-DDTHH:mm" (from <input type="datetime-local">)
 * - "YYYY-MM-DD HH:mm" (space separated)
 * - "YYYY-MM-DD" (date only; assumed 00:00 in IST)
 * - Any ISO string that already contains a timezone offset or Z
 */
export function convertISTtoUTC(istDatetimeString) {
  if (!istDatetimeString) return null;

  // If server isn't in UTC, avoid shifting time; just normalize formatting
  if (!isServerUTC) {
    const s = String(istDatetimeString).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s + ' 00:00:00';
    }
    const normalized = s.replace(' ', 'T');
    // Append seconds if missing (from datetime-local which is HH:mm)
    const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
      ? normalized + ':00'
      : normalized;
    return withSeconds.replace('T', ' ');
  }

  // Build an ISO string with explicit IST offset when needed
  const raw = String(istDatetimeString).trim();
  let isoLike = raw;

  // Already has timezone (e.g., Z or +05:30)? Use as-is
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      // Date only -> assume 00:00:00 in IST
      isoLike = `${raw}T00:00:00+05:30`;
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) {
      // Space separated datetime without seconds
      const t = raw.replace(' ', 'T');
      isoLike = `${t}:00+05:30`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
      // datetime-local without seconds
      isoLike = `${raw}:00+05:30`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
      // datetime-local with seconds
      isoLike = `${raw}+05:30`;
    } else {
      // Fallback: try to coerce space to T and append IST
      isoLike = `${raw.replace(' ', 'T')}`;
      if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(isoLike)) {
        isoLike += '+05:30';
      }
    }
  }

  const d = new Date(isoLike);
  if (isNaN(d.getTime())) {
    // Gracefully return null on invalid inputs to avoid RangeError
    return null;
  }
  return toMysqlDateTime(d);
}

/**
 * MySQL DATETIME bounds for filtering UTC-stored CRM timestamps by IST calendar day(s).
 * HTML date inputs send YYYY-MM-DD meaning "that calendar day in India", not UTC midnight.
 * Without this, BETWEEN 'YYYY-MM-DD 00:00:00' and '... 23:59:59' wrongly includes rows that
 * display as the next IST day (e.g. 22:xx UTC on "Apr 17" still shows Apr 18 in IST).
 *
 * @param {string} fromYmd - YYYY-MM-DD
 * @param {string} toYmd - YYYY-MM-DD
 * @returns {{ start: string, end: string } | null}
 */
export function mysqlBoundsForIstDateRange(fromYmd, toYmd) {
  const a = String(fromYmd || "").trim();
  const b = String(toYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
    return null;
  }
  const start = convertISTtoUTC(a);
  const end = convertISTtoUTC(`${b} 23:59:59`);
  if (!start || !end) return null;
  return { start, end };
}

/** Lower bound: start of IST day as stored MySQL UTC (or naive in local dev). */
export function mysqlLowerBoundIstDayStart(fromYmd) {
  const a = String(fromYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a)) return null;
  return convertISTtoUTC(a);
}

/** Upper bound: end of IST day as stored MySQL UTC (or naive in local dev). */
export function mysqlUpperBoundIstDayEnd(toYmd) {
  const b = String(toYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  return convertISTtoUTC(`${b} 23:59:59`);
}

/**
 * No conversion when fetching from database
 * Return data as-is - let the frontend/display handle timezone if needed
 */
/**
 * Get the current time in IST (Asia/Kolkata)
 * Returns { hour, minute }
 */
export function getCurrentISTTime() {
  const d = new Date();
  const options = {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(d);

  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);

  return { hour, minute };
}
