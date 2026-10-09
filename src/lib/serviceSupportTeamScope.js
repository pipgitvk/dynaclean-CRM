import { normalizeRoleKey } from "@/lib/roleKeyUtils";

const COLLATE = "utf8mb4_unicode_ci";

export function isServiceSupportRole(role) {
  return normalizeRoleKey(role) === "SERVICE SUPPORT";
}

/** Active SERVICE SUPPORT usernames (SQL subquery, no params). */
export const SQL_ACTIVE_SERVICE_SUPPORT_USERNAMES = `
  SELECT TRIM(username) COLLATE ${COLLATE} AS username FROM rep_list
  WHERE UPPER(TRIM(userRole)) = 'SERVICE SUPPORT' AND status = 1
`;

export function sqlColumnInActiveServiceSupportUsers(columnExpr) {
  return `${columnExpr} COLLATE ${COLLATE} IN (${SQL_ACTIVE_SERVICE_SUPPORT_USERNAMES})`;
}

/**
 * Customers assigned to any SERVICE SUPPORT user or followed up by any teammate.
 * @param {string} [tableAlias]
 */
export function sqlServiceSupportCustomerScope(tableAlias = "") {
  const p = tableAlias ? `${tableAlias}.` : "";
  return `(
    ${sqlColumnInActiveServiceSupportUsers(`${p}service_lead_source`)}
    OR ${p}customer_id IN (
      SELECT DISTINCT cf.customer_id FROM customers_followup cf
      WHERE ${sqlServiceSupportFollowedByScope()}
    )
  )`;
}

export function sqlServiceSupportFollowedByScope() {
  return `${sqlColumnInActiveServiceSupportUsers("cf.followed_by")}
    AND cf.followed_by IS NOT NULL AND cf.followed_by != ''`;
}
