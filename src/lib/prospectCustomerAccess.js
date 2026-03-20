import { isProspectsAdminRole } from "@/lib/prospectAccess";

/**
 * Non-admin users may only add prospects for customers they "own":
 * `customers.assigned_to` or `customers.lead_source` = username (same rule as employee-leads / assigned-customers).
 */

export async function userMayUseCustomerForProspect(conn, customerId, payload) {
  const cid = String(customerId ?? "").trim();
  if (!cid) return false;
  if (isProspectsAdminRole(payload?.role)) return true;
  const username = String(payload?.username ?? "").trim();
  if (!username) return false;
  const [rows] = await conn.execute(
    `SELECT 1 AS ok FROM customers
     WHERE customer_id = ? AND (assigned_to = ? OR lead_source = ?)
     LIMIT 1`,
    [cid, username, username],
  );
  return Boolean(rows?.[0]?.ok);
}

/**
 * Returns only customer IDs from the list that the user may use (or all for admin).
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string[]} customerIds
 * @param {object} payload — session { username, role }
 * @param {{ max?: number }} [opts]
 */
export async function filterCustomerIdsForProspectUser(
  conn,
  customerIds,
  payload,
  opts = {},
) {
  const max = opts.max ?? 50;
  const ids = [...new Set((customerIds || []).map(String).filter(Boolean))].slice(
    0,
    max,
  );
  if (ids.length === 0) return [];
  if (isProspectsAdminRole(payload?.role)) return ids;
  const username = String(payload?.username ?? "").trim();
  if (!username) return [];
  const ph = ids.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT customer_id FROM customers
     WHERE customer_id IN (${ph}) AND (assigned_to = ? OR lead_source = ?)`,
    [...ids, username, username],
  );
  const allowed = new Set(
    (rows || []).map((r) => String(r.customer_id ?? "").trim()).filter(Boolean),
  );
  return ids.filter((id) => allowed.has(id));
}
