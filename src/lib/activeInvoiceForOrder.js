import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";

const ACTIVE_INVOICE_SQL = `
  ${EXCLUDE_PROFORMA_INVOICE_SQL}
  AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')
  AND invoice_number IS NOT NULL
  AND TRIM(invoice_number) <> ''
`;

/**
 * Active tax invoice linked to an order (not performa, not cancelled/deleted).
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conn
 * @param {{ order_id?: string|number, quote_number?: string, invoice_number?: string }} orderLike
 */
export async function findActiveInvoiceForOrder(conn, orderLike) {
  const orderId = String(orderLike?.order_id ?? "").trim();
  const invOnOrder = String(orderLike?.invoice_number ?? "").trim();

  if (invOnOrder) {
    const [byNum] = await conn.execute(
      `SELECT id, invoice_number
       FROM invoices
       WHERE TRIM(invoice_number) = ?
         AND ${ACTIVE_INVOICE_SQL}
       ORDER BY id DESC
       LIMIT 1`,
      [invOnOrder],
    );
    if (byNum?.[0]) return byNum[0];
  }

  if (!orderId) return null;

  const [byOrder] = await conn.execute(
    `SELECT id, invoice_number
     FROM invoices
     WHERE TRIM(COALESCE(buyers_order_no, '')) = ?
       AND ${ACTIVE_INVOICE_SQL}
     ORDER BY id DESC
     LIMIT 1`,
    [orderId],
  );

  return byOrder?.[0] || null;
}

export async function attachActiveInvoiceFields(conn, orders) {
  if (!Array.isArray(orders) || !orders.length) return orders;
  const out = [];
  for (const order of orders) {
    const inv = await findActiveInvoiceForOrder(conn, {
      order_id: order.order_id,
      quote_number: order.quote_number,
      invoice_number: order.invoice_number,
    });
    out.push({
      ...order,
      active_invoice_number: inv?.invoice_number || null,
      active_invoice_id: inv?.id || null,
    });
  }
  return out;
}
