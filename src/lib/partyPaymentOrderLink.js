import { ensurePartyPaymentsTable } from "@/lib/ensurePartyPaymentsTable";
import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { allocateStatementPaymentsForInvoice } from "@/lib/invoiceLinkedPaymentLookup";
import {
  linkedPaymentsToOrderPaymentCsv,
  sumPaymentAmountCsv,
} from "@/lib/orderPaymentHistory";
import { normalizePartyPaymentAmounts } from "@/lib/partyPaymentsCompute";
import { syncInvoiceAndOrderPaymentLink } from "@/lib/syncInvoiceOrderPaymentLink";
import {
  partyPaymentToken,
  parsePartyPaymentLinkedStatementIds,
  unlinkAllStatementsForPartyPayment,
} from "@/lib/partyPaymentStatementLink";
import { lookupInvoiceLinkedPayment } from "@/lib/invoiceLinkedPaymentLookup";
import { parseOrderLinkedPayments } from "@/lib/orderLinkedPaymentsDisplay";
import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";
import { getOrderTotalForPayment } from "@/lib/paymentOrderStatus";
import { sqlTrimUtf8Eq } from "@/lib/sqlUtf8Compare";
import {
  partyPaymentOutRecordedForOrder,
  recordPartyPaymentOutEntry,
  reconcilePartyPaymentTotalsFromHistory,
  sumPartyPaymentOutFromHistory,
} from "@/lib/partyPaymentHistory";

/** Quotation grand total (same as order list / upload form) when neworder.totalamt is still 0. */
export async function resolveOrderTotalAmount(conn, orderId) {
  const [rows] = await conn.execute(
    `SELECT no.totalamt, no.baseAmount, no.taxamt, no.invoice_number,
            qr.grand_total AS quotation_grand_total
     FROM neworder no
     LEFT JOIN quotations_records qr ON qr.quote_number = no.quote_number
     WHERE no.order_id = ? LIMIT 1`,
    [orderId],
  );
  const row = rows?.[0];
  if (!row) return 0;

  const fromOrder = getOrderTotalForPayment(row);
  if (fromOrder > 0) return fromOrder;

  const invNum = String(row.invoice_number || "").trim();
  if (!invNum) return 0;

  const [invRows] = await conn.execute(
    `SELECT grand_total FROM invoices
     WHERE ${sqlTrimUtf8Eq("invoice_number")}
     ORDER BY id DESC LIMIT 1`,
    [invNum],
  );
  return Number(invRows?.[0]?.grand_total) || 0;
}

