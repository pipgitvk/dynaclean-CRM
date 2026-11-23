/** Same order amount rules as admin OrderTable / stat cards (Amount Summary). */

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

export function getAdminOrderPaymentColumnAmount(order) {
  const quotationSubtotal = Number(order.quotation_subtotal) || 0;
  if (quotationSubtotal > 0) return quotationSubtotal;
  return orderTaxableTotal(order);
}

export function getAdminOrderTotalAmount(order) {
  const quotationTotal = Number(order.quotation_grand_total) || 0;
  if (quotationTotal > 0) return quotationTotal;
  const total = Number(order.totalamt) || 0;
  if (total > 0) return total;
  const base = Number(order.baseAmount) || 0;
  const tax = Number(order.taxamt) || 0;
  return Math.max(total, base + tax);
}