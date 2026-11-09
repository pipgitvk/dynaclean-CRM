export function buildInventorySaleCustomerInfo(orderRow) {
  const o = orderRow || {};
  const customerId =
    o.customer_id != null && String(o.customer_id).trim() !== ""
      ? String(o.customer_id).trim()
      : null;
  const orderId =
    o.order_id != null && String(o.order_id).trim() !== ""
      ? String(o.order_id).trim()
      : null;
  return {
    customer_id: customerId,
    client_name: String(o.client_name || "").trim() || null,
    company_name: String(o.company_name || "").trim() || null,
    order_id: orderId,
    order_link: orderId
      ? `/admin-dashboard/order/${encodeURIComponent(orderId)}`
      : null,
    customer_link: customerId
      ? `/admin-dashboard/view-customer/${encodeURIComponent(customerId)}`
      : null,
  };
}
