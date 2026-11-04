import {
  getOrderTableDefaultDateFrom,
  getOrderTableDefaultDateTo,
  normalizeOrderListDateRange,
} from "@/lib/orderTableDateDefaults";

export function buildCustomerPaymentBehaviorReportUrl({
  from,
  to,
  employee,
} = {}) {
  const q = new URLSearchParams();
  const { dateFrom, dateTo } = normalizeOrderListDateRange(from, to);
  if (dateFrom) q.set("from", dateFrom);
  if (dateTo) q.set("to", dateTo);
  const emp = employee != null ? String(employee).trim() : "";
  if (emp) q.set("employee", emp);
  const qs = q.toString();
  return qs
    ? `/api/reports/customer-payment-behavior?${qs}`
    : "/api/reports/customer-payment-behavior";
}

export function getDefaultCustomerPaymentBehaviorDateRange() {
  return {
    from: getOrderTableDefaultDateFrom(),
    to: getOrderTableDefaultDateTo(),
  };
}
