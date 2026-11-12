/** Load order / quote / invoice context for an AMC-CMC serial (dispatch → neworder). */
export async function fetchAmcOrderBySerial(serial) {
  const sn = String(serial || "").trim();
  if (!sn) {
    return { fetched: false, payload: null };
  }

  const res = await fetch(
    `/api/amc-cmc/order-by-serial?serial=${encodeURIComponent(sn)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not load order details");
  }
  const data = await res.json();
  return { fetched: true, payload: data };
}

/** Load order head + all dispatched serials for an order id. */
export async function fetchAmcOrderByOrderId(orderId) {
  const oid = String(orderId || "").trim();
  if (!oid) {
    return { fetched: false, payload: null };
  }

  const res = await fetch(
    `/api/amc-cmc/order-by-order-id?order_id=${encodeURIComponent(oid)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not load order");
  }
  const data = await res.json();
  return { fetched: true, payload: data };
}

/** Merge warranty suggestion + optional order lookup into AMC/CMC add form state. */
export function applySerialLookupToAmcForm(prev, { suggestion, orderPayload }) {
  const next = { ...prev };

  if (suggestion) {
    next.serial_number = suggestion.serial_number || next.serial_number;
    next.model = suggestion.model || next.model;
    next.company_name = suggestion.customer_name || next.company_name;
    next.contact = suggestion.contact || next.contact;
    next.email = suggestion.email || next.email;
    next.company_address = suggestion.customer_address || next.company_address;
  }

  const order = orderPayload?.found ? orderPayload.order : null;
  if (order) {
    if (order.serial_number) {
      next.serial_number = order.serial_number;
    }
    if (order.model) next.model = order.model;
    if (order.company_name) next.company_name = order.company_name;
    if (order.contact) next.contact = order.contact;
    if (order.email) next.email = order.email;
    if (order.company_address) next.company_address = order.company_address;
    if (order.delivery_location && !next.site_address) {
      next.site_address = order.delivery_location;
    }
    if (order.quote_number) {
      next.quotation_ref = order.quote_number;
    }
  }

  return next;
}
