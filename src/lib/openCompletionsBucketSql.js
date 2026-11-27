import { sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

/** Card bucket SQL for open-completions complaint tables (service_records). */

export const OPEN_COMPLETIONS_BUCKET_VALUES = [
  "total_registered",
  "pending",
  "planned",
  "completed",
  "pending_by_customer",
  "pending_for_spares",
  "pending_over_48h_no_plan",
  "google_feedback",
];

export const COMPLAINT_GOOGLE_FEEDBACK_SQL = `LOWER(TRIM(COALESCE(sr.google_feedback_collected, ''))) = 'yes'`;

/**
 * Pending complaints with zero machines_followup rows — same meaning as an
 * empty Last Followed cell (any follow-up on this service_id, serial, or machine).
 */
export const OPEN_COMPLAINTS_NO_FOLLOWUP_YET_SQL = `(
  NOT EXISTS (
    SELECT 1
    FROM machines_followup mf
    WHERE mf.service_id IS NOT NULL
      AND mf.service_id > 0
      AND sr.service_id IS NOT NULL
      AND mf.service_id = CAST(sr.service_id AS UNSIGNED)
  )
  AND (
    CHAR_LENGTH(${sqlUtf8TrimExpr("COALESCE(sr.serial_number, '')")}) = 0
    OR NOT EXISTS (
      SELECT 1
      FROM machines_followup mf
      WHERE ${sqlUtf8TrimExpr("mf.serial_number")} = ${sqlUtf8TrimExpr("sr.serial_number")}
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM machines_followup mf
    WHERE wp.id IS NOT NULL
      AND mf.machine_id IS NOT NULL
      AND mf.machine_id = wp.id
  )
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
      sql: ` AND UPPER(TRIM(COALESCE(sr.status, ''))) IN (
          'PENDING',
          'PENDING BY CUSTOMER',
          'PENDING FOR SPARES',
          'PENDING BY US',
          'PLANNED'
        )
        AND sr.complaint_date IS NOT NULL
        AND TIMESTAMPDIFF(HOUR, sr.complaint_date, NOW()) > 48
        AND ${OPEN_COMPLAINTS_NO_FOLLOWUP_YET_SQL}`,
      params: [],
    };
  }
  if (b === "google_feedback" || b === "feedback_collected") {
    return {
      sql: ` AND ${COMPLAINT_GOOGLE_FEEDBACK_SQL}`,
      params: [],
    };
  }
  return { sql: "", params: [] };
}