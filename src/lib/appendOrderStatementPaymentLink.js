import { findActiveInvoiceForOrder } from "@/lib/activeInvoiceForOrder";
import {
  allocateStatementPaymentsForInvoice,
  lookupInvoiceLinkedPayment,
} from "@/lib/invoiceLinkedPaymentLookup";
import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { parseOrderLinkedPayments } from "@/lib/orderLinkedPaymentsDisplay";
import {
  linkedPaymentsToOrderPaymentCsv,
  mergeOrderPaymentWithLinkedCsv,
  sumOrderPaymentAmounts,
  sumPaymentAmountCsv,
} from "@/lib/orderPaymentHistory";
import { parseLinkedTransIds } from "@/lib/statementLinkedPurchases";
import { settleStatementsForInvoicePayment } from "@/lib/settleStatementsForInvoicePayment";
import { syncInvoiceAndOrderPaymentLink } from "@/lib/syncInvoiceOrderPaymentLink";
import { mergeLinkedPaymentsJson } from "@/lib/syncOrderLinkedPaymentFromInvoice";
import {
  computeOrderPaymentRemaining,
  derivePaymentStatus,
  getOrderTotalForPayment,
  PAYMENT_REMAINING_TOLERANCE_INR,
  roundInr,
} from "@/lib/paymentOrderStatus";
import { sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

function splitCsv(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function collectExistingOrderTransIds(order, invoiceLinkedRaw) {
  const seen = new Set();
  for (const p of parseOrderLinkedPayments(order)) {
    const tid = String(p.trans_id || "").trim();
    if (tid) seen.add(tid);
  }
  for (const tid of splitCsv(order?.payment_id)) seen.add(tid);
  for (const tid of parseLinkedTransIds(invoiceLinkedRaw)) seen.add(tid);
  return seen;
}

async function sumOrderDeductions(conn, orderId) {
  try {
    const [rows] = await conn.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payment_deductions WHERE order_id = ?`,
      [orderId],
    );
    return Number(rows?.[0]?.total) || 0;
  } catch {
    return 0;
  }
}

async function getOrderPendingBalance(conn, order) {
  const total = getOrderTotalForPayment(order);
  const paid = sumOrderPaymentAmounts(order);
  const deduction = await sumOrderDeductions(conn, order.order_id);
  const { remaining } = computeOrderPaymentRemaining(total, paid, deduction);
  return { total, paid, deduction, remaining: roundInr(remaining) };
}

async function orderRemainingAfterLink(conn, orderId) {
  const [rows] = await conn.execute(
    `SELECT no.order_id, no.totalamt, no.payment_amount, no.payment_id,
            no.payment_date, no.amount_received, no.linked_payments_json,
            no.baseAmount, no.taxamt,
            qr.grand_total AS quotation_grand_total
     FROM neworder no
     LEFT JOIN quotations_records qr ON qr.quote_number = no.quote_number
     WHERE no.order_id = ? LIMIT 1`,
    [orderId],
  );
  const row = rows?.[0];
  if (!row) return { remaining_amount: 0, is_fully_paid: true };
  const { remaining } = await getOrderPendingBalance(conn, row);
  return {
    remaining_amount: remaining,
    is_fully_paid: remaining <= 0,
  };
}

function invoicePaymentStatus(amountPaid, grandTotal) {
  const paid = Number(amountPaid) || 0;
  const total = Number(grandTotal) || 0;
  if (total > 0 && paid >= total - 0.01) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "UNPAID";
}

/**
 * Append statement credit links onto an order (and invoice when present).
 * Does not clear existing payment rows — only merges new trans_ids.
 */
export async function appendOrderStatementPaymentLink(
  conn,
  orderId,
  transIds,
) {
  await ensureOrderLinkedPaymentColumns(conn);

  const oid = Number(orderId);
  if (!Number.isFinite(oid) || oid <= 0) {
    throw new Error("Invalid order_id");
  }

  const incoming = [
    ...new Set(
      (transIds || []).map((t) => String(t).trim()).filter(Boolean),
    ),
  ];
  if (!incoming.length) {
    return { added: 0, message: "No transaction IDs provided" };
  }

  const [orderRows] = await conn.execute(
    `SELECT no.order_id, no.quote_number, no.invoice_number, no.totalamt,
            no.payment_id, no.payment_date, no.payment_amount, no.payment_status,
            no.amount_received, no.payment_received_date, no.linked_payments_json,
            no.transaction_id,
            qr.grand_total AS quotation_grand_total
     FROM neworder no
     LEFT JOIN quotations_records qr ON qr.quote_number = no.quote_number
     WHERE no.order_id = ? LIMIT 1`,
    [oid],
  );
  if (!orderRows?.length) throw new Error("Order not found");
  const order = orderRows[0];

  const invBrief = await findActiveInvoiceForOrder(conn, { order_id: oid });
  let inv = null;
  if (invBrief?.id) {
    const [invFull] = await conn.execute(
      `SELECT id, invoice_number, grand_total, amount_paid, linked_trans_ids
       FROM invoices WHERE id = ? LIMIT 1`,
      [invBrief.id],
    );
    inv = invFull?.[0] || null;
  }
  const invoiceNumber = String(
    inv?.invoice_number || order.invoice_number || "",
  ).trim();

  const existing = collectExistingOrderTransIds(
    order,
    inv?.linked_trans_ids,
  );
  const toAdd = incoming.filter((t) => !existing.has(t));
  if (!toAdd.length) {
    return { added: 0, message: "Payments already linked — nothing new to add" };
  }

  const placeholders = toAdd.map(() => "?").join(", ");
  const [stmtRows] = await conn.execute(
    `SELECT id, trans_id, date, amount, type
     FROM statements
     WHERE ${sqlUtf8TrimExpr("trans_id")} IN (${placeholders})`,
    toAdd,
  );
  const stmts = (stmtRows || []).filter(
    (s) => String(s.type || "").trim().toLowerCase() === "credit",
  );
  if (!stmts.length) {
    throw new Error("No matching credit statements found for selected Trans IDs");
  }

  const { remaining: pendingBalance } = await getOrderPendingBalance(conn, order);
  if (pendingBalance <= 0) {
    throw new Error("This order has no pending balance to link");
  }

  const newCreditsTotal = stmts.reduce(
    (sum, s) => sum + Math.abs(Number(s.amount) || 0),
    0,
  );
  if (newCreditsTotal > pendingBalance + PAYMENT_REMAINING_TOLERANCE_INR) {
    throw new Error(
      `Selected payments (₹${roundInr(newCreditsTotal).toLocaleString("en-IN")}) exceed pending balance (₹${pendingBalance.toLocaleString("en-IN")})`,
    );
  }

  if (inv?.id && invoiceNumber) {
    const mergedTrans = [
      ...new Set([...parseLinkedTransIds(inv.linked_trans_ids), ...toAdd]),
    ];

    await settleStatementsForInvoicePayment(conn, {
      invoiceId: inv.id,
      invoiceNumber,
      transIds: toAdd,
    });

    const linked = await lookupInvoiceLinkedPayment(conn, invoiceNumber);
    const grandTotal = Number(inv.grand_total) || 0;
    const amountPaid = linked?.found
      ? Math.max(Number(inv.amount_paid) || 0, Number(linked.payment_amount) || 0)
      : Number(inv.amount_paid) || 0;
    const cappedPaid =
      grandTotal > 0 ? Math.min(amountPaid, grandTotal) : amountPaid;
    const balance = Math.max(0, grandTotal - cappedPaid);
    const paymentStatus = invoicePaymentStatus(cappedPaid, grandTotal);
    const linkedJson =
      mergedTrans.length > 0 ? JSON.stringify(mergedTrans) : null;

    await conn.execute(
      `UPDATE invoices
       SET amount_paid = ?, balance_amount = ?, payment_status = ?, linked_trans_ids = ?
       WHERE id = ?`,
      [cappedPaid, balance, paymentStatus, linkedJson, inv.id],
    );

    await conn.execute(
      `UPDATE neworder
       SET invoice_number = COALESCE(NULLIF(TRIM(invoice_number), ''), ?)
       WHERE order_id = ?
         AND (invoice_number IS NULL OR TRIM(invoice_number) = '')`,
      [invoiceNumber, oid],
    );

    await syncInvoiceAndOrderPaymentLink(conn, {
      invoiceNumbers: [invoiceNumber],
      orderIds: [oid],
    });

    const balanceAfter = await orderRemainingAfterLink(conn, oid);

    return {
      added: toAdd.length,
      invoice_number: invoiceNumber,
      amount_paid: cappedPaid,
      trans_ids: toAdd,
      ...balanceAfter,
    };
  }

  const orderTotal = getOrderTotalForPayment(order);
  const linkCap = pendingBalance > 0 ? pendingBalance : orderTotal;
  const allocated = allocateStatementPaymentsForInvoice(
    stmts.map((s) => ({
      id: s.id,
      trans_id: s.trans_id,
      date: s.date,
      amount: s.amount,
    })),
    linkCap > 0 ? linkCap : Infinity,
  );

  if (!allocated.payments.length) {
    throw new Error("Could not apply statement amounts to this order");
  }

  const invoiceCsv = linkedPaymentsToOrderPaymentCsv(allocated.payments);
  const mergedCsv = mergeOrderPaymentWithLinkedCsv(order, invoiceCsv);
  const paymentsJson = mergeLinkedPaymentsJson(order, allocated.payments);

  const paidSum = Math.min(
    sumPaymentAmountCsv(mergedCsv.payment_amount) ||
      sumOrderPaymentAmounts({ ...order, payment_amount: mergedCsv.payment_amount }),
    orderTotal > 0 ? orderTotal : Infinity,
  );

  const deductionAmount = await sumOrderDeductions(conn, oid);
  const paymentStatus = derivePaymentStatus({
    total: orderTotal,
    paidAmount: paidSum,
    deductionAmount,
    isOverdue: false,
  });

  const receivedDate =
    mergedCsv.payment_date || order.payment_received_date || null;

  await conn.execute(
    `UPDATE neworder SET
      amount_received = ?,
      payment_received_date = ?,
      linked_payments_json = ?,
      payment_id = ?,
      payment_date = ?,
      payment_amount = ?,
      payment_status = ?
     WHERE order_id = ?`,
    [
      paidSum > 0 ? paidSum : order.amount_received,
      receivedDate,
      paymentsJson,
      mergedCsv.payment_id || order.payment_id,
      mergedCsv.payment_date || order.payment_date,
      mergedCsv.payment_amount || order.payment_amount,
      paymentStatus,
      oid,
    ],
  );

  const balanceAfter = await orderRemainingAfterLink(conn, oid);

  return {
    added: toAdd.length,
    amount_received: paidSum,
    trans_ids: toAdd,
    ...balanceAfter,
  };
}