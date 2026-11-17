/**
 * Manual manager assignment on customers (excludes empty assigned_to and Automatic).
 * Matches leads-report / meta-backfill assigner semantics.
 */
export function customerManualAssignedToSql(alias = "c") {
  return `(
    TRIM(COALESCE(${alias}.assigned_to, '')) != ''
    AND LOWER(TRIM(${alias}.assigned_to)) NOT IN ('automatic', 'auto')
  )`;
}

export const CUSTOMER_MANUAL_ASSIGNED_TO_SQL = customerManualAssignedToSql("c");

/** CRM row is auto-routed (Automatic/empty) or not linked. */
export function customerAutomaticAssignmentSql(alias = "c") {
  return `(
    ${alias}.customer_id IS NULL
    OR TRIM(COALESCE(${alias}.assigned_to, '')) = ''
    OR LOWER(TRIM(${alias}.assigned_to)) IN ('automatic', 'auto')
  )`;
}