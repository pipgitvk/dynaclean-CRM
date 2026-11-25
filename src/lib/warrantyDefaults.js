/** Standard warranty period (months) for all order-based product registrations. */
export const STANDARD_WARRANTY_PERIOD_MONTHS = 12;

/** Warranty term starts on invoice date (fallback: installation_date if already set). */
export function warrantyStartDateFromProduct(product) {
  const install = product?.installation_date;
  if (install != null && String(install).trim() !== "") {
    return String(install).slice(0, 10);
  }
  const inv = product?.invoice_date;
  if (inv != null && String(inv).trim() !== "") {
    return String(inv).slice(0, 10);
  }
  return null;
}