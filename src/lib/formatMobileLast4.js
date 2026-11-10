/** Last 4 digits of phone/contact for limited display (e.g. warehouse incharge). */
export function formatMobileLast4(contact) {
  const digits = String(contact ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length <= 4) return digits;
  return digits.slice(-4);
}

/** Mask leading digits with asterisks; show last 4 (e.g. `******3210`). */
export function formatMobileMaskedLast4(contact) {
  const digits = String(contact ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length <= 4) return digits;
  const last4 = digits.slice(-4);
  const maskCount = digits.length >= 10 ? 6 : digits.length - 4;
  return `${"*".repeat(maskCount)}${last4}`;
}
