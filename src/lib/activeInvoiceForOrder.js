import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";

const ACTIVE_INVOICE_SQL = `
  ${EXCLUDE_PROFORMA_INVOICE_SQL}
  AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')
  AND invoice_number IS NOT NULL
  AND TRIM(invoice_number) <> ''
`;

async function quotationIdCandidates(conn, quoteOrId) {
  const candidates = new Set();
  const q = String(quoteOrId || "").trim();
  if (!q) return candidates;
  candidates.add(q);

  try {
    const [byQuote] = await conn.execute(
      "SELECT `S.No.` AS sno FROM quotations_records WHERE quote_number = ? LIMIT 1",
      [q],
    );
    if (byQuote?.[0]?.sno != null && byQuote[0].sno !== "") {
      candidates.add(String(byQuote[0].sno));
    }
  } catch (_) {
    /* optional */
  }

  try {
    const [bySno] = await conn.execute(
      "SELECT quote_number FROM quotations_records WHERE TRIM(CAST(`S.No.` AS CHAR)) = ? LIMIT 1",
      [q],
    );
    const qn = bySno?.[0]?.quote_number;
    if (qn) candidates.add(String(qn).trim());
  } catch (_) {
    /* optional */
  }

  return candidates;
}

/**
 * Active tax invoice linked to an order (not performa, not cancelled/deleted).
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conn
 * @param {{ order_id?: string|number, quote_number?: string, invoice_number?: string }} orderLike
 */
export async function findActiveInvoiceForOrder(conn, orderLike) {
  const orderId = String(orderLike?.order_id ?? "").trim();
  const quoteNumber = String(orderLike?.quote_number ?? "").trim();
  const invOnOrder = String(orderLike?.invoice_number ?? "").trim();

  const conditions = [];
  const params = [];

  if (orderId) {
    conditions.push("TRIM(COALESCE(buyers_order_no, '')) = ?");
    params.push(orderId);
  }

  const qIds = await quotationIdCandidates(conn, quoteNumber);
  if (qIds.size > 0) {
    const placeholders = [...qIds].map(() => "?").join(",");
    conditions.push(`TRIM(CAST(quotation_id AS CHAR)) IN (${placeholders})`);
    params.push(...qIds);
  }

  if (invOnOrder) {
    conditions.push("TRIM(invoice_number) = ?");
    params.push(invOnOrder);
  }

  if (!conditions.length) return null;

  const [rows] = await conn.execute(
    `SELECT id, invoice_number
     FROM invoices
     WHERE (${conditions.join(" OR ")})
       AND ${ACTIVE_INVOICE_SQL}
     ORDER BY id DESC
     LIMIT 1`,
    params,
  );

  return rows?.[0] || null;
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
