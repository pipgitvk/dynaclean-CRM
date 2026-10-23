import dayjs from "dayjs";
import { pickEffectiveNextFollowup } from "@/utils/tlNextFollowupResolve";

export function allowTLCustomerByStatus(customer, { tlOnly, isSuperAdmin, statusFilter }) {
  if (!tlOnly && isSuperAdmin) {
    if (!statusFilter) return true;
    if (statusFilter === "Denied") return customer.status === "Denied";
    if (statusFilter === "Invalid") return customer.status === "Invalid";
  }
  return customer.status !== "Denied" && customer.status !== "Invalid";
}

const EXCLUDED_STAGES_FOR_DUE = [
  "Won (Order Received)",
  "Lost",
  "Disqualified / Invalid Lead",
];

/**
 * Client chip filters (All / Up / Due / Prime) on an in-memory row set.
 */
export function applyTLCustomersChipFilter(
  customers,
  activeFilter,
  { tlOnly, isSuperAdmin, statusFilter, preBookingOnly },
) {
  const now = dayjs();
  let base = customers;
  if (preBookingOnly) {
    base = base.filter((c) => c.has_pre_booking);
  }

  const ctx = { tlOnly, isSuperAdmin, statusFilter };

  switch (activeFilter) {
    case "upcoming":
      return base.filter(
        (customer) =>
          allowTLCustomerByStatus(customer, ctx) &&
          customer.multi_tag &&
          customer.multi_tag.toLowerCase().includes("strong followup"),
      );
    case "due":
      return base.filter((customer) => {
        if (!allowTLCustomerByStatus(customer, ctx)) return false;
        if (EXCLUDED_STAGES_FOR_DUE.includes(customer.stage)) return false;
        const followupTime = pickEffectiveNextFollowup(customer);
        if (!followupTime) return false;
        return followupTime.isBefore(now);
      });
    case "prime":
      return base.filter(
        (customer) =>
          allowTLCustomerByStatus(customer, ctx) &&
          customer.multi_tag &&
          customer.multi_tag.toLowerCase().includes("prime"),
      );
    default:
      return base.filter((customer) => allowTLCustomerByStatus(customer, ctx));
  }
}
