import dayjs from "dayjs";

function orderDueDayjs(order) {
  const raw = order?.due_date ?? order?.duedate;
  if (raw == null || raw === "") return null;
  const d = dayjs(raw);
  return d.isValid() ? d.startOf("day") : null;
}

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

  const fromDay = dueDateFrom ? dayjs(dueDateFrom).startOf("day") : null;
  const toDay = dueDateTo ? dayjs(dueDateTo).startOf("day") : null;

  if (fromDay?.isValid()) {
    filtered = filtered.filter((order) => {
      const due = orderDueDayjs(order);
      if (!due) return false;
      return !due.isBefore(fromDay, "day");
    });
  }
  if (toDay?.isValid()) {
    filtered = filtered.filter((order) => {
      const due = orderDueDayjs(order);
      if (!due) return false;
      return !due.isAfter(toDay, "day");
    });
  }

  if (statusFilter && statusFilter !== "all") {
    const today = dayjs().startOf("day");
    if (statusFilter === "due") {
      filtered = filtered.filter((order) => {
        const due = orderDueDayjs(order);
        return due != null && due.isBefore(today, "day");
      });
    } else if (statusFilter === "no-due") {
      filtered = filtered.filter((order) => {
        const due = orderDueDayjs(order);
        return due != null && !due.isBefore(today, "day");
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

/** Indian currency for payment-pending report (matches order list). */
export function formatPaymentPendingInr(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function summarizePaymentPendingOrders(orders) {
  const list = orders || [];
  return {
    count: list.length,
    totalRemaining: list.reduce(
      (sum, o) => sum + (Number(o.remaining_amount) || 0),
      0,
    ),
    totalOrderValue: list.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0,
    ),
    totalPaid: list.reduce((sum, o) => sum + (Number(o.paid_amount) || 0), 0),
  };
}