async function fetchStatementsByIds(conn, statementIds) {
  const ids = (statementIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await conn.execute(
    `SELECT id, trans_id, date, amount FROM statements WHERE id IN (${placeholders})`,
    ids,
  );
  return rows || [];
}

function computeOrderPaymentStatus(paid, orderTotal) {
  const total = Number(orderTotal) || 0;
  const p = Number(paid) || 0;
  if (p >= total && total > 0) return "paid";
  if (p > 0 && p < total) return "partially paid";
  return "pending";
}

/** Matches order list "Pending Invoice" (no report / booking / dispatch yet). */
export function isOrderPendingInvoice(order) {
  if (!order) return false;
  if (Number(order.is_cancelled) === 1) return false;
  if (String(order.approval_status || "").toLowerCase() === "rejected") {
    return false;
  }
  if (order.installation_status) return false;
  if (Number(order.delivery_status) > 0) return false;
  if (Number(order.dispatch_status) > 0) return false;
  const booking = order.booking_id != null ? String(order.booking_id).trim() : "";
  if (booking && booking !== "0") return false;
  const report = order.report_file != null ? String(order.report_file).trim() : "";
  if (report) return false;
  return true;
}

/**
 * Order row: only this order's share (up to order total). Rest stays on party_payments.balance.
 */
export async function buildOrderPaymentPatchFromPartyPayment(
  conn,
  partyPaymentRow,
  orderTotal,
) {
  const cap = Math.max(0, Number(orderTotal) || 0);
  const statementIds = parsePartyPaymentLinkedStatementIds(
    partyPaymentRow.linked_statement_ids,
  );
  const statements = await fetchStatementsByIds(conn, statementIds);
  const allocated = allocateStatementPaymentsForInvoice(statements, cap);
  const orderCsv = linkedPaymentsToOrderPaymentCsv(allocated.payments);

  let paid =
    Number(allocated.total) ||
    sumPaymentAmountCsv(orderCsv.payment_amount) ||
    0;
  if (cap > 0) paid = Math.min(paid, cap);

  const paymentAmount =
    paid > 0
      ? String(Number(paid.toFixed(2)))
      : orderCsv.payment_amount || null;

  let paymentReceivedDate = null;
  if (orderCsv.payment_date) {
    paymentReceivedDate = String(orderCsv.payment_date).split(",")[0].trim();
  } else if (allocated.payments?.[0]?.date) {
    paymentReceivedDate = String(allocated.payments[0].date).slice(0, 10);
  }

  return {
    payment_id: orderCsv.payment_id,
    payment_date: orderCsv.payment_date,
    payment_amount: paymentAmount,
    amount_received: paid > 0 ? Number(paid.toFixed(2)) : null,
    payment_received_date: paymentReceivedDate,
    linked_payments_json:
      allocated.payments?.length > 0
        ? JSON.stringify(allocated.payments)
        : null,
    payment_status: computeOrderPaymentStatus(paid, cap),
  };
}

function orderPaidAmount(order, orderTotal) {
  const paid = Math.max(
    sumPaymentAmountCsv(order?.payment_amount),
    Number(order?.amount_received) || 0,
  );
  const total = Number(orderTotal) || 0;
  if (total > 0) return Math.min(paid, total);
  return paid;
}

async function collectOrderStatementIds(conn, order) {
  const ids = new Set();
  for (const p of parseOrderLinkedPayments(order)) {
    const sid = Number(p.statement_id);
    if (sid > 0) ids.add(sid);
  }
  const invNum = String(order?.invoice_number || "").trim();
  if (invNum) {
    const linked = await lookupInvoiceLinkedPayment(conn, invNum);
    for (const p of linked.payments || []) {
      const sid = Number(p.statement_id);
      if (sid > 0) ids.add(sid);
    }
  }
  return ids;
}

async function partyPaymentMatchesViaToken(conn, partyPaymentId, stmtIds) {
  const token = partyPaymentToken(partyPaymentId);
  if (!token || !stmtIds.size) return false;
  for (const sid of stmtIds) {
    const [rows] = await conn.execute(
      `SELECT linked_purchase_ids FROM statements WHERE id = ? LIMIT 1`,
      [sid],
    );
    const tokens = parseLinkedPurchaseTokens(rows?.[0]?.linked_purchase_ids);
    if (tokens.includes(token)) return true;
  }
  return false;
}

async function findPaidOrderIdsForCustomer(conn, customerId, phone) {
  const params = [];
  const conditions = [];
  if (customerId) {
    conditions.push(`TRIM(CAST(q.customer_id AS CHAR)) = TRIM(?)`);
    params.push(String(customerId).trim());
  }
  const normalizedPhone = String(phone || "").trim().replace(/\s+/g, "");
  if (normalizedPhone) {
    conditions.push(`REPLACE(TRIM(o.contact), ' ', '') = ?`);
    params.push(normalizedPhone);
    conditions.push(`REPLACE(TRIM(o.contact), ' ', '') LIKE ?`);
    params.push(`%${normalizedPhone.slice(-10)}`);
  }
  if (!conditions.length) return [];

  const [rows] = await conn.execute(
    `SELECT o.order_id, o.totalamt, o.payment_amount, o.amount_received
     FROM neworder o
     LEFT JOIN quotations_records q ON q.quote_number = o.quote_number
     WHERE (${conditions.join(" OR ")})
     ORDER BY o.order_id DESC
     LIMIT 100`,
    params,
  );
  const ids = [];
  for (const o of rows || []) {
    const total = Number(o.totalamt) || 0;
    const paid = orderPaidAmount(o, total);
    if (paid > 0) ids.push(o.order_id);
  }
  return ids;
}

/**
 * Party payment pool that should absorb this order's paid amount (statement / customer match).
 */
export async function findPartyPaymentForPaidOrder(conn, orderId) {
  await ensurePartyPaymentsTable(conn);

  const [orderRows] = await conn.execute(
    `SELECT order_id, totalamt, contact, invoice_number, payment_amount, amount_received,
            linked_payments_json, payment_id, payment_date, payment_received_date, transaction_id
     FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  if (!orderRows?.length) return null;

  const order = orderRows[0];
  const orderTotal = await resolveOrderTotalAmount(conn, orderId);
  const paid = orderPaidAmount(order, orderTotal);
  if (paid <= 0) return null;

  const stmtIds = await collectOrderStatementIds(conn, order);
  const customerId = await resolveCustomerIdForOrder(conn, orderId);
  const orderPhone = String(order.contact || "")
    .trim()
    .replace(/\s+/g, "");

  const params = [];
  const matchParts = [];
  if (customerId) {
    matchParts.push(`TRIM(CAST(customer_id AS CHAR)) = TRIM(?)`);
    params.push(String(customerId));
  }
  if (orderPhone) {
    matchParts.push(
      `REPLACE(TRIM(phone), ' ', '') = ? OR REPLACE(TRIM(phone), ' ', '') LIKE ?`,
    );
    params.push(orderPhone, `%${orderPhone.slice(-10)}`);
  }
  if (!matchParts.length) return null;

  const [pps] = await conn.execute(
    `SELECT id, customer_id, amount_in, amount_out, balance, linked_statement_ids, linked_order_id, phone
     FROM party_payments
     WHERE (${matchParts.join(" OR ")})
       AND linked_statement_ids IS NOT NULL
       AND TRIM(linked_statement_ids) <> ''
       AND TRIM(linked_statement_ids) <> '[]'
       AND amount_in > amount_out
     ORDER BY id DESC`,
    params,
  );
  if (!pps?.length) return null;

  for (const pp of pps) {
    const ppStmtIds = parsePartyPaymentLinkedStatementIds(
      pp.linked_statement_ids,
    );
    if (ppStmtIds.some((id) => stmtIds.has(id))) return pp;
    if (await partyPaymentMatchesViaToken(conn, pp.id, stmtIds)) return pp;
  }

  if (pps.length === 1) return pps[0];

  if (customerId) {
    const byCid = pps.filter(
      (p) => String(p.customer_id ?? "").trim() === String(customerId).trim(),
    );
    if (byCid.length === 1) return byCid[0];
  }

  return null;
}

/**
 * When an order is paid (invoice/statement link), move that share to party_payments.amount_out.
 */
export async function syncPartyPaymentOutFromOrder(conn, orderId, { createdBy } = {}) {
  const pp = await findPartyPaymentForPaidOrder(conn, orderId);
  if (!pp) return null;

  const [orderRows] = await conn.execute(
    `SELECT totalamt, payment_amount, amount_received FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  if (!orderRows?.length) return null;

  const order = orderRows[0];
  const orderTotal = await resolveOrderTotalAmount(conn, orderId);
  const utilis = orderPaidAmount(order, orderTotal);
  if (utilis <= 0) return null;

  const amountIn = Number(pp.amount_in) || 0;
  const linkedOid = Number(pp.linked_order_id) || 0;
  const oid = Number(orderId);

  if (await partyPaymentOutRecordedForOrder(conn, pp.id, orderId)) {
    const amounts = await reconcilePartyPaymentTotalsFromHistory(conn, pp.id);
    return {
      skipped: true,
      party_payment_id: pp.id,
      amount_out: amounts?.amount_out,
    };
  }

  const outFromHistory = await sumPartyPaymentOutFromHistory(conn, pp.id);
  const remaining = Math.max(0, amountIn - outFromHistory);
  const apply = Math.min(utilis, remaining);
  if (apply <= 0) {
    return { skipped: true, party_payment_id: pp.id };
  }

  const [meta] = await conn.execute(
    `SELECT invoice_number, payment_received_date FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );

  await recordPartyPaymentOutEntry(conn, pp.id, {
    orderId,
    invoiceNumber: meta?.[0]?.invoice_number,
    amount: apply,
    entryDate: meta?.[0]?.payment_received_date,
    createdBy,
  });

  const linkOrder = linkedOid || oid;
  await conn.execute(
    `UPDATE party_payments SET linked_order_id = ? WHERE id = ?`,
    [linkOrder, pp.id],
  );

  const amounts = await reconcilePartyPaymentTotalsFromHistory(conn, pp.id);

  return {
    party_payment_id: pp.id,
    amount_out: amounts?.amount_out,
    balance: amounts?.balance,
    status: amounts?.status,
    applied: apply,
  };
}

/** Re-scan paid orders for this party payment's customer and apply Out. */
export async function backfillPartyPaymentOutForCustomer(conn, partyPaymentRow) {
  const customerId = String(partyPaymentRow.customer_id ?? "").trim();
  const phone = String(partyPaymentRow.phone ?? "").trim();
  const orderIds = await findPaidOrderIdsForCustomer(conn, customerId, phone);
  let last = null;
  for (const oid of orderIds) {
    const result = await syncPartyPaymentOutFromOrder(conn, oid);
    if (result && !result.skipped) last = result;
  }
  return last;
}

export async function resolveCustomerIdForOrder(conn, orderId) {
  const [orderRows] = await conn.execute(
    `SELECT quote_number, contact FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  if (!orderRows?.length) return null;
  const quoteNumber = orderRows[0].quote_number;
  if (quoteNumber) {
    const [qr] = await conn.execute(
      `SELECT customer_id FROM quotations_records WHERE quote_number = ? LIMIT 1`,
      [quoteNumber],
    );
    const cid = qr?.[0]?.customer_id;
    if (cid != null && String(cid).trim() !== "") {
      return String(cid).trim();
    }
  }
  const phone = String(orderRows[0].contact || "").trim().replace(/\s+/g, "");
  if (phone) {
    const [cr] = await conn.execute(
      `SELECT customer_id FROM customers WHERE phone = ? ORDER BY customer_id DESC LIMIT 1`,
      [phone],
    );
    if (cr?.[0]?.customer_id != null) {
      return String(cr[0].customer_id).trim();
    }
  }
  return null;
}

/**
 * Pending-invoice upload: prompt while party pool has balance (In − Out > 0).
 * No prompt when balance is 0 (fully utilized).
 */
export async function findPartyPaymentPromptForOrder(conn, orderId) {
  await ensurePartyPaymentsTable(conn);
  const customerId = await resolveCustomerIdForOrder(conn, orderId);

  const [orderRows] = await conn.execute(
    `SELECT totalamt, contact, report_file, booking_id, dispatch_status,
            delivery_status, installation_status, is_cancelled, approval_status
     FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  if (!orderRows?.length) return null;

  const orderRow = orderRows[0];
  if (!isOrderPendingInvoice(orderRow)) return null;

  const orderTotal = await resolveOrderTotalAmount(conn, orderId);
  const orderPhone = String(orderRow.contact || "")
    .trim()
    .replace(/\s+/g, "");

  const params = [];
  const matchParts = [];
  if (customerId) {
    matchParts.push(`TRIM(CAST(customer_id AS CHAR)) = TRIM(?)`);
    params.push(String(customerId));
  }
  if (orderPhone) {
    matchParts.push(
      `REPLACE(TRIM(phone), ' ', '') = ? OR REPLACE(TRIM(phone), ' ', '') LIKE ?`,
    );
    params.push(orderPhone, `%${orderPhone.slice(-10)}`);
  }
  if (!matchParts.length) return null;

  const [rows] = await conn.execute(
    `SELECT id, customer_id, name, amount_in, amount_out, balance, status, linked_statement_ids, linked_order_id
     FROM party_payments
     WHERE (${matchParts.join(" OR ")})
       AND linked_statement_ids IS NOT NULL
       AND TRIM(linked_statement_ids) <> ''
       AND TRIM(linked_statement_ids) <> '[]'
       AND amount_in > amount_out
     ORDER BY id DESC
     LIMIT 1`,
    params,
  );
  const row = rows?.[0];
  if (!row) return null;

  const statementIds = parsePartyPaymentLinkedStatementIds(row.linked_statement_ids);
  if (!statementIds.length) return null;

  const amountIn = Number(row.amount_in) || 0;
  const amountOut = Number(row.amount_out) || 0;
  const partyBalance = Math.max(0, amountIn - amountOut);
  if (partyBalance <= 0) return null;

  if (orderTotal <= 0) return null;

  const applyCap = Math.min(orderTotal, partyBalance);

  const paymentPreview = await buildOrderPaymentPatchFromPartyPayment(
    conn,
    row,
    applyCap,
  );

  return {
    party_payment_id: Number(row.id),
    customer_id: String(row.customer_id ?? ""),
    party_name: row.name,
    amount_in: amountIn,
    amount_out: amountOut,
    party_balance: partyBalance,
    order_total: orderTotal,
    apply_amount: applyCap,
    statement_count: statementIds.length,
    payment_amount: paymentPreview.payment_amount,
    payment_id: paymentPreview.payment_id,
    payment_date: paymentPreview.payment_date,
  };
}

export async function applyPartyPaymentOrderLinkYes(
  conn,
  partyPaymentId,
  orderId,
  { createdBy } = {},
) {
  await ensurePartyPaymentsTable(conn);
  const ppId = Number(partyPaymentId);
  const oid = Number(orderId);
  if (!ppId || !oid) throw new Error("Invalid party payment or order");

  const [ppRows] = await conn.execute(
    `SELECT amount_in, amount_out, linked_statement_ids, linked_order_id FROM party_payments WHERE id = ? LIMIT 1`,
    [ppId],
  );
  if (!ppRows?.length) throw new Error("Party payment not found");

  const [orderRows] = await conn.execute(
    `SELECT order_id, totalamt, invoice_number FROM neworder WHERE order_id = ? LIMIT 1`,
    [oid],
  );
  if (!orderRows?.length) throw new Error("Order not found");

  const order = orderRows[0];
  const orderTotal = await resolveOrderTotalAmount(conn, oid);
  const amountIn = Number(ppRows[0].amount_in) || 0;
  const outFromHistory = await sumPartyPaymentOutFromHistory(conn, ppId);
  const remaining = Math.max(0, amountIn - outFromHistory);
  const apply = Math.min(orderTotal, remaining);
  if (remaining <= 0) {
    throw new Error(
      "Party payment balance is zero — no amount left to apply to this order",
    );
  }
  if (orderTotal <= 0) {
    throw new Error(
      "Order total is missing — ensure quotation grand total or Total Amount is saved on the order",
    );
  }
  if (apply <= 0) {
    throw new Error("Could not apply party payment to this order");
  }

  const linkOrder =
    Number(ppRows[0].linked_order_id) > 0
      ? Number(ppRows[0].linked_order_id)
      : oid;

  await ensureOrderLinkedPaymentColumns(conn);
  const orderPayment = await buildOrderPaymentPatchFromPartyPayment(
    conn,
    ppRows[0],
    apply,
  );

  await conn.execute(
    `UPDATE neworder SET
      payment_id = ?,
      payment_date = ?,
      payment_amount = ?,
      amount_received = ?,
      payment_received_date = ?,
      linked_payments_json = ?,
      payment_status = ?
     WHERE order_id = ?`,
    [
      orderPayment.payment_id,
      orderPayment.payment_date,
      orderPayment.payment_amount,
      orderPayment.amount_received,
      orderPayment.payment_received_date,
      orderPayment.linked_payments_json,
      orderPayment.payment_status,
      oid,
    ],
  );

  try {
    await syncInvoiceAndOrderPaymentLink(conn, {
      invoiceNumbers:
        order.invoice_number && String(order.invoice_number).trim()
          ? [String(order.invoice_number).trim()]
          : [],
      orderIds: [oid],
    });
  } catch (syncErr) {
    console.error("Party payment order link invoice sync:", syncErr);
  }

  try {
    await recordPartyPaymentOutEntry(conn, ppId, {
      orderId: oid,
      invoiceNumber: order.invoice_number,
      amount: apply,
      entryDate: orderPayment.payment_received_date,
      createdBy,
    });
    await conn.execute(
      `UPDATE party_payments SET linked_order_id = ? WHERE id = ?`,
      [linkOrder, ppId],
    );
    const amounts = await reconcilePartyPaymentTotalsFromHistory(conn, ppId);
    return {
      linked: true,
      amount_out: amounts?.amount_out,
      status: amounts?.status,
      order_payment_amount: orderPayment.payment_amount,
      order_payment_status: orderPayment.payment_status,
    };
  } catch (histErr) {
    console.error("recordPartyPaymentOutEntry:", histErr);
    throw histErr;
  }
}

export async function applyPartyPaymentOrderLinkNo(conn, partyPaymentId) {
  await ensurePartyPaymentsTable(conn);
  const ppId = Number(partyPaymentId);
  if (!ppId) throw new Error("Invalid party payment");

  const [ppRows] = await conn.execute(
    `SELECT linked_statement_ids FROM party_payments WHERE id = ? LIMIT 1`,
    [ppId],
  );
  if (!ppRows?.length) throw new Error("Party payment not found");

  const previousIds = parsePartyPaymentLinkedStatementIds(
    ppRows[0].linked_statement_ids,
  );

  await unlinkAllStatementsForPartyPayment(conn, ppId);

  const amounts = normalizePartyPaymentAmounts({
    amount_in: 0,
    amount_out: 0,
  });

  await conn.execute(
    `UPDATE party_payments SET
      linked_statement_ids = NULL,
      linked_order_id = NULL,
      amount_in = ?,
      amount_out = ?,
      balance = ?,
      status = ?
     WHERE id = ?`,
    [
      amounts.amount_in,
      amounts.amount_out,
      amounts.balance,
      amounts.status,
      ppId,
    ],
  );

  return { unsettled: true, statements_updated: previousIds.length };
}
