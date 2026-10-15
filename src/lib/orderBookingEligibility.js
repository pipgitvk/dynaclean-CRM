import { hasOrderInvoiceReport } from "@/lib/orderDocumentEditRules";

/** Booking (including ₹0 orders) only after invoice/service report is uploaded. */
export function isBookingAllowedForOrder(order) {
  return hasOrderInvoiceReport(order);
}
