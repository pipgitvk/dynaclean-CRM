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
import { getOrderTotalForPayment } from "@/lib/paymentOrderStatus";

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
  let orderTotal = getOrderTotalForPayment(order);
  if (orderTotal <= 0 && order.quote_number) {
    const [qRows] = await conn.execute(
      `SELECT grand_total FROM quotations_records WHERE quote_number = ? LIMIT 1`,
      [order.quote_number],
    );
    orderTotal = Number(qRows?.[0]?.grand_total) || orderTotal;
  }

  const [invMetaRows] = await conn.execute(
    `SELECT amount_paid, grand_total, payment_status, linked_trans_ids, invoice_date
     FROM invoices
     WHERE ${sqlTrimUtf8Eq("invoice_number")}
     ORDER BY id DESC LIMIT 1`,
    [invoiceNumber],
  );
  const invMeta = invMetaRows?.[0];
  const invAmountPaid = Number(invMeta?.amount_paid) || 0;
  const invGrandTotal = Number(invMeta?.grand_total) || 0;
  const invStatus = String(invMeta?.payment_status || "").trim().toUpperCase();
  const tids = parseLinkedTransIds(invMeta?.linked_trans_ids);
  // Only trust invoice amount_paid when payment links (trans ids) exist.
  // Booking advance copied onto invoice without a link must not feed back into the order.
  if (invAmountPaid > 0 && tids.length > 0) {
    amount = Math.max(amount || 0, invAmountPaid);
  }
  if (orderTotal > 0 && amount > orderTotal) {
    amount = orderTotal;
  }

  const invoiceSettlesOrder =
    invAmountPaid > 0 &&
    tids.length > 0 &&
    orderTotal > 0 &&
    (invStatus === "PAID" ||
      invAmountPaid >= orderTotal - 0.01 ||
      (invGrandTotal > 0 && invAmountPaid >= invGrandTotal - 0.01));

  if (payments.length && orderTotal > 0 && !invoiceSettlesOrder) {
    const stmtLike = payments.map((p, idx) => ({
      id: Number(p.statement_id) || idx + 1,
      trans_id: p.trans_id,
      date: p.date,
      amount: p.amount,
    }));
    const allocCap = invGrandTotal > 0 ? invGrandTotal : orderTotal;
    const allocated = allocateStatementPaymentsForInvoice(stmtLike, allocCap);
    payments = allocated.payments;
    if (allocated.total > 0) {
      amount = Math.max(
        allocated.total,
        tids.length > 0 ? invAmountPaid : 0,
      );
      if (orderTotal > 0) amount = Math.min(amount, orderTotal);
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
  let incomingPaid = Math.max(
    sumPaymentAmountCsv(invoiceCsv.payment_amount) || 0,
    amountVal || 0,
    tids.length > 0 ? invAmountPaid : 0,
  );
  if (orderTotal > 0) incomingPaid = Math.min(incomingPaid, orderTotal);

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

  const settledCsv = {
    payment_id: invoiceCsv.payment_id || tids.join(",") || order.payment_id,
    payment_date:
      invoiceCsv.payment_date ||
      pDate ||
      invMeta?.invoice_date ||
      order.payment_date,
    payment_amount:
      invoiceCsv.payment_amount ||
      (incomingPaid > 0 ? String(Number(incomingPaid.toFixed(2))) : ""),
  };

  const mergedCsv = invoiceSettlesOrder
    ? settledCsv
    : mergeOrderPaymentWithLinkedCsv(orderForMerge, invoiceCsv);
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
    invAmountPaid,
    incomingPaid,
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
    orderTotal || order.totalamt,
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
    let sql = `SELECT no.order_id, no.quote_number, no.invoice_number, no.totalamt, no.amount_received,
              no.payment_received_date, no.linked_payments_json, no.payment_id, no.payment_date,
              no.payment_amount, no.payment_status, no.transaction_id,
              qr.grand_total AS quotation_grand_total
       FROM neworder no
       LEFT JOIN quotations_records qr ON qr.quote_number = no.quote_number
       WHERE ${sqlTrimUtf8Eq("no.invoice_number")}`;
    if (buyersOrder) {
      sql += ` OR CAST(no.order_id AS CHAR) = ?`;
      params.push(buyersOrder);
    }

    const [rows] = await conn.execute(sql, params);
    for (const order of rows || []) {
      await syncOrderLinkedPaymentFromInvoice(conn, order);
    }
  }
}
