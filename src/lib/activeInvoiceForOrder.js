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

  const invoiceByOrderId = new Map();
  const invoiceByNumber = new Map();

  const orderIds = [];
  const invNums = new Set();
  for (const order of orders) {
    const oid = String(order?.order_id ?? "").trim();
    if (oid) orderIds.push(oid);
    const inv = String(order?.invoice_number ?? "").trim();
    if (inv) invNums.add(inv);
  }

  const invoiceSelect = `
    id,
    TRIM(invoice_number) AS invoice_number,
    amount_paid,
    balance_amount,
    grand_total,
    linked_trans_ids,
    payment_status,
    status
  `;

  if (invNums.size > 0) {
    const nums = [...invNums];
    const ph = nums.map(() => "?").join(",");
    const [rows] = await conn.execute(
      `SELECT ${invoiceSelect}
       FROM invoices
       WHERE TRIM(invoice_number) IN (${ph})
         AND ${ACTIVE_INVOICE_SQL}
       ORDER BY id DESC`,
      nums,
    );
    for (const row of rows || []) {
      const key = String(row.invoice_number || "").trim();
      if (key && !invoiceByNumber.has(key)) {
        invoiceByNumber.set(key, row);
      }
    }
  }

  if (orderIds.length > 0) {
    const ph = orderIds.map(() => "?").join(",");
    const [rows] = await conn.execute(
      `SELECT ${invoiceSelect},
              TRIM(COALESCE(buyers_order_no, '')) AS buyers_order_no
       FROM invoices
       WHERE TRIM(COALESCE(buyers_order_no, '')) IN (${ph})
         AND ${ACTIVE_INVOICE_SQL}
       ORDER BY id DESC`,
      orderIds,
    );
    for (const row of rows || []) {
      const oid = String(row.buyers_order_no || "").trim();
      if (oid && !invoiceByOrderId.has(oid)) {
        invoiceByOrderId.set(oid, row);
      }
    }
  }

  return orders.map((order) => {
    const oid = String(order?.order_id ?? "").trim();
    const invOnOrder = String(order?.invoice_number ?? "").trim();
    let inv = invOnOrder ? invoiceByNumber.get(invOnOrder) : null;
    if (!inv && oid) inv = invoiceByOrderId.get(oid) || null;
    return {
      ...order,
      active_invoice_number: inv?.invoice_number || null,
      active_invoice_id: inv?.id || null,
      invoice_amount_paid: inv?.amount_paid ?? null,
      invoice_balance_amount: inv?.balance_amount ?? null,
      invoice_grand_total: inv?.grand_total ?? null,
      invoice_linked_trans_ids: inv?.linked_trans_ids ?? null,
      invoice_payment_status: inv?.payment_status ?? null,
    };
  });
}

/** Enrich a single order row with active invoice payment-link fields (order detail pages). */
export async function attachActiveInvoiceFieldsToOrder(conn, order) {
  if (!order) return order;
  const [enriched] = await attachActiveInvoiceFields(conn, [order]);
  return enriched || order;
}
