import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";

/**
 * After tax invoice create: set neworder.invoice_number when order is known.
 * Does not clear an existing different invoice number on the order.
 */
export async function linkCreatedInvoiceToNeworder(
  conn,
  { orderId, invoiceNumber, invoiceDate = null },
) {
  const oid = String(orderId ?? "").trim();
  const inv = String(invoiceNumber ?? "").trim();
  if (!oid || !inv) return false;

  await ensureOrderLinkedPaymentColumns(conn);

  const [result] = await conn.execute(
    `UPDATE neworder SET
      invoice_number = CASE
        WHEN invoice_number IS NULL OR TRIM(invoice_number) = '' THEN ?
        ELSE invoice_number
      END
     WHERE order_id = ?`,
    [inv, oid],
  );

  const dateStr = invoiceDate
    ? String(invoiceDate).trim().slice(0, 10)
    : null;
  if (dateStr) {
    try {
      await conn.execute(
        `UPDATE neworder SET invoice_date = COALESCE(invoice_date, ?) WHERE order_id = ?`,
        [dateStr, oid],
      );
    } catch (_) {
      /* invoice_date column may be missing on older DBs */
    }
  }

  return (result?.affectedRows ?? 0) > 0;
}
