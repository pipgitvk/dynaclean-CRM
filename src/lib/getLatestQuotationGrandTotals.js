import { getDbConnection } from "@/lib/db";

/**
 * Latest quotation `grand_total` per customer_id (by quote_date, then created_at).
 * Customers with no quotation are omitted from the map.
 */
export async function getLatestQuotationGrandTotalsByCustomerIds(customerIds) {
  const ids = [...new Set((customerIds || []).map(String).filter(Boolean))].slice(
    0,
    50,
  );
  if (ids.length === 0) return {};

  const conn = await getDbConnection();
  const ph = ids.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT customer_id, grand_total, quote_date, created_at
     FROM quotations_records
     WHERE customer_id IN (${ph})
     ORDER BY quote_date DESC, created_at DESC`,
    ids,
  );

  const map = {};
  for (const r of rows || []) {
    const cid = String(r.customer_id ?? "").trim();
    if (!cid || map[cid] !== undefined) continue;
    const gt = r.grand_total;
    map[cid] = gt != null && gt !== "" ? Number(gt) : 0;
    if (Number.isNaN(map[cid])) map[cid] = 0;
  }
  return map;
}
