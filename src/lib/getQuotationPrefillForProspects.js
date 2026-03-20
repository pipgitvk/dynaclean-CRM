import { userMayUseCustomerForProspect } from "@/lib/prospectCustomerAccess";

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
 * Prefill amounts + quotation_items for customers that match a specific quote_number
 * (not “latest by date”). Only the quotation’s owner customer_id gets lines/amount;
 * other customer IDs in the list get empty prefill.
 *
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string} quoteNumberRaw
 * @param {string[]} customerIds
 * @param {{ username?: string, role?: string }} payload
 * @returns {Promise<{ quoteAmounts: Record<string, number>, quotationLinesByCustomer: Record<string, { quote_number: string|null, lines: Array<{ model: string, quantity: number, total_price: number, price_per_unit: number }> }> }>}
 */
export async function getQuotationPrefillForProspects(
  conn,
  quoteNumberRaw,
  customerIds,
  payload,
) {
  const qn = String(quoteNumberRaw ?? "").trim();
  const ids = [...new Set((customerIds || []).map(String).filter(Boolean))].slice(
    0,
    50,
  );

  const quotationLinesByCustomer = {};
  const quoteAmounts = {};

  for (const id of ids) {
    quotationLinesByCustomer[id] = { quote_number: null, lines: [] };
  }

  if (!qn || ids.length === 0) {
    return { quoteAmounts, quotationLinesByCustomer };
  }

  const [heads] = await conn.execute(
    `SELECT customer_id, quote_number, grand_total
     FROM quotations_records
     WHERE TRIM(quote_number) = TRIM(?)
        OR UPPER(TRIM(quote_number)) = UPPER(TRIM(?))
     LIMIT 1`,
    [qn, qn],
  );
  const head = heads?.[0];
  if (!head) {
    return { quoteAmounts, quotationLinesByCustomer };
  }

  const canonicalQuoteNumber = String(head.quote_number ?? "").trim();
  if (!canonicalQuoteNumber) {
    return { quoteAmounts, quotationLinesByCustomer };
  }

  const ownerCid = String(head.customer_id ?? "").trim();
  const ownerInBatch = ids.some((id) => String(id) === ownerCid);
  if (!ownerCid || !ownerInBatch) {
    return { quoteAmounts, quotationLinesByCustomer };
  }

  const may = await userMayUseCustomerForProspect(conn, ownerCid, payload);
  if (!may) {
    return { quoteAmounts, quotationLinesByCustomer };
  }

  const [itemRows] = await conn.execute(
    `SELECT quote_number, item_name, item_code, specification, quantity,
            price_per_unit, total_price
     FROM quotation_items
     WHERE quote_number = ?
        OR TRIM(quote_number) = TRIM(?)
     ORDER BY COALESCE(created_at, '1970-01-01') ASC, item_name, item_code`,
    [canonicalQuoteNumber, canonicalQuoteNumber],
  );

  const lines = [];
  for (const it of itemRows || []) {
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
    lines.push({
      model,
      quantity: qty,
      total_price: Number.isFinite(total_price) ? total_price : 0,
      price_per_unit: Number.isFinite(price_per_unit) ? price_per_unit : 0,
    });
  }

  const gt = head.grand_total != null ? Number(head.grand_total) : 0;
  quoteAmounts[ownerCid] = Number.isFinite(gt) ? gt : 0;
  quotationLinesByCustomer[ownerCid] = {
    quote_number: canonicalQuoteNumber,
    lines,
  };

  return { quoteAmounts, quotationLinesByCustomer };
}

/**
 * Grand total from a specific quotation row (by quote_number + customer), no “latest” ordering.
 */
export async function getGrandTotalForQuotation(conn, quoteNumber, customerId) {
  const qn = String(quoteNumber ?? "").trim();
  const cid = String(customerId ?? "").trim();
  if (!qn || !cid) return null;
  const [rows] = await conn.execute(
    `SELECT grand_total FROM quotations_records
     WHERE customer_id = ?
       AND (TRIM(quote_number) = TRIM(?)
         OR UPPER(TRIM(quote_number)) = UPPER(TRIM(?)))
     LIMIT 1`,
    [cid, qn, qn],
  );
  const r = rows?.[0];
  if (!r || r.grand_total == null || r.grand_total === "") return null;
  const n = Number(r.grand_total);
  return Number.isFinite(n) ? n : null;
}
