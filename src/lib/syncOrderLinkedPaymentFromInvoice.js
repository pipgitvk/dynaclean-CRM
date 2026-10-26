import {
  allocateStatementPaymentsForInvoice,
  lookupInvoiceLinkedPayment,
} from "@/lib/invoiceLinkedPaymentLookup";
import { resolveInvoiceNumberForOrder } from "@/lib/resolveInvoiceNumberForOrder";
import { parseOrderLinkedPayments } from "@/lib/orderLinkedPaymentsDisplay";
import {
  linkedPaymentsToOrderPaymentCsv,
  mergeOrderPaymentWithLinkedCsv,
  sumPaymentAmountCsv,
} from "@/lib/orderPaymentHistory";
import {
  clearOrderInvoicePaymentFields,
  refreshOrdersAfterInvoiceRemoved,
} from "@/lib/orderInvoicePaymentClear";
import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";
import { parseLinkedTransIds } from "@/lib/statementLinkedPurchases";
import { sqlTrimUtf8Eq } from "@/lib/sqlUtf8Compare";
import { syncPartyPaymentOutFromOrder } from "@/lib/partyPaymentOrderLink";

async function activeInvoiceExists(conn, invoiceNumber) {
  const num = String(invoiceNumber || "").trim();
  if (!num) return false;
  const [rows] = await conn.execute(
    `SELECT id FROM invoices
     WHERE ${sqlTrimUtf8Eq("invoice_number")}
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

function mergeLinkedPaymentsJson(order, invoicePayments) {
  const existing = parseOrderLinkedPayments(order);
  const merged = [...existing];
  const seen = new Set(
    existing
      .map((p) => (p.trans_id ? String(p.trans_id).trim() : ""))
      .filter(Boolean),
  );

  for (const p of invoicePayments || []) {
    const tid = p.trans_id ? String(p.trans_id).trim() : "";
    const amt = Number(p.amount) || 0;
    if (tid) {
      if (seen.has(tid)) continue;
      seen.add(tid);
    } else if (amt <= 0) {
      continue;
    }
    merged.push({
      statement_id: p.statement_id ?? null,
      trans_id: tid,
      date: p.date || null,
      amount: amt,
    });
  }

  return merged.length ? JSON.stringify(merged) : null;
}

function invoicePaymentCsvFromLinked(payments, amountVal, pDate) {
  let csv = linkedPaymentsToOrderPaymentCsv(payments);
  if (!csv.payment_amount && amountVal != null && amountVal > 0) {
    csv = {
      payment_id: csv.payment_id || null,
      payment_date: csv.payment_date || pDate || null,
      payment_amount: String(amountVal),
    };
  }
  return csv;
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
      await conn.execute(
        `UPDATE neworder SET invoice_number = ?
         WHERE order_id = ?
           AND (invoice_number IS NULL OR TRIM(invoice_number) = '')`,
        [invoiceNumber, orderId],
      );
      return { ...order, invoice_number: invoiceNumber };
    }
    return order;
  }

  let payments = Array.isArray(linked.payments) ? linked.payments : [];
  let amount = Number(linked.payment_amount);
  let pDate = linked.payment_date || null;
  const orderTotal = Number(order.totalamt) || 0;

  const [invMetaRows] = await conn.execute(
    `SELECT amount_paid, linked_trans_ids, invoice_date
     FROM invoices
     WHERE ${sqlTrimUtf8Eq("invoice_number")}
     ORDER BY id DESC LIMIT 1`,
    [invoiceNumber],
  );
  const invMeta = invMetaRows?.[0];
  const invAmountPaid = Number(invMeta?.amount_paid) || 0;
  const tids = parseLinkedTransIds(invMeta?.linked_trans_ids);
  if (invAmountPaid > 0) {
    amount = Math.max(amount || 0, invAmountPaid);
  }
  if (orderTotal > 0 && amount > orderTotal) {
    amount = orderTotal;
  }

  if (payments.length && orderTotal > 0) {
    const stmtLike = payments.map((p, idx) => ({
      id: Number(p.statement_id) || idx + 1,
      trans_id: p.trans_id,
      date: p.date,
      amount: p.amount,
    }));
    const allocated = allocateStatementPaymentsForInvoice(stmtLike, orderTotal);
    payments = allocated.payments;
    if (allocated.total > 0) {
      amount = allocated.total;
    }
  }

  if (!payments.length && amount > 0) {
    if (tids.length) {
      payments = tids.map((tid) => ({
        statement_id: null,
        trans_id: tid,
        date: pDate,
        amount: tids.length === 1 ? amount : amount / tids.length,
      }));
    } else {
      payments = [
        {
          statement_id: null,
          trans_id: "",
          date: pDate,
          amount,
        },
      ];
    }
  } else if (payments.length === 1 && !String(payments[0].trans_id || "").trim() && tids[0]) {
    payments = [{ ...payments[0], trans_id: tids[0], amount: amount || payments[0].amount }];
  }

  const amountVal = Number.isFinite(amount) && amount > 0 ? amount : null;

  const invoiceCsv = invoicePaymentCsvFromLinked(payments, amountVal, pDate);
  const incomingPaid =
    sumPaymentAmountCsv(invoiceCsv.payment_amount) || amountVal || 0;

  if (incomingPaid <= 0 && payments.length === 0) {
    const sameInvoice =
      String(order.invoice_number || "").trim() === invoiceNumber;
    if (!sameInvoice) {
      await conn.execute(
        `UPDATE neworder SET invoice_number = ?
         WHERE order_id = ?
           AND (invoice_number IS NULL OR TRIM(invoice_number) = '')`,
        [invoiceNumber, orderId],
      );
    }
    return {
      ...order,
      invoice_number: invoiceNumber || order.invoice_number,
    };
  }

  // Treat payment_amount "0" as empty so merge does not keep a zero booking row.
  const orderForMerge = {
    ...order,
    payment_amount:
      Number(order.payment_amount) === 0 &&
      !String(order.payment_amount || "").includes(",")
        ? ""
        : order.payment_amount,
  };

  const mergedCsv = mergeOrderPaymentWithLinkedCsv(orderForMerge, invoiceCsv);
  let paymentIdVal = mergedCsv.payment_id || null;
  let paymentDateVal = mergedCsv.payment_date || null;
  let paymentAmountVal = mergedCsv.payment_amount || null;

  if (!paymentAmountVal && incomingPaid > 0) {
    const fallbackCsv = linkedPaymentsToOrderPaymentCsv(payments);
    paymentAmountVal =
      fallbackCsv.payment_amount || String(incomingPaid);
    paymentIdVal =
      paymentIdVal || fallbackCsv.payment_id || tids[0] || order.payment_id;
    paymentDateVal =
      paymentDateVal ||
      fallbackCsv.payment_date ||
      pDate ||
      order.payment_date;
  }

  if (!paymentIdVal && tids[0]) paymentIdVal = tids[0];

  const paymentsJson = mergeLinkedPaymentsJson(orderForMerge, payments);

  let paidSum = Math.max(
    sumPaymentAmountCsv(paymentAmountVal),
    amountVal || 0,
  );
  if (orderTotal > 0 && paidSum > orderTotal) {
    paidSum = orderTotal;
    paymentAmountVal = String(Number(orderTotal.toFixed(2)));
  }
  if (paidSum > 0 && !paymentAmountVal) {
    paymentAmountVal = String(paidSum);
  }
  const existingReceived = Number(order.amount_received);
  const amountReceivedVal =
    paidSum > 0
      ? paidSum
      : Number.isFinite(existingReceived) && existingReceived > 0
        ? existingReceived
        : null;
  const receivedDate =
    paymentDateVal ||
    order.payment_received_date ||
    pDate ||
    null;
  const paymentStatus = derivePaymentStatus(
    paidSum || amountReceivedVal || 0,
    order.totalamt,
  );

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
      amountReceivedVal,
      receivedDate,
      paymentsJson,
      paymentIdVal,
      paymentDateVal,
      paymentAmountVal,
      paymentStatus,
      orderId,
    ],
  );

  const paidForParty =
    paidSum > 0
      ? paidSum
      : Number(amountReceivedVal) > 0
        ? Number(amountReceivedVal)
        : 0;
  if (paidForParty > 0) {
    try {
      await syncPartyPaymentOutFromOrder(conn, orderId);
    } catch (partyErr) {
      console.error("syncPartyPaymentOutFromOrder:", partyErr);
    }
  }

  return {
    ...order,
    invoice_number: invoiceNumber,
    amount_received: amountReceivedVal,
    payment_received_date: receivedDate,
    linked_payments_json: paymentsJson,
    linked_payments: parseOrderLinkedPayments({
      ...order,
      linked_payments_json: paymentsJson,
    }),
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
      `SELECT buyers_order_no FROM invoices
       WHERE ${sqlTrimUtf8Eq("invoice_number")}
       ORDER BY id DESC LIMIT 1`,
      [num],
    );
    const buyersOrder = String(invRows?.[0]?.buyers_order_no ?? "").trim();

    const params = [num];
    let sql = `SELECT order_id, quote_number, invoice_number, totalamt, amount_received, payment_received_date,
              linked_payments_json, payment_id, payment_date, payment_amount, payment_status, transaction_id
       FROM neworder
       WHERE ${sqlTrimUtf8Eq("invoice_number")}`;
    if (buyersOrder) {
      sql += ` OR CAST(order_id AS CHAR) = ?`;
      params.push(buyersOrder);
    }

    const [rows] = await conn.execute(sql, params);
    for (const order of rows || []) {
      await syncOrderLinkedPaymentFromInvoice(conn, order);
    }
  }
}
