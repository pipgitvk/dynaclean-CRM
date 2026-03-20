import { getDbConnection } from "@/lib/db";

function itemModel(it) {
  const name = String(it.item_name ?? "").trim();
  const code = String(it.item_code ?? "").trim();
  const spec = String(it.specification ?? "").trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return spec;
}

/**
 * Latest quotation line items per customer (same “latest quote” rule as grand totals:
 * by quote_date DESC, created_at DESC on quotations_records).
 * @returns {Record<string, { quote_number: string|null, lines: Array<{ model: string, quantity: number, total_price: number, price_per_unit: number }> }>}
 */
export async function getLatestQuotationItemsByCustomerIds(customerIds) {
  const ids = [...new Set((customerIds || []).map(String).filter(Boolean))].slice(
    0,
    50,
  );
  if (ids.length === 0) return {};

  const conn = await getDbConnection();
  const ph = ids.map(() => "?").join(",");

  const [headerRows] = await conn.execute(
    `SELECT customer_id, quote_number
     FROM quotations_records
     WHERE customer_id IN (${ph})
     ORDER BY quote_date DESC, created_at DESC`,
    ids,
  );

  const quoteByCustomer = {};
  for (const r of headerRows || []) {
    const cid = String(r.customer_id ?? "").trim();
    if (!cid || quoteByCustomer[cid] !== undefined) continue;
    quoteByCustomer[cid] = String(r.quote_number ?? "").trim() || null;
  }

  const quoteNumbers = [
    ...new Set(Object.values(quoteByCustomer).filter(Boolean)),
  ];
  if (quoteNumbers.length === 0) {
    const empty = {};
    for (const cid of ids) {
      empty[cid] = { quote_number: null, lines: [] };
    }
    return empty;
  }

  const phQ = quoteNumbers.map(() => "?").join(",");
  const [itemRows] = await conn.execute(
    `SELECT quote_number, item_name, item_code, specification, quantity,
            price_per_unit, total_price
     FROM quotation_items
     WHERE quote_number IN (${phQ})
     ORDER BY quote_number, item_name, item_code`,
    quoteNumbers,
  );

  const itemsByQuote = {};
  for (const it of itemRows || []) {
    const qn = String(it.quote_number ?? "");
    if (!itemsByQuote[qn]) itemsByQuote[qn] = [];
    const qty = Math.max(0, parseInt(String(it.quantity ?? 0), 10) || 0);
    const model = itemModel(it);
    if (!model && qty < 1) continue;
    const total_price =
      it.total_price != null && it.total_price !== ""
        ? Number(it.total_price)
        : 0;
    const price_per_unit =
      it.price_per_unit != null && it.price_per_unit !== ""
        ? Number(it.price_per_unit)
        : 0;
    itemsByQuote[qn].push({
      model,
      quantity: qty,
      total_price: Number.isFinite(total_price) ? total_price : 0,
      price_per_unit: Number.isFinite(price_per_unit) ? price_per_unit : 0,
    });
  }

  const out = {};
  for (const cid of ids) {
    const qn = quoteByCustomer[cid];
    if (!qn || !itemsByQuote[qn]?.length) {
      out[cid] = { quote_number: qn ?? null, lines: [] };
    } else {
      out[cid] = { quote_number: qn, lines: itemsByQuote[qn] };
    }
  }
  return out;
}
