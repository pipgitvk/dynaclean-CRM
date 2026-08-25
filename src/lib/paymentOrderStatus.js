/**
 * Shared helpers for payment-pending reports and deduction updates.
 */

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
  let totalAmt = parseFloat(order.totalamt || 0);

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
    `SELECT order_id, quote_number, totalamt, payment_amount, duedate, is_returned
     FROM neworder WHERE order_id = ?`,
    [orderId]
  );

  if (!orderRows.length) return null;

  const order = orderRows[0];
  const totalAmount = await calculateAdjustedOrderTotal(pool, order);
  const paidAmount = sumPaymentAmounts(order.payment_amount);

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
    total: totalAmount,
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
