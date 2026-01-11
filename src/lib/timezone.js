// Timezone conversion utilities
// Handles conversion between IST and UTC based on server timezone

// Check if server is running in UTC (production) or IST (local dev)
const isServerUTC = process.env.SERVER_TIMEZONE === 'UTC' || process.env.NODE_ENV === 'production';

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
