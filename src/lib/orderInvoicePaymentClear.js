import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";

const INV_CMP =
  "TRIM(COALESCE(invoice_number, '')) COLLATE utf8mb4_unicode_ci = TRIM(?) COLLATE utf8mb4_unicode_ci";

/** Order rows tied to an invoice (before/after delete). */
export async function findOrderIdsForInvoice(conn, invoice) {
  const ids = new Set();
  if (!invoice) return [];

  const invNum = String(invoice.invoice_number || "").trim();
  const buyersOrder = String(invoice.buyers_order_no || "").trim();

  if (invNum) {
    const [rows] = await conn.execute(
      `SELECT order_id FROM neworder WHERE ${INV_CMP}`,
      [invNum],
    );
    for (const r of rows || []) ids.add(r.order_id);
  }

  if (buyersOrder) {
    const [rows] = await conn.execute(
      `SELECT order_id FROM neworder
       WHERE CAST(order_id AS CHAR) COLLATE utf8mb4_unicode_ci = TRIM(?) COLLATE utf8mb4_unicode_ci`,
      [buyersOrder],
    );
    for (const r of rows || []) ids.add(r.order_id);
  }

  return [...ids];
}

export async function clearOrderInvoicePaymentFields(
  conn,
  order,
  { deletedInvoiceNumber = null } = {},
) {
  const orderId = order?.order_id;
  if (!orderId) return order;

  await ensureOrderLinkedPaymentColumns(conn);

  const matchInv = deletedInvoiceNumber
    ? String(deletedInvoiceNumber).trim()
    : String(order.invoice_number || "").trim();

  await conn.execute(
    `UPDATE neworder SET
      amount_received = NULL,
      payment_received_date = NULL,
      linked_payments_json = NULL,
      payment_id = NULL,
      payment_date = NULL,
      payment_amount = NULL,
      payment_status = 'pending',
      invoice_number = CASE
        WHEN CHAR_LENGTH(TRIM(?)) > 0 AND ${INV_CMP}
        THEN NULL
        ELSE invoice_number
      END
     WHERE order_id = ?`,
    [matchInv, matchInv, orderId],
  );

  return {
    ...order,
    invoice_number:
      matchInv && String(order.invoice_number || "").trim() === matchInv
        ? null
        : order.invoice_number,
    amount_received: null,
    payment_received_date: null,
    linked_payments_json: null,
    payment_id: null,
    payment_date: null,
    payment_amount: null,
    payment_status: "pending",
    linked_payments: [],
  };
}

/** After invoice delete/cancel — reset linked payment on related orders. */
export async function refreshOrdersAfterInvoiceRemoved(conn, invoice) {
  const orderIds = await findOrderIdsForInvoice(conn, invoice);
  const invNum = String(invoice?.invoice_number || "").trim();

  for (const orderId of orderIds) {
    const [rows] = await conn.execute(
      `SELECT order_id, quote_number, invoice_number, totalamt, amount_received,
              payment_received_date, linked_payments_json, payment_id, payment_date,
              payment_amount, payment_status
       FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (!rows?.length) continue;
    await clearOrderInvoicePaymentFields(conn, rows[0], {
      deletedInvoiceNumber: invNum,
    });
  }
}
