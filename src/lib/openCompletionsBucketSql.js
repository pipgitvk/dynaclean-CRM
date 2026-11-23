/** Card bucket SQL for open-completions complaint tables (service_records). */

export const OPEN_COMPLETIONS_BUCKET_VALUES = [
  "total_registered",
  "pending",
  "planned",
  "completed",
  "pending_by_customer",
  "pending_for_spares",
  "pending_over_48h_no_plan",
];

const NO_PLAN_DATE_SQL = `(
  sr.planned_date IS NULL
  OR TRIM(CAST(sr.planned_date AS CHAR)) IN ('', '0000-00-00', '0000-00-00 00:00:00')
  OR DATE(sr.planned_date) <= '1970-01-01'
)`;

export function buildOpenCompletionsBucketWhereSql(openCompletionsBucket) {
  const b = String(openCompletionsBucket || "")
    .trim()
    .toLowerCase();

  if (!b || b === "total_registered") {
    return { sql: "", params: [] };
  }
  if (b === "pending") {
    return {
      sql: ` AND UPPER(TRIM(COALESCE(sr.status, ''))) = 'PENDING'`,
      params: [],
    };
  }
  if (b === "planned") {
    return {
      sql: ` AND UPPER(TRIM(COALESCE(sr.status, ''))) = 'PLANNED'`,
      params: [],
    };
  }
  if (b === "completed") {
    return {
      sql: ` AND UPPER(TRIM(COALESCE(sr.status, ''))) = 'COMPLETED'`,
      params: [],
    };
  }
  if (b === "pending_by_customer") {
    return {
      sql: ` AND UPPER(TRIM(COALESCE(sr.status, ''))) = 'PENDING BY CUSTOMER'`,
      params: [],
    };
  }
  if (b === "pending_for_spares") {
    return {
      sql: ` AND UPPER(TRIM(COALESCE(sr.status, ''))) = 'PENDING FOR SPARES'`,
      params: [],
    };
  }
  if (b === "pending_over_48h_no_plan") {
    return {
      sql: ` AND UPPER(TRIM(COALESCE(sr.status, ''))) = 'PENDING'
        AND sr.complaint_date IS NOT NULL
        AND TIMESTAMPDIFF(HOUR, sr.complaint_date, NOW()) > 48
        AND ${NO_PLAN_DATE_SQL}`,
      params: [],
    };
  }
  return { sql: "", params: [] };
}