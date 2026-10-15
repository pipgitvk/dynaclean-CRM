/**
 * Shared helpers for payment-pending reports and deduction updates.
 */

import { sumOrderPaymentAmounts } from "@/lib/orderPaymentHistory";
import { hasOrderInvoiceReport } from "@/lib/orderDocumentEditRules";

/** Matches order list UI: quotation grand total, then invoice totalamt. */
export function getOrderTotalForPayment(order) {
  const quotationTotal = Number(order?.quotation_grand_total) || 0;
  if (quotationTotal > 0) return quotationTotal;

  const total = Number(order?.totalamt) || 0;
  if (total > 0) return total;

  const base = Number(order?.baseAmount) || 0;
  const tax = Number(order?.taxamt) || 0;
  return Math.max(total, base + tax);
}

/**
 * Order list Payment column: until accountant uploads invoice report,
 * do not treat booking advance / quotation total as "Paid".
 */
export function deriveOrderListPaymentStatus(order) {
  if (!hasOrderInvoiceReport(order)) {
    return "pending";
  }
  return deriveOrderPaymentStatus(order);
}

/** Status from paid vs total (booking advance before payment_status is updated). */
export function deriveOrderPaymentStatus(order) {
  const total = getOrderTotalForPayment(order);
  const paidAmount = sumOrderPaymentAmounts(order);
  const stored = (order?.payment_status || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (paidAmount > 0 || total > 0) {
    return derivePaymentStatus({
      total,
      paidAmount,
      deductionAmount: 0,
      isOverdue:
        paidAmount === 0 && (stored === "overdue" || stored === "over due"),
    });
  }

  if (stored === "overdue") return "over due";
  return order?.payment_status || "pending";
}

export function parsePaymentAmounts(paymentAmountRaw) {
  return (paymentAmountRaw || "")
    .toString()
    .split(",")
    .map((s) => parseFloat(s.trim()) || 0);
}

export function sumPaymentAmounts(paymentAmountRaw) {
  return parsePaymentAmounts(paymentAmountRaw).reduce((sum, amt) => sum + amt, 0);
}

export async function calculateAdjustedOrderTotal(pool, order) {
  let totalAmt = getOrderTotalForPayment(order);

  if (Number(order.is_returned) === 2 && order.quote_number) {
    try {
      const [returnedItems] = await pool.query(
        `SELECT item_code, quantity_returned FROM order_return_items WHERE order_id = ?`,
        [order.order_id]
      );

      if (returnedItems.length > 0) {
        const itemCodes = returnedItems.map((item) => item.item_code);
        const placeholders = itemCodes.map(() => "?").join(",");

        const [quotationItems] = await pool.query(
          `SELECT item_code, total_price, quantity FROM quotation_items
           WHERE quote_number = ? AND item_code IN (${placeholders})`,
          [order.quote_number, ...itemCodes]
        );

        let returnedValue = 0;
        returnedItems.forEach((returnedItem) => {
          const quotItem = quotationItems.find((q) => q.item_code === returnedItem.item_code);
          if (quotItem) {
            const pricePerUnit = parseFloat(quotItem.total_price) / parseInt(quotItem.quantity, 10);
            returnedValue += pricePerUnit * returnedItem.quantity_returned;
          }
        });

        totalAmt -= returnedValue;
      }
    } catch (err) {
      console.error(`Error calculating returned value for order ${order.order_id}:`, err);
    }
  }

  return totalAmt;
}

export function derivePaymentStatus({ total, paidAmount, deductionAmount, isOverdue }) {
  const settled = paidAmount + deductionAmount;

  if (total > 0 && settled >= total) {
    return paidAmount >= total ? "paid" : "partially paid";
  }
  if (paidAmount > 0 || deductionAmount > 0) return "partially paid";
  if (isOverdue) return "over due";
  return "pending";
}

export async function getOrderPaymentBreakdown(pool, orderId) {
  const [orderRows] = await pool.query(
    `SELECT o.order_id, o.quote_number, o.totalamt, o.baseAmount, o.taxamt,
            o.payment_amount, o.transaction_id, o.duedate, o.is_returned,
            qr.grand_total AS quotation_grand_total
     FROM neworder o
     LEFT JOIN quotations_records qr ON qr.quote_number = o.quote_number
     WHERE o.order_id = ?`,
    [orderId]
  );

  if (!orderRows.length) return null;

  const order = orderRows[0];
  const totalAmount = await calculateAdjustedOrderTotal(pool, order);
  const paidAmount = sumOrderPaymentAmounts(order);

  const [deductionRows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payment_deductions WHERE order_id = ?`,
    [orderId]
  );
  const deductionAmount = parseFloat(deductionRows[0]?.total || 0);

  let paymentTermDays = 0;
  if (order.quote_number) {
    const [qRows] = await pool.query(
      `SELECT payment_term_days FROM quotations_records WHERE quote_number = ?`,
      [order.quote_number]
    );
    if (qRows.length) {
      paymentTermDays = Number(qRows[0]?.payment_term_days) || 0;
    }
  }

  let isOverdue = false;
  const invoiceDateIso = order.duedate;
  if (invoiceDateIso && paymentTermDays > 0) {
    const inv = new Date(invoiceDateIso);
    const due = new Date(inv);
    due.setDate(due.getDate() + paymentTermDays);
    const today = new Date();
    isOverdue = today.setHours(0, 0, 0, 0) > due.setHours(0, 0, 0, 0);
  }

  const remainingAmount = totalAmount - paidAmount - deductionAmount;
  const paymentStatus = derivePaymentStatus({
    total: getOrderTotalForPayment(order) || totalAmount,
    paidAmount,
    deductionAmount,
    isOverdue,
  });

  return {
    totalAmount,
    paidAmount,
    deductionAmount,
    remainingAmount,
    paymentStatus,
  };
}

export async function refreshOrderPaymentStatus(pool, orderId) {
  const breakdown = await getOrderPaymentBreakdown(pool, orderId);
  if (!breakdown) return null;

  await pool.execute(`UPDATE neworder SET payment_status = ? WHERE order_id = ?`, [
    breakdown.paymentStatus,
    orderId,
  ]);

  return breakdown;
}

export function defaultClaimableForType(deductionType) {
  const type = String(deductionType || "").toUpperCase();
  if (type === "TDS") return false;
  if (type === "LD" || type === "SD") return true;
  return false;
}
