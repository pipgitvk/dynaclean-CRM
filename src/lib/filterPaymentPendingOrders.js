import dayjs from "dayjs";

function orderDueDayjs(order) {
  const raw = order?.due_date ?? order?.duedate;
  if (raw == null || raw === "") return null;
  const d = dayjs(raw);
  return d.isValid() ? d.startOf("day") : null;
}

/** Days past due (0 = due today). Negative = not yet due. Null if no due date. */
export function getPaymentPendingDaysOverdue(order) {
  const due = orderDueDayjs(order);
  if (!due) return null;
  const today = dayjs().startOf("day");
  return today.diff(due, "day");
}

export const PAYMENT_PENDING_AGING_OPTIONS = [
  { value: "", label: "All aging" },
  { value: "not-due", label: "Not Due" },
  { value: "0-7", label: "0–7 Days" },
  { value: "8-30", label: "8–30 Days" },
  { value: "31-60", label: "31–60 Days" },
  { value: "61-90", label: "61–90 Days" },
  { value: "90+", label: "90+ Days" },
];

export const PAYMENT_PENDING_AMOUNT_OPTIONS = [
  { value: "", label: "All amounts" },
  { value: "lt10k", label: "< ₹10K" },
  { value: "10k-50k", label: "₹10–50K" },
  { value: "50k-1l", label: "₹50K–1L" },
  { value: "1l-5l", label: "₹1–5L" },
  { value: "gt5l", label: "> ₹5L" },
];

function matchesPaymentPendingAging(order, agingFilter) {
  if (!agingFilter) return true;
  const overdue = getPaymentPendingDaysOverdue(order);
  if (overdue === null) return false;
  switch (agingFilter) {
    case "not-due":
      return overdue < 0;
    case "0-7":
      return overdue >= 0 && overdue <= 7;
    case "8-30":
      return overdue >= 8 && overdue <= 30;
    case "31-60":
      return overdue >= 31 && overdue <= 60;
    case "61-90":
      return overdue >= 61 && overdue <= 90;
    case "90+":
      return overdue > 90;
    default:
      return true;
  }
}

function matchesPaymentPendingAmountBucket(order, amountFilter) {
  if (!amountFilter) return true;
  const amt = Number(order.remaining_amount) || 0;
  switch (amountFilter) {
    case "lt10k":
      return amt < 10000;
    case "10k-50k":
      return amt >= 10000 && amt < 50000;
    case "50k-1l":
      return amt >= 50000 && amt < 100000;
    case "1l-5l":
      return amt >= 100000 && amt < 500000;
    case "gt5l":
      return amt >= 500000;
    default:
      return true;
  }
}

/**
 * Client-side filters for payment-pending report rows (search, due range, overdue tag).
 */
export function filterPaymentPendingOrders(
  orders,
  {
    searchQuery,
    dueDateFrom,
    dueDateTo,
    statusFilter,
    employeeFilter,
    agingFilter,
    pendingAmountFilter,
  },
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
        order.created_by?.toLowerCase().includes(query) ||
        (order.service_ids || []).some((id) =>
          String(id).toLowerCase().includes(query),
        ),
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

  if (employeeFilter) {
    filtered = filtered.filter(
      (order) => String(order.created_by || "").trim() === employeeFilter,
    );
  }

  if (agingFilter) {
    filtered = filtered.filter((order) =>
      matchesPaymentPendingAging(order, agingFilter),
    );
  }

  if (pendingAmountFilter) {
    filtered = filtered.filter((order) =>
      matchesPaymentPendingAmountBucket(order, pendingAmountFilter),
    );
  }

  return filtered;
}

export function sortPaymentPendingOrders(orders, sortConfig) {
  if (!sortConfig?.key) return orders;

  return [...orders].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (sortConfig.key === "delivery_dates") {
      aVal = dayjs((a.delivery_dates || [])[a.delivery_dates?.length - 1]).unix();
      bVal = dayjs((b.delivery_dates || [])[b.delivery_dates?.length - 1]).unix();
    } else if (sortConfig.key === "installation_dates") {
      aVal = dayjs(
        (a.installation_dates || [])[a.installation_dates?.length - 1],
      ).unix();
      bVal = dayjs(
        (b.installation_dates || [])[b.installation_dates?.length - 1],
      ).unix();
    } else if (
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
