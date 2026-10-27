import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";
import { parseOrderLinkedPayments } from "@/lib/orderLinkedPaymentsDisplay";
import { sumPaymentAmountCsv } from "@/lib/orderPaymentHistory";
import { resolveInvoiceNumberForOrder } from "@/lib/resolveInvoiceNumberForOrder";
import { sqlTrimUtf8Eq, sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

function parseLinkedTransIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    }
  } catch (_) {
    /* ignore */
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function invoicePaymentStatusFromAmounts(amountPaid, grandTotal) {
  const paid = Number(amountPaid) || 0;
  const total = Number(grandTotal) || 0;
  if (total > 0 && paid >= total) return "PAID";
  if (paid > 0 && paid < total) return "PARTIAL";
  return "UNPAID";
}

/** Booking UTR on neworder (order form) must not become invoice linked_trans_ids. */
function isStatementLinkedOrderPayment(payment) {
  const sid = payment?.statement_id;
  return (
    sid != null && String(sid).trim() !== "" && String(sid).trim() !== "0"
  );
}

function statementLinkedTransIdsFromOrderPayments(payments) {
  const ids = new Set();
  for (const p of payments || []) {
    if (!isStatementLinkedOrderPayment(p)) continue;
    const tid = p.trans_id ? String(p.trans_id).trim() : "";
    if (tid) ids.add(tid);
  }
  return ids;
}

const ORDER_PAYMENT_SELECT = `SELECT order_id, quote_number, invoice_number, totalamt, amount_received,
  payment_received_date, linked_payments_json, payment_id, payment_date, payment_amount, payment_status
  FROM neworder WHERE order_id = ? LIMIT 1`;

/**
 * Push order payment snapshot onto invoices (+ statement invoice_number where safe).
 * Merges linked_trans_ids; does not clear existing invoice links or reduce amount_paid.
 */
export async function syncInvoicePaymentFromOrder(conn, orderOrOrderId) {
  let order = orderOrOrderId;
  if (
    orderOrOrderId == null ||
    typeof orderOrOrderId === "string" ||
    typeof orderOrOrderId === "number"
  ) {
    const [rows] = await conn.execute(ORDER_PAYMENT_SELECT, [
      String(orderOrOrderId),
    ]);
    if (!rows?.[0]) return;
    order = rows[0];
  }

  const invoiceNumber = await resolveInvoiceNumberForOrder(conn, order);
  if (!invoiceNumber) return;

  const [invRows] = await conn.execute(
    `SELECT id, invoice_number, grand_total, amount_paid, linked_trans_ids
     FROM invoices
     WHERE ${sqlTrimUtf8Eq("invoice_number")}
       AND ${EXCLUDE_PROFORMA_INVOICE_SQL}
       AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')
     ORDER BY id DESC
     LIMIT 1`,
    [invoiceNumber],
  );
  if (!invRows?.[0]) return;
  const inv = invRows[0];

  const payments = parseOrderLinkedPayments(order);
  const transIds = new Set(parseLinkedTransIds(inv.linked_trans_ids));
  for (const tid of statementLinkedTransIdsFromOrderPayments(payments)) {
    transIds.add(tid);
  }

  const paidFromLines = payments.reduce(
    (s, p) => s + Math.abs(Number(p.amount) || 0),
    0,
  );
  const paidFromOrder =
    Number(order.amount_received) ||
    sumPaymentAmountCsv(order.payment_amount) ||
    paidFromLines;

  if (paidFromOrder <= 0 && transIds.size === 0) return;

  const grandTotal = Number(inv.grand_total) || 0;
  const existingPaid = Number(inv.amount_paid) || 0;
  const amountPaid =
    paidFromOrder > 0 ? Math.max(existingPaid, paidFromOrder) : existingPaid;
  const balance = Math.max(0, grandTotal - amountPaid);
  const paymentStatus = invoicePaymentStatusFromAmounts(amountPaid, grandTotal);
  const linkedTransIdsJson =
    transIds.size > 0
      ? JSON.stringify([...transIds])
      : inv.linked_trans_ids;

  await conn.execute(
    `UPDATE invoices
     SET amount_paid = ?, balance_amount = ?, payment_status = ?, linked_trans_ids = ?
     WHERE id = ?`,
    [amountPaid, balance, paymentStatus, linkedTransIdsJson, inv.id],
  );

  if (transIds.size > 0) {
    const list = [...transIds];
    const placeholders = list.map(() => "?").join(", ");
    await conn.execute(
      `UPDATE statements
       SET invoice_number = ?
       WHERE ${sqlUtf8TrimExpr("trans_id")} IN (${placeholders})
         AND (
           invoice_number IS NULL
           OR TRIM(invoice_number) = ''
           OR TRIM(invoice_number) = TRIM(?)
         )`,
      [invoiceNumber, ...list, invoiceNumber],
    );
  }
}
