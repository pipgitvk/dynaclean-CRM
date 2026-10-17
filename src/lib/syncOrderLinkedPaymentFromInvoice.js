import { lookupInvoiceLinkedPayment } from "@/lib/invoiceLinkedPaymentLookup";
import { resolveInvoiceNumberForOrder } from "@/lib/resolveInvoiceNumberForOrder";
import {
  linkedPaymentsToOrderPaymentCsv,
  sumPaymentAmountCsv,
} from "@/lib/orderPaymentHistory";
import {
  clearOrderInvoicePaymentFields,
  refreshOrdersAfterInvoiceRemoved,
} from "@/lib/orderInvoicePaymentClear";
import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";

async function activeInvoiceExists(conn, invoiceNumber) {
  const num = String(invoiceNumber || "").trim();
  if (!num) return false;
  const [rows] = await conn.execute(
    `SELECT id FROM invoices
     WHERE TRIM(invoice_number) = ?
       AND ${EXCLUDE_PROFORMA_INVOICE_SQL}
       AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')
     LIMIT 1`,
    [num],
  );
  return rows.length > 0;
}

function orderHasInvoicePaymentSnapshot(order) {
  return (
    String(order?.invoice_number || "").trim() ||
    order?.amount_received != null ||
    order?.linked_payments_json ||
    String(order?.payment_amount || "").trim() ||
    String(order?.payment_id || "").trim()
  );
}

function derivePaymentStatus(paid, total) {
  const p = Number(paid) || 0;
  const t = Number(total) || 0;
  if (p >= t && t > 0) return "paid";
  if (p > 0 && p < t) return "partially paid";
  if (p === 0) return "pending";
  return "pending";
}

/**
 * Persist statement-linked payment on the order (amount_received + neworder payment_* fields).
 */
export async function syncOrderLinkedPaymentFromInvoice(conn, order) {
  const orderId = order?.order_id;
  if (!orderId) return order;

  let invoiceNumber = await resolveInvoiceNumberForOrder(conn, order);
  if (invoiceNumber && !(await activeInvoiceExists(conn, invoiceNumber))) {
    invoiceNumber = "";
  }

  if (!invoiceNumber) {
    if (orderHasInvoicePaymentSnapshot(order)) {
      return clearOrderInvoicePaymentFields(conn, order);
    }
    return order;
  }

  const hadInvoiceOnOrder = Boolean(String(order?.invoice_number || "").trim());
  const backfillInvoiceNumber = !hadInvoiceOnOrder;

  const linked = await lookupInvoiceLinkedPayment(conn, invoiceNumber);
  if (!linked?.found) {
    if (!(await activeInvoiceExists(conn, invoiceNumber))) {
      return clearOrderInvoicePaymentFields(conn, order, {
        deletedInvoiceNumber: invoiceNumber,
      });
    }
    if (backfillInvoiceNumber) {
      return { ...order, invoice_number: invoiceNumber };
    }
    return order;
  }

  const payments = Array.isArray(linked.payments) ? linked.payments : [];
  const paymentsJson = payments.length ? JSON.stringify(payments) : null;
  const csv = linkedPaymentsToOrderPaymentCsv(payments);

  const amount = Number(linked.payment_amount);
  const amountVal = Number.isFinite(amount) && amount > 0 ? amount : null;
  const pDate = linked.payment_date || null;

  const paymentIdVal = csv.payment_id || null;
  const paymentDateVal = csv.payment_date || null;
  const paymentAmountVal =
    csv.payment_amount ||
    (amountVal != null ? String(amountVal) : null);

  const storedNum = Number(order.amount_received);
  const sameAmount =
    (amountVal == null && (order.amount_received == null || order.amount_received === "")) ||
    (Number.isFinite(storedNum) && amountVal != null && storedNum === amountVal);
  const sameDate =
    String(order.payment_received_date || "").slice(0, 10) ===
    String(pDate || "").slice(0, 10);
  const sameJson = String(order.linked_payments_json || "") === String(paymentsJson || "");
  const samePaymentAmount =
    String(order.payment_amount || "").trim() === String(paymentAmountVal || "").trim();
  const samePaymentId =
    String(order.payment_id || "").trim() === String(paymentIdVal || "").trim();
  const sameInvoice =
    String(order.invoice_number || "").trim() === invoiceNumber;

  if (
    sameAmount &&
    sameDate &&
    sameJson &&
    samePaymentAmount &&
    samePaymentId &&
    sameInvoice
  ) {
    return {
      ...order,
      invoice_number: invoiceNumber,
      linked_payments: payments,
    };
  }

  const paidSum = sumPaymentAmountCsv(paymentAmountVal);
  const paymentStatus = derivePaymentStatus(paidSum, order.totalamt);

  if (backfillInvoiceNumber) {
    await conn.execute(
      `UPDATE neworder SET
        invoice_number = ?,
        amount_received = ?,
        payment_received_date = ?,
        linked_payments_json = ?,
        payment_id = ?,
        payment_date = ?,
        payment_amount = ?,
        payment_status = ?
       WHERE order_id = ?`,
      [
        invoiceNumber,
        amountVal,
        pDate,
        paymentsJson,
        paymentIdVal,
        paymentDateVal,
        paymentAmountVal,
        paymentStatus,
        orderId,
      ],
    );
  } else {
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
        amountVal,
        pDate,
        paymentsJson,
        paymentIdVal,
        paymentDateVal,
        paymentAmountVal,
        paymentStatus,
        orderId,
      ],
    );
  }

  return {
    ...order,
    invoice_number: invoiceNumber,
    amount_received: amountVal,
    payment_received_date: pDate,
    linked_payments_json: paymentsJson,
    linked_payments: payments,
    payment_id: paymentIdVal,
    payment_date: paymentDateVal,
    payment_amount: paymentAmountVal,
    payment_status: paymentStatus,
  };
}

/** After invoice payment link changes, refresh matching orders. */
export { refreshOrdersAfterInvoiceRemoved };

export async function syncOrdersForInvoiceNumbers(conn, invoiceNumbers) {
  const nums = [
    ...new Set(
      (invoiceNumbers || [])
        .map((n) => String(n || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!nums.length) return;

  for (const num of nums) {
    const [invRows] = await conn.execute(
      `SELECT quotation_id FROM invoices WHERE TRIM(invoice_number) = ? ORDER BY id DESC LIMIT 1`,
      [num],
    );
    const qid =
      invRows?.[0]?.quotation_id != null && invRows[0].quotation_id !== ""
        ? String(invRows[0].quotation_id)
        : null;

    const params = [num];
    let sql = `SELECT order_id, quote_number, invoice_number, totalamt, amount_received, payment_received_date,
              linked_payments_json, payment_id, payment_date, payment_amount, payment_status
       FROM neworder WHERE TRIM(invoice_number) = ?`;
    if (qid) {
      sql += ` OR quote_number = ?`;
      params.push(qid);
    }

    const [rows] = await conn.execute(sql, params);
    for (const order of rows || []) {
      await syncOrderLinkedPaymentFromInvoice(conn, order);
    }
  }
}
