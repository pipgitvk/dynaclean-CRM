/** Shared dispatch form / complete rules for serial numbers. */

export function isProductItem(itemCode) {
  return /[a-zA-Z]/.test(String(itemCode || ""));
}

export function isServiceCharge(itemName, itemCode) {
  if (!itemName && !itemCode) return false;
  const name = String(itemName || "").toLowerCase();
  const code = String(itemCode || "").toLowerCase();
  return (
    name.includes("camc") ||
    name.includes("amc") ||
    name.includes("charges") ||
    name.includes("service") ||
    name.includes("labour") ||
    name.includes("installation") ||
    code.includes("camc") ||
    code.includes("amc") ||
    code.includes("charges") ||
    code.includes("service")
  );
}

/** Physical product rows that need a serial before dispatch complete. */
export function dispatchRowRequiresSerial(row) {
  if (!row) return false;
  if (!isProductItem(row.item_code)) return false;
  if (isServiceCharge(row.item_name, row.item_code)) return false;
  return true;
}

export function rowsMissingSerial(rows) {
  return (rows || []).filter(
    (r) =>
      dispatchRowRequiresSerial(r) &&
      !String(r.serial_no || "").trim(),
  );
}

export function formatMissingSerialError(rows) {
  const missing = rowsMissingSerial(rows);
  if (!missing.length) return null;
  const labels = missing.map(
    (r, i) => r.item_name || r.item_code || `Item ${i + 1}`,
  );
  if (labels.length === 1) {
    return `Please fill serial number for: ${labels[0]}`;
  }
  return `Please fill serial numbers for all product items (${labels.length} pending): ${labels.join(", ")}`;
}
