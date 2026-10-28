import { deriveOrderListPaymentStatus } from "@/lib/paymentOrderStatus";
import { getOrderPaidAmountForDisplay } from "@/lib/orderPaymentHistory";

function normalizeApprovalStatus(status) {
  const s = (status ?? "").toString().trim().toLowerCase();
  if (!s || s === "null" || s === "undefined") return "pending";
  return s;
}

function isOrderExcludedFromStatCards(order) {
  if (normalizeApprovalStatus(order.approval_status) === "rejected") return true;
  if (order.is_cancelled) return true;
  return false;
}

function isRejectedApprovalOrder(order) {
  return normalizeApprovalStatus(order.approval_status) === "rejected";
}

function isOrderDispatchedForStats(order) {
  return Number(order.dispatch_status) === 1;
}

function isOrderPendingDispatchForStats(order) {
  return Number(order.dispatch_status) !== 1;
}

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

function getPaymentColumnAmount(order) {
  const quotationSubtotal = Number(order.quotation_subtotal) || 0;
  if (quotationSubtotal > 0) return quotationSubtotal;
  return orderTaxableTotal(order);
}

function getTotalAmount(order) {
  const quotationTotal = Number(order.quotation_grand_total) || 0;
  if (quotationTotal > 0) return quotationTotal;
  const total = Number(order.totalamt) || 0;
  if (total > 0) return total;
  const base = Number(order.baseAmount) || 0;
  const tax = Number(order.taxamt) || 0;
  return Math.max(total, base + tax);
}

function getBalanceAmount(order) {
  const total = getTotalAmount(order);
  const paid = getOrderPaidAmountForDisplay(order);
  return Math.max(0, total - paid);
}

const EMPTY_ORDER_STATS = {
  total: 0,
  pending: 0,
  approved: 0,
  dispatched: 0,
  pendingDispatch: 0,
  paid: 0,
  unpaid: 0,
  totalAmount: 0,
  pendingAmount: 0,
  approvedAmount: 0,
  dispatchedAmount: 0,
  pendingDispatchAmount: 0,
  paidAmount: 0,
  unpaidAmount: 0,
};

/**
 * Same buckets as admin OrderTable stat cards (full order set in date range).
 */
export function computeAdminOrderStatCardAggregates(
  orders,
  { approvalStatusFilter = "" } = {},
) {
  const list = Array.isArray(orders) ? orders : [];
  const isRejectedOnlyView =
    approvalStatusFilter.toString().trim().toLowerCase() === "rejected";

  const ordersForStatCards = isRejectedOnlyView
    ? []
    : list.filter((order) => !isOrderExcludedFromStatCards(order));

  const orderStats = ordersForStatCards.reduce(
    (acc, order) => {
      const taxable = getPaymentColumnAmount(order);
      const paidOrder = getOrderPaidAmountForDisplay(order);
      const approval = normalizeApprovalStatus(order.approval_status);
      const isPendingApproval = approval === "pending";
      const isApproved = approval === "approved";

      if (isPendingApproval) {
        acc.pending += 1;
        acc.pendingAmount += taxable;
      }

      if (isApproved) {
        acc.total += 1;
        acc.totalAmount += taxable;
        acc.approved += 1;
        acc.approvedAmount += taxable;

        if (isOrderDispatchedForStats(order)) {
          acc.dispatched += 1;
          acc.dispatchedAmount += taxable;
        }
        if (isOrderPendingDispatchForStats(order)) {
          acc.pendingDispatch += 1;
          acc.pendingDispatchAmount += taxable;
        }

        const pmtStatus = deriveOrderListPaymentStatus(order)
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "");

        if (pmtStatus === "paid") {
          acc.paid += 1;
        } else {
          acc.unpaid += 1;
        }

        acc.paidAmount += paidOrder;
      }

      return acc;
    },
    { ...EMPTY_ORDER_STATS },
  );

  orderStats.unpaidAmount = Math.max(
    0,
    orderStats.totalAmount - orderStats.paidAmount,
  );

  const rejectedOrderStats = list.reduce(
    (acc, order) => {
      if (!isRejectedApprovalOrder(order)) return acc;
      acc.rejected += 1;
      acc.rejectedAmount += getPaymentColumnAmount(order);
      return acc;
    },
    { rejected: 0, rejectedAmount: 0 },
  );

  const leadCampaignCounts = {};
  ordersForStatCards.forEach((order) => {
    const raw = order.lead_campaign;
    const key =
      raw == null || String(raw).trim() === ""
        ? "__none__"
        : String(raw).trim().toLowerCase();
    leadCampaignCounts[key] = (leadCampaignCounts[key] || 0) + 1;
  });

  const amountTotals = list.reduce(
    (acc, order) => {
      if (normalizeApprovalStatus(order.approval_status) !== "approved") {
        return acc;
      }
      if (isOrderExcludedFromStatCards(order)) return acc;
      acc.totalAmount += getTotalAmount(order);
      acc.paidAmount += getOrderPaidAmountForDisplay(order);
      acc.taxableAmount += getPaymentColumnAmount(order);
      acc.balanceAmount += getBalanceAmount(order);
      return acc;
    },
    { totalAmount: 0, paidAmount: 0, taxableAmount: 0, balanceAmount: 0 },
  );

  const rejectedAmountTotals = list.reduce(
    (acc, order) => {
      if (!isRejectedApprovalOrder(order)) return acc;
      acc.taxableAmount += getPaymentColumnAmount(order);
      acc.totalAmount += getTotalAmount(order);
      return acc;
    },
    { taxableAmount: 0, totalAmount: 0 },
  );

  return {
    orderStats,
    rejectedOrderStats,
    leadCampaignCounts,
    amountTotals,
    rejectedAmountTotals,
    orderCount: list.length,
  };
}

export { EMPTY_ORDER_STATS };
