/** Row flags on upcoming-installations inner query alias `u`. */

export const U_ACTUALLY_DELIVERED_SQL = `(
  u.delivered_on IS NOT NULL
  AND TRIM(CAST(u.delivered_on AS CHAR)) NOT IN ('', '0000-00-00', '0000-00-00 00:00:00')
  AND DATE(u.delivered_on) > '1970-01-01'
)`;

export const U_ORDER_INSTALLATION_DONE_SQL = `(COALESCE(u.order_installation_status, 0) = 1)`;

export const U_INSTALLATION_COMPLETED_SQL = `(
  COALESCE(u.installation_completed, 0) = 1
  OR ${U_ORDER_INSTALLATION_DONE_SQL}
)`;

/** Open-installation list / KPI total — still-pending on neworder only */
export const U_OPEN_INSTALLATION_ORDER_SQL = `(COALESCE(u.order_installation_status, 0) = 0)`;

export const U_DELIVERY_PENDING_AFTER_DISPATCH_SQL = `(NOT ${U_ACTUALLY_DELIVERED_SQL})`;

export const U_DELIVERED_INSTALLATION_PENDING_SQL = `(
  ${U_ACTUALLY_DELIVERED_SQL}
  AND NOT ${U_INSTALLATION_COMPLETED_SQL}
)`;

/** Completed installation SR with no follow-up feedback saved yet. */
export const U_NO_FEEDBACK_COLLECTED_SQL = `(COALESCE(u.no_feedback_collected, 0) = 1)`;

/** Early filter on {@code neworder} before heavy aggregates (KPI bucket list). */
export const NO_ACTUALLY_DELIVERED_SQL = `(
  no.delivered_on IS NOT NULL
  AND TRIM(CAST(no.delivered_on AS CHAR)) NOT IN ('', '0000-00-00', '0000-00-00 00:00:00')
  AND DATE(no.delivered_on) > '1970-01-01'
)`;

export function openInstallationBucketRecordCount(bucket, breakdown = {}) {
  const b = String(bucket || "").trim().toLowerCase();
  if (b === "delivered_pending") return Number(breakdown.delivered_installation_pending ?? 0);
  if (b === "delivery_pending") return Number(breakdown.delivery_pending_after_dispatch ?? 0);
  if (b === "completed") return Number(breakdown.completed_installation ?? 0);
  if (b === "no_feedback") return Number(breakdown.no_feedback_collected ?? 0);
  return Number(breakdown.total ?? 0);
}