import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";

/**
 * Invoice for this order only (not shared across orders on the same quotation).
 * 1) neworder.invoice_number  2) invoices.buyers_order_no = order_id
 */
export async function resolveInvoiceNumberForOrder(conn, order) {
  const direct = String(order?.invoice_number || "").trim();
  if (direct) return direct;

  const orderId = String(order?.order_id ?? "").trim();
  if (!orderId) return "";

  const [invRows] = await conn.execute(
    `SELECT invoice_number
     FROM invoices
     WHERE TRIM(COALESCE(buyers_order_no, '')) = ?
       AND invoice_number IS NOT NULL
       AND TRIM(invoice_number) <> ''
       AND ${EXCLUDE_PROFORMA_INVOICE_SQL}
       AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')
     ORDER BY id DESC
     LIMIT 1`,
    [orderId],
  );

  if (!invRows?.length) return "";
  return String(invRows[0].invoice_number || "").trim();
}
