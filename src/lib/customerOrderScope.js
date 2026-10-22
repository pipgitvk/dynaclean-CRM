/**
 * Match orders to a CRM customer: direct neworder.customer_id OR quotation link.
 * Legacy rows often have customer_id NULL on neworder but quote_number → quotations_records.customer_id.
 */
export function sqlCustomerOrderBelongsToCustomer(noAlias = "no", qrAlias = "qr") {
  return `(CAST(${noAlias}.customer_id AS CHAR) = ? OR CAST(${qrAlias}.customer_id AS CHAR) = ?)`;
}

export function customerOrderMatchParams(customerId) {
  const id = String(customerId ?? "").trim();
  return [id, id];
}
