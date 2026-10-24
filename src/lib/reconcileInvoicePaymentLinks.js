import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";
import { lookupInvoiceLinkedPayment } from "@/lib/invoiceLinkedPaymentLookup";
import { parseLinkedTransIds } from "@/lib/statementLinkedPurchases";
import { settleStatementsForInvoicePayment } from "@/lib/settleStatementsForInvoicePayment";
import { syncInvoiceAndOrderPaymentLink } from "@/lib/syncInvoiceOrderPaymentLink";
import { syncInvoicePaymentFromOrder } from "@/lib/syncInvoicePaymentFromOrder";
import { sqlTrimUtf8Eq } from "@/lib/sqlUtf8Compare";

function invoicePaymentStatusFromAmounts(amountPaid, grandTotal) {
  const paid = Number(amountPaid) || 0;
  const total = Number(grandTotal) || 0;
  if (total > 0 && paid >= total) return "PAID";
  if (paid > 0 && paid < total) return "PARTIAL";
  return "UNPAID";
}

async function fetchInvoiceRow(conn, invoiceNumber) {
  const num = String(invoiceNumber || "").trim();
  if (!num) return null;
  const [rows] = await conn.execute(
    `SELECT id, invoice_number, grand_total, amount_paid, linked_trans_ids, buyers_order_no
     FROM invoices
     WHERE ${sqlTrimUtf8Eq("invoice_number")}
       AND ${EXCLUDE_PROFORMA_INVOICE_SQL}
       AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')
     ORDER BY id DESC
     LIMIT 1`,
    [num],
  );
  return rows?.[0] || null;
}

/**
 * Repair one invoice: statements Settled + IP link, invoice amount_paid, order snapshot.
 */
export async function reconcileInvoicePaymentLink(conn, invoiceNumberRaw) {
  const invoiceNumber = String(invoiceNumberRaw || "").trim();
  if (!invoiceNumber) {
    return { ok: false, reason: "missing_invoice_number" };
  }

  let inv = await fetchInvoiceRow(conn, invoiceNumber);
  if (!inv) {
    return { ok: false, reason: "invoice_not_found", invoice_number: invoiceNumber };
  }

  const orderId = String(inv.buyers_order_no || "").trim();
  if (orderId) {
    await syncInvoicePaymentFromOrder(conn, orderId);
    inv = (await fetchInvoiceRow(conn, invoiceNumber)) || inv;
  }

  const linked = await lookupInvoiceLinkedPayment(conn, invoiceNumber);
  if (!linked?.found) {
    return {
      ok: true,
      invoice_number: invoiceNumber,
      updated: false,
      message: "No linked payment data found for this invoice",
    };
  }

  const payments = Array.isArray(linked.payments) ? linked.payments : [];
  const transIds = [
    ...new Set(
      payments
        .map((p) => String(p.trans_id || "").trim())
        .filter(Boolean),
    ),
  ];

  const grandTotal = Number(inv.grand_total) || 0;
  const paid = Number(linked.payment_amount) || 0;
  const balance = Math.max(0, grandTotal - paid);
  const paymentStatus = invoicePaymentStatusFromAmounts(paid, grandTotal);

  const mergedTrans = new Set([
    ...parseLinkedTransIds(inv.linked_trans_ids),
    ...transIds,
  ]);
  const linkedTransIdsJson =
    mergedTrans.size > 0
      ? JSON.stringify([...mergedTrans])
      : inv.linked_trans_ids;

  await conn.execute(
    `UPDATE invoices
     SET amount_paid = ?, balance_amount = ?, payment_status = ?, linked_trans_ids = ?
     WHERE id = ?`,
    [paid, balance, paymentStatus, linkedTransIdsJson, inv.id],
  );

  if (transIds.length) {
    await settleStatementsForInvoicePayment(conn, {
      invoiceId: inv.id,
      invoiceNumber,
      transIds,
    });
  }

  await syncInvoiceAndOrderPaymentLink(conn, {
    invoiceNumbers: [invoiceNumber],
    orderIds: orderId ? [orderId] : [],
  });

  return {
    ok: true,
    invoice_number: invoiceNumber,
    updated: true,
    amount_paid: paid,
    payment_status: paymentStatus,
    trans_ids: transIds,
    order_id: orderId || null,
  };
}

export async function reconcileAllInvoicePaymentLinks(conn, { limit = 5000 } = {}) {
  const [rows] = await conn.execute(
    `SELECT TRIM(invoice_number) AS invoice_number, MAX(id) AS max_id
     FROM invoices
     WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) <> ''
       AND ${EXCLUDE_PROFORMA_INVOICE_SQL}
       AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')
     GROUP BY TRIM(invoice_number)
     ORDER BY max_id DESC
     LIMIT ?`,
    [Math.min(Number(limit) || 5000, 10000)],
  );

  const results = [];
  for (const row of rows || []) {
    const num = String(row.invoice_number || "").trim();
    if (!num) continue;
    try {
      results.push(await reconcileInvoicePaymentLink(conn, num));
    } catch (e) {
      results.push({
        ok: false,
        invoice_number: num,
        error: e?.message || String(e),
      });
    }
  }

  const updated = results.filter((r) => r.updated).length;
  return { total: results.length, updated, results };
}
