/**
 * Delhivery B2B track accepts a single numeric LR / waybill (not free-text notes).
 */

export function isDelhiveryB2bLrNumber(value) {
  const s = String(value ?? "").trim();
  return s.length > 0 && /^\d+$/.test(s);
}

/** Delhivery API response when the value is not a valid LR. */
export function isDelhiveryInvalidLrnFetchError(fetchError) {
  return String(fetchError ?? "")
    .trim()
    .toLowerCase() === "invalid lrn";
}

/**
 * Rows to show on Delhivery tracking admin lists (table + LR picker).
 */
export function shouldShowDelhiveryTrackingRow(row) {
  if (!row || typeof row !== "object") return false;
  const lr = String(row.tracking_id ?? row.lr_number ?? "").trim();
  if (!isDelhiveryB2bLrNumber(lr)) return false;
  if (isDelhiveryInvalidLrnFetchError(row.fetch_error)) return false;
  return true;
}
