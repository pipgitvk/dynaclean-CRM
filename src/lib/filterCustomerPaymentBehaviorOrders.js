import dayjs from "dayjs";

export function filterCustomerPaymentBehaviorOrders(
  orders,
  { searchQuery, filterStatus },
) {
  let filtered = orders || [];

  if (filterStatus && filterStatus !== "all") {
    if (filterStatus === "late") {
      filtered = filtered.filter((o) => o.payment_behavior === "late_payment");
    } else if (filterStatus === "missing") {
      filtered = filtered.filter(
        (o) =>
          o.payment_behavior === "missing_payment" ||
          o.payment_behavior === "partial_overdue",
      );
    } else if (filterStatus === "on_time") {
      filtered = filtered.filter((o) => o.payment_behavior === "on_time");
    }
  }

  if (searchQuery?.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (order) =>
        order.order_id?.toLowerCase().includes(query) ||
        order.client_name?.toLowerCase().includes(query) ||
        order.company_name?.toLowerCase().includes(query) ||
        order.contact?.toLowerCase().includes(query) ||
        order.created_by?.toLowerCase().includes(query),
    );
  }

  return filtered;
}

export function sortCustomerPaymentBehaviorOrders(orders, sortConfig) {
  if (!sortConfig?.key) return orders;

  return [...orders].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (["due_date", "payment_date"].includes(sortConfig.key)) {
      aVal = aVal ? dayjs(aVal).unix() : 0;
      bVal = bVal ? dayjs(bVal).unix() : 0;
    } else if (
      [
        "total_amount",
        "paid_amount",
        "remaining_amount",
        "days_overdue",
      ].includes(sortConfig.key)
    ) {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else {
      aVal = (aVal || "").toString().toLowerCase();
      bVal = (bVal || "").toString().toLowerCase();
    }

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });
}
