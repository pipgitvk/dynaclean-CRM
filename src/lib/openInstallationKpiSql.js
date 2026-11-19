/** Row flags on upcoming-installations inner query alias `u`. */

export const U_ACTUALLY_DELIVERED_SQL = `(
  u.delivered_on IS NOT NULL
  AND TRIM(CAST(u.delivered_on AS CHAR)) NOT IN ('', '0000-00-00', '0000-00-00 00:00:00')
  AND DATE(u.delivered_on) > '1970-01-01'
)`;

export const U_INSTALLATION_COMPLETED_SQL = `(COALESCE(u.installation_completed, 0) = 1)`;

export const U_DELIVERY_PENDING_AFTER_DISPATCH_SQL = `(NOT ${U_ACTUALLY_DELIVERED_SQL})`;

export const U_DELIVERED_INSTALLATION_PENDING_SQL = `(
  ${U_ACTUALLY_DELIVERED_SQL}
  AND NOT ${U_INSTALLATION_COMPLETED_SQL}
)`;

/** Completed installation SR with no follow-up feedback saved yet. */
export const U_NO_FEEDBACK_COLLECTED_SQL = `(COALESCE(u.no_feedback_collected, 0) = 1)`;