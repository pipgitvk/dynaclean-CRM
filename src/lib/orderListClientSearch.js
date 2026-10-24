/** Digits-only → treat as order ID search (not quotation substring). */
export function isOrderIdDigitSearch(query) {
  const q = String(query ?? "").trim();
  return q.length > 0 && /^\d+$/.test(q);
}

/** Client-side order list text search. */
export function orderMatchesSearchQuery(order, query) {
  const raw = String(query ?? "").trim();
  if (!raw) return true;

  const q = raw.toLowerCase();
  const orderId = String(order?.order_id ?? "").toLowerCase();
  const quote = String(order?.quote_number ?? "").toLowerCase();

  if (isOrderIdDigitSearch(raw)) {
    return orderId.includes(q);
  }

  if (/^quote/i.test(raw.replace(/\s/g, ""))) {
    const compact = q.replace(/\s/g, "");
    return quote.includes(compact);
  }

  const fields = [
    order?.order_id,
    order?.quote_number,
    order?.client_name,
    order?.company_name,
    order?.contact,
    order?.state,
    order?.item_name,
    order?.item_code,
    order?.created_by,
  ];

  return fields.some((field) =>
    String(field ?? "").toLowerCase().includes(q),
  );
}
