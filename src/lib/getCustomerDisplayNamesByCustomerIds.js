/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {Array<string|number>} customerIds
 * @returns {Promise<Record<string, string | null>>} map trimmed customer_id -> display name or null
 */
export async function getCustomerDisplayNamesByCustomerIds(conn, customerIds) {
  const ids = [
    ...new Set(
      (customerIds || [])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (!ids.length) return {};
  const ph = ids.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT TRIM(c.customer_id) AS customer_id,
            COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''),
              NULLIF(TRIM(c.company), '')
            ) AS customer_name
     FROM customers c
     WHERE TRIM(c.customer_id) IN (${ph})`,
    ids,
  );
  /** @type {Record<string, string | null>} */
  const out = {};
  for (const r of rows || []) {
    const k = String(r.customer_id ?? "").trim();
    if (!k) continue;
    const n =
      r.customer_name != null && String(r.customer_name).trim() !== ""
        ? String(r.customer_name).trim()
        : null;
    out[k] = n;
  }
  return out;
}
