/** @param {string} orderId */
export function buildAutoWarrantyFallbackEmail(orderId) {
  const safe = String(orderId || "order")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48);
  return `warranty+${safe || "order"}@auto-register.local`;
}

function pickText(value) {
  if (value == null) return "";
  const s = String(value).trim();
  return s;
}

/**
 * Map dispatch + order row to warranty_products columns (no manual form).
 * @param {Record<string, unknown>} row
 * @param {string} orderId
 */
export function normalizeAutoWarrantyProductRow(row, orderId) {
  const serial = pickText(row.serial_number);
  if (!serial) return null;

  const productName =
    pickText(row.product_name) || pickText(row.model) || "Product";

  const customerName =
    pickText(row.customer_name) || pickText(row.contact_person) || "Customer";

  const contactPerson =
    pickText(row.contact_person) || pickText(row.customer_name) || customerName;

  const invoiceDate = row.invoice_date
    ? String(row.invoice_date).slice(0, 10)
    : row.delivered_on
      ? String(row.delivered_on).slice(0, 10)
      : null;

  return {
    product_name: productName,
    specification: row.specification ?? null,
    model: row.model ?? null,
    serial_number: serial,
    gstin: pickText(row.gstin),
    customer_name: customerName,
    email: pickText(row.email) || buildAutoWarrantyFallbackEmail(orderId),
    contact: pickText(row.contact) || "0",
    customer_address:
      pickText(row.customer_address) ||
      pickText(row.delivery_location) ||
      "—",
    state: pickText(row.state),
    invoice_number: pickText(row.invoice_number) || null,
    invoice_date: invoiceDate,
    contact_person: contactPerson,
  };
}