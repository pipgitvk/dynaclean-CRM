/**
 * Meta Lead Ads: field_data uses question labels as `name` (varies by form).
 * Extract a human-readable product / interest string when present.
 * @param {Array<{ name?: string, values?: string[] }>|null|undefined} fieldData
 * @returns {string}
 */
export function extractProductFromMetaFieldData(fieldData) {
  if (!Array.isArray(fieldData)) return "";
  const getValue = (name) =>
    fieldData.find((f) => f.name === name)?.values?.[0] ?? null;

  const exactKeys = [
    "product",
    "what_product_are_you_interested_in?",
    "what_product_are_you_interested_in",
    "which_product",
    "product_interest",
    "what_are_you_looking_for",
    "select_product",
    "product_you_are_interested_in",
    "which_product_are_you_interested_in?",
  ];
  for (const k of exactKeys) {
    const v = getValue(k);
    if (v != null && String(v).trim()) return String(v).trim();
  }
  for (const f of fieldData) {
    const n = String(f?.name ?? "").toLowerCase();
    if (n.includes("product") && f?.values?.[0]) {
      const v = String(f.values[0]).trim();
      if (v) return v;
    }
  }
  return "";
}

/**
 * Combine form "product" answer with Meta campaign name for storage/display.
 * @param {{ formProduct?: string, campaignName?: string }} args
 * @returns {string}
 */
export function buildProductsInterestLabel({ formProduct, campaignName }) {
  const p = String(formProduct ?? "").trim();
  const c = String(campaignName ?? "").trim();
  if (p && c) return `${p} (${c})`;
  if (p) return p;
  if (c) return c;
  return "";
}
