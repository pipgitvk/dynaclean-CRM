import { REP_LIST_IS_SALES_ROLE } from "@/lib/reassignSalesScope";

/** Sales leads whose lead_source is an inactive salesperson in rep_list (role SALES only). */
export const PENDING_REASSIGN_REP_JOIN = `
  INNER JOIN rep_list r
    ON r.username COLLATE utf8mb4_unicode_ci = TRIM(c.lead_source) COLLATE utf8mb4_unicode_ci
`;

export const PENDING_REASSIGN_WHERE_CORE = `
  c.lead_source IS NOT NULL
  AND TRIM(c.lead_source) <> ''
  AND COALESCE(r.status, 1) = 0
  AND ${REP_LIST_IS_SALES_ROLE}
`;

export function pendingReassignSearchSql(search) {
  const q = String(search || "").trim();
  if (!q) return { clause: "", params: [] };
  const like = `%${q}%`;
  const clause = `
    AND (
      CAST(c.customer_id AS CHAR) LIKE ?
      OR COALESCE(c.first_name, '') LIKE ?
      OR COALESCE(c.last_name, '') LIKE ?
      OR COALESCE(c.company, '') LIKE ?
      OR COALESCE(c.phone, '') LIKE ?
      OR TRIM(c.lead_source) LIKE ?
    )`;
  return { clause, params: [like, like, like, like, like, like] };
}