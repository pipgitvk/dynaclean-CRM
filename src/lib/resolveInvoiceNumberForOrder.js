/**
 * Invoice number on neworder may be empty until upload; resolve from invoices.quotation_id.
 */
export async function resolveInvoiceNumberForOrder(conn, order) {
  const direct = String(order?.invoice_number || "").trim();
  if (direct) return direct;

  const quoteNumber = String(order?.quote_number || "").trim();
  if (!quoteNumber) return "";

  const candidates = new Set([quoteNumber]);

  try {
    const [qRows] = await conn.execute(
      "SELECT `S.No.` AS sno FROM quotations_records WHERE quote_number = ? LIMIT 1",
      [quoteNumber],
    );
    if (qRows?.[0]?.sno != null && qRows[0].sno !== "") {
      candidates.add(String(qRows[0].sno));
    }
  } catch (_) {
    /* optional */
  }

  const ids = [...candidates];
  const placeholders = ids.map(() => "?").join(",");
  const [invRows] = await conn.execute(
    `SELECT invoice_number
     FROM invoices
     WHERE quotation_id IN (${placeholders})
       AND invoice_number IS NOT NULL
       AND TRIM(invoice_number) <> ''
     ORDER BY id DESC
     LIMIT 1`,
    ids,
  );

  if (!invRows?.length) return "";
  return String(invRows[0].invoice_number || "").trim();
}
