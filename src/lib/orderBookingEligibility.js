import { hasOrderInvoiceReport } from "@/lib/orderDocumentEditRules";

/**
 * Order value for booking rules. Prefer quotation grand total.
 * Do not treat default totalamt=0 (pre-invoice) as a zero-value order.
 */
export function getOrderEffectiveTotalForBooking(order) {
  const quoteRaw = order?.quotation_grand_total;
  if (quoteRaw != null && quoteRaw !== "") {
    const q = Number(quoteRaw);
    if (!Number.isNaN(q)) return q;
  }

  if (hasOrderInvoiceReport(order)) {
    const inv = order?.totalamt;
    if (inv != null && inv !== "") {
      const t = Number(inv);
      if (!Number.isNaN(t)) return t;
    }
    const base = Number(order?.baseAmount) || 0;
    const tax = Number(order?.taxamt) || 0;
    return base + tax;
  }

  return null;
}

/** Only true when order value is known and exactly ₹0 (quotation or posted invoice). */
export function canCreateBookingWithoutInvoiceReport(order) {
  const total = getOrderEffectiveTotalForBooking(order);
  return total === 0;
}

export function isBookingAllowedForOrder(order) {
  if (hasOrderInvoiceReport(order)) return true;
  return canCreateBookingWithoutInvoiceReport(order);
}
