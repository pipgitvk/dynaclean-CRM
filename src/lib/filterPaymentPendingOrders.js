import dayjs from "dayjs";

/**
 * Client-side filters for payment-pending report rows (search, due range, overdue tag).
 */
export function filterPaymentPendingOrders(
  orders,
  { searchQuery, dueDateFrom, dueDateTo, statusFilter },
) {
  let filtered = orders || [];

  if (searchQuery?.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (order) =>
        order.order_id?.toLowerCase().includes(query) ||
        order.quote_number?.toLowerCase().includes(query) ||
        order.client_name?.toLowerCase().includes(query) ||
        order.company_name?.toLowerCase().includes(query) ||
        order.contact?.toLowerCase().includes(query) ||
        order.created_by?.toLowerCase().includes(query),
    );
  }

  if (dueDateFrom) {
    filtered = filtered.filter((order) =>
      dayjs(order.due_date).isAfter(dayjs(dueDateFrom).subtract(1, "day"), "day"),
    );
  }
  if (dueDateTo) {
    filtered = filtered.filter((order) =>
      dayjs(order.due_date).isBefore(dayjs(dueDateTo).add(1, "day"), "day"),
    );
  }

  if (statusFilter && statusFilter !== "all") {
    const today = dayjs().startOf("day");
    if (statusFilter === "due") {
      filtered = filtered.filter((order) =>
        dayjs(order.due_date).isBefore(today, "day"),
      );
    } else if (statusFilter === "no-due") {
      filtered = filtered.filter((order) => {
        const orderDate = dayjs(order.due_date).startOf("day");
        return !orderDate.isBefore(today, "day");
      });
    }
  }

  return filtered;
}

export function sortPaymentPendingOrders(orders, sortConfig) {
  if (!sortConfig?.key) return orders;

  return [...orders].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (
      sortConfig.key === "due_date" ||
      sortConfig.key === "next_followup_date"
    ) {
      aVal = dayjs(aVal).unix();
      bVal = dayjs(bVal).unix();
    } else if (
      [
        "total_amount",
        "paid_amount",
        "remaining_amount",
        "deduction_amount",
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
