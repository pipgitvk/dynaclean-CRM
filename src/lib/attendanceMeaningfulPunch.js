/**
 * Distinguish real clock punches from MySQL / import placeholders.
 * Used by bulk import, salary pay-days, and attendance timelines.
 */

export function isMeaningfulAttendancePunch(value) {
  if (value == null) return false;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return isMeaningfulAttendancePunch(value.toString("utf8"));
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return false;
    const y = value.getFullYear();
    if (y < 1970 || y > 2100) return false;
    return true;
  }
  const s = String(value).trim();
  if (!s) return false;
  const low = s.toLowerCase();
  if (low === "null" || low === "undefined") return false;
  if (/^0000-00-00/i.test(s)) return false;
  if (/^0{4}-0{2}-0{2}/.test(s)) return false;
  if (/^\d{4}-\d{2}-\d{2}[T ]\s*00:00:00(\.\d+)?(Z)?$/i.test(s)) return false;
  return true;
}

export function rowHasMeaningfulCheckinOrCheckout(row) {
  if (!row) return false;
  return (
    isMeaningfulAttendancePunch(row.checkin_time) ||
    isMeaningfulAttendancePunch(row.checkout_time)
  );
}
