import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { parseLinkedTransIds } from "@/lib/statementLinkedPurchases";

/**
 * Direct write: invoices.amount_paid + linked_trans_ids → neworder payment fields.
 * Used after Link Payment so order Paid is not stuck at 0/NULL.
 */
export async function pushInvoicePaymentToNeworder(conn, invoice) {
  if (!invoice) return { updated: 0 };

  await ensureOrderLinkedPaymentColumns(conn);

  const invoiceNumber = String(invoice.invoice_number || "").trim();
  const buyersOrder = String(invoice.buyers_order_no || "").trim();
  const amountPaid = Number(invoice.amount_paid) || 0;
  const tids = parseLinkedTransIds(invoice.linked_trans_ids);

  if (!invoiceNumber && !buyersOrder) return { updated: 0 };

  // Unlink / zero paid → clear payment snapshot (keep invoice_number).
  if (amountPaid <= 0 && tids.length === 0) {
    const params = [];
    let where = [];
    if (buyersOrder) {
      where.push("CAST(order_id AS CHAR) = ?");
      params.push(buyersOrder);
    }
    if (invoiceNumber) {
      where.push("TRIM(invoice_number) = ?");
      params.push(invoiceNumber);
    }
    if (!where.length) return { updated: 0 };

    const [result] = await conn.execute(
      `UPDATE neworder SET
        amount_received = NULL,
        payment_received_date = NULL,
        linked_payments_json = NULL,
        payment_id = NULL,
        payment_date = NULL,
        payment_amount = NULL,
        payment_status = 'pending'
       WHERE ${where.join(" OR ")}`,
      params,
    );
    return { updated: result?.affectedRows || 0, cleared: true };
  }

  const paymentId = tids.length ? tids.join(",") : null;
  const paymentAmount = String(amountPaid);
  const paymentsJson = JSON.stringify(
    tids.length
      ? tids.map((tid) => ({
          statement_id: null,
          trans_id: tid,
          date: null,
          amount: tids.length === 1 ? amountPaid : amountPaid / tids.length,
        }))
      : [
          {
            statement_id: null,
            trans_id: "",
            date: null,
            amount: amountPaid,
          },
        ],
  );

  let orderTotal = 0;
  if (buyersOrder) {
    const [ordRows] = await conn.execute(
      `SELECT no.totalamt, qr.grand_total AS quotation_grand_total
       FROM neworder no
       LEFT JOIN quotations_records qr ON qr.quote_number = no.quote_number
       WHERE CAST(no.order_id AS CHAR) = ?
       LIMIT 1`,
      [buyersOrder],
    );
    const o = ordRows?.[0];
    const q = Number(o?.quotation_grand_total) || 0;
    orderTotal = q > 0 ? q : Number(o?.totalamt) || 0;
  }

  let paymentStatus = "pending";
  if (amountPaid > 0) {
    paymentStatus =
      orderTotal > 0 && amountPaid >= orderTotal - 0.01
        ? "paid"
        : "partially paid";
  }

  const params = [
    invoiceNumber || null,
    amountPaid,
    paymentsJson,
    paymentId,
    paymentAmount,
    paymentStatus,
  ];
  let where = [];
  if (buyersOrder) {
    where.push("CAST(order_id AS CHAR) = ?");
    params.push(buyersOrder);
  }
  if (invoiceNumber) {
    where.push("TRIM(invoice_number) = ?");
    params.push(invoiceNumber);
  }

  const [result] = await conn.execute(
    `UPDATE neworder SET
      invoice_number = COALESCE(NULLIF(TRIM(invoice_number), ''), ?),
      amount_received = ?,
      linked_payments_json = ?,
      payment_id = ?,
      payment_amount = ?,
      payment_status = ?
     WHERE ${where.join(" OR ")}`,
    params,
  );

  return {
    updated: result?.affectedRows || 0,
    order_id: buyersOrder || null,
    amount_paid: amountPaid,
    payment_id: paymentId,
  };
}

/** Load invoice row(s) by id and push payment onto matching neworder. */
export async function pushInvoiceIdsPaymentToNeworder(conn, invoiceIds) {
  const ids = [...new Set((invoiceIds || []).map(Number).filter((n) => n > 0))];
  if (!ids.length) return [];

  const [rows] = await conn.query(
    `SELECT id, invoice_number, buyers_order_no, amount_paid, linked_trans_ids
     FROM invoices WHERE id IN (?)`,
    [ids],
  );

  /** Same order can appear on multiple invoices in one bulk link — keep highest amount_paid. */
  const bestByOrderKey = new Map();
  for (const inv of rows || []) {
    const orderKey =
      String(inv.buyers_order_no || "").trim() ||
      String(inv.invoice_number || "").trim();
    if (!orderKey) {
      bestByOrderKey.set(`inv:${inv.id}`, inv);
      continue;
    }
    const prev = bestByOrderKey.get(orderKey);
    const paid = Number(inv.amount_paid) || 0;
    const prevPaid = Number(prev?.amount_paid) || 0;
    if (!prev || paid >= prevPaid) {
      bestByOrderKey.set(orderKey, inv);
    }
  }

  const results = [];
  for (const inv of bestByOrderKey.values()) {
    results.push({
      invoice_id: inv.id,
      ...(await pushInvoicePaymentToNeworder(conn, inv)),
    });
  }
  return results;
}
