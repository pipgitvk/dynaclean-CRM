import { findActiveInvoiceForOrder } from "@/lib/activeInvoiceForOrder";

async function ensureInvoiceStatusColumn(conn) {
  try {
    await conn.execute("SELECT status FROM invoices LIMIT 1");
  } catch {
    await conn.execute(
      "ALTER TABLE invoices ADD COLUMN status ENUM('PAID', 'PARTIAL PAID', 'CANCELLED') NULL DEFAULT NULL",
    );
  }
}

/**
 * When an order had invoice documents uploaded (report_file), mark the linked
 * tax invoice in `invoices` as CANCELLED if one exists and is still active.
 */
export async function cancelActiveInvoiceForOrder(conn, orderLike) {
  const reportFile = String(orderLike?.report_file || "").trim();
  const orderInvoiceNumber = String(orderLike?.invoice_number || "").trim();
  if (!reportFile && !orderInvoiceNumber) {
    return { cancelled: false, reason: "no_invoice_on_order" };
  }

  const inv = await findActiveInvoiceForOrder(conn, {
    order_id: orderLike.order_id,
    quote_number: orderLike.quote_number,
    invoice_number: orderLike.invoice_number,
  });

  if (!inv?.id && orderInvoiceNumber) {
    await ensureInvoiceStatusColumn(conn);
    const [updateResult] = await conn.execute(
      `UPDATE invoices
       SET status = 'CANCELLED'
       WHERE TRIM(invoice_number) = ?
         AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')`,
      [orderInvoiceNumber],
    );
    if (Number(updateResult?.affectedRows) > 0) {
      return {
        cancelled: true,
        invoice_number: orderInvoiceNumber,
      };
    }
    return { cancelled: false, reason: "no_active_linked_invoice" };
  }

  if (!inv?.id) {
    return { cancelled: false, reason: "no_active_linked_invoice" };
  }

  await ensureInvoiceStatusColumn(conn);
  await conn.execute(`UPDATE invoices SET status = 'CANCELLED' WHERE id = ?`, [
    inv.id,
  ]);

  return {
    cancelled: true,
    invoiceId: inv.id,
    invoice_number: inv.invoice_number,
  };
}
