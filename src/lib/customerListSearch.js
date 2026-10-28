/** Shared text search for customers list pages (all dashboards). */
export const CUSTOMER_LIST_SEARCH_FIELDS = [
  "CAST(c.customer_id AS CHAR)",
  "c.first_name",
  "c.last_name",
  "c.email",
  "c.phone",
  "c.address",
  "c.company",
  "c.lead_source",
  "c.status",
  "c.followup_notes",
  "c.communication_history",
  "c.products_interest",
  "c.sales_representative",
  "c.assigned_to",
  "c.tags",
  "c.notes",
  "c.date_created",
];

/**
 * @param {string|undefined|null} search
 * @returns {{ sql: string, params: string[] } | null}
 */
export function buildCustomerListSearchClause(search) {
  const trimmed = String(search ?? "").trim();
  if (!trimmed) return null;

  const term = `%${trimmed}%`;
  const sql = `(${CUSTOMER_LIST_SEARCH_FIELDS.map(
    (field) => `${field} LIKE ?`,
  ).join(" OR ")})`;
  const params = CUSTOMER_LIST_SEARCH_FIELDS.map(() => term);

  return { sql, params };
}

/**
 * @param {string[]} conditions
 * @param {unknown[]} params
 * @param {string|undefined|null} search
 */
export function appendCustomerListSearchFilter(conditions, params, search) {
  const clause = buildCustomerListSearchClause(search);
  if (!clause) return;
  conditions.push(clause.sql);
  params.push(...clause.params);
}
