/**
 * Server-side enrichment for order view pages (quotation + line items).
 */

function sumTotalsFromQuotationItems(itemRows) {
  let tax = 0;
  let total = 0;
  for (const it of itemRows) {
    const taxable = Number(it.total_taxable_amt || it.taxable_price || 0);
    const lineTotal = Number(it.total_price || 0);
    total += lineTotal;
    tax += lineTotal - taxable;
  }
  return { tax, total };
}

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").Connection} conn
 */
export async function fetchOrderViewQuotationBundle(conn, orderDetails) {
  const qn = (orderDetails?.quote_number || "").trim();
  let quotation = null;
  let itemRows = [];

  if (qn) {
    const [qrRows] = await conn.execute(
      `SELECT * FROM quotations_records WHERE TRIM(quote_number) = ? LIMIT 1`,
      [qn],
    );
    quotation = qrRows[0] || null;

    const [items] = await conn.execute(
      `SELECT * FROM quotation_items WHERE TRIM(quote_number) = ?`,
      [qn],
    );
    itemRows = items;
  }

  const merged = { ...orderDetails };

  if (quotation) {
    merged.company_name = merged.company_name || quotation.company_name;
    merged.company_address = merged.company_address || quotation.company_address;
    merged.state = merged.state || quotation.state;
    merged.ship_to = merged.ship_to || quotation.ship_to;
    merged.quotation_grand_total = quotation.grand_total;
    merged.quotation_subtotal = quotation.subtotal;
    merged.quotation_gst = quotation.gst;
  }

  const storedTotal = Number(merged.totalamt) || 0;
  const storedTax = Number(merged.taxamt) || 0;

  if (itemRows.length > 0) {
    const fromItems = sumTotalsFromQuotationItems(itemRows);
    if (storedTotal <= 0 && fromItems.total > 0) {
      merged.totalamt = fromItems.total;
    }
    if (storedTax <= 0 && fromItems.tax > 0) {
      merged.taxamt = fromItems.tax;
    }
  }

  if ((Number(merged.totalamt) || 0) <= 0 && quotation?.grand_total) {
    merged.totalamt = Number(quotation.grand_total) || 0;
  }
  if ((Number(merged.taxamt) || 0) <= 0 && quotation?.gst != null) {
    merged.taxamt = Number(quotation.gst) || 0;
  }

  const base = Number(merged.baseAmount) || 0;
  if (base <= 0 && quotation?.subtotal) {
    merged.baseAmount = Number(quotation.subtotal) || 0;
  }
  if (base <= 0 && itemRows.length > 0) {
    const fromItems = sumTotalsFromQuotationItems(itemRows);
    const taxableSum = itemRows.reduce(
      (acc, it) =>
        acc + Number(it.total_taxable_amt || it.taxable_price || 0),
      0,
    );
    if (taxableSum > 0) merged.baseAmount = taxableSum;
  }

  return { orderDetails: merged, items: itemRows };
}
