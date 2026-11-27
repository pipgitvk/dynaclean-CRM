/** Same order amount rules as admin OrderTable / stat cards (Amount Summary). */

import { hideGstBreakdownFromRow } from "@/lib/ensureQuotationHideGstColumn";

function amountWithoutGst(order) {
  const rawBase = order.baseAmount;
  if (rawBase != null && rawBase !== "") {
    const base = Number(rawBase);
    if (Number.isFinite(base)) return base;
  }
  const total = Number(order.totalamt) || 0;
  const tax = Number(order.taxamt) || 0;
  return Math.max(0, total - tax);
}

function orderTaxableTotal(order) {
  const t = order.order_taxable_total;
  if (t != null && t !== "") {
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return amountWithoutGst(order);
}

function quotationHidesGstBreakdown(order) {
  return hideGstBreakdownFromRow({
    hide_gst_breakdown:
      order.quotation_hide_gst_breakdown ?? order.hide_gst_breakdown,
  });
}

/** Grand total when quotation hides GST (ex-GST amount + round off). */
function orderTotalWhenGstHidden(order) {
  const subtotal = Number(order.quotation_subtotal) || 0;
  const roundOff = Number(order.quotation_round_off) || 0;
  if (subtotal > 0) return subtotal + roundOff;

  const grand = Number(order.quotation_grand_total) || 0;
  if (grand > 0) return grand;

  const linesTaxable = orderTaxableTotal(order);
  if (linesTaxable > 0) return linesTaxable + roundOff;

  const totalamt = Number(order.totalamt) || 0;
  if (totalamt > 0) {
    const exGst = amountWithoutGst(order);
    return exGst > 0 ? exGst : totalamt;
  }

  const base = Number(order.baseAmount) || 0;
  if (base > 0) return base;

  return Math.max(0, amountWithoutGst(order));
}

/** Grand total when GST breakdown is shown (includes tax). */
function orderTotalWithGst(order) {
  const quotationTotal = Number(order.quotation_grand_total) || 0;
  if (quotationTotal > 0) return quotationTotal;

  const total = Number(order.totalamt) || 0;
  if (total > 0) return total;

  const base = Number(order.baseAmount) || 0;
  const tax = Number(order.taxamt) || 0;
  return Math.max(total, base + tax);
}

export function getAdminOrderPaymentColumnAmount(order) {
  const quotationSubtotal = Number(order.quotation_subtotal) || 0;
  if (quotationSubtotal > 0) return quotationSubtotal;
  return orderTaxableTotal(order);
}

export function getAdminOrderTotalAmount(order) {
  if (quotationHidesGstBreakdown(order)) {
    return orderTotalWhenGstHidden(order);
  }
  return orderTotalWithGst(order);
}