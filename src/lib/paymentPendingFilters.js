/**
 * Shared eligibility rules for payment-pending reports, counts, and cron jobs.
 * Excludes Return Completed orders (warehouse-in done).
 */

/** Returns true when order should be treated as Return Completed. */
export function isReturnCompletedOrder(order) {
  return Number(order?.warehouse_in_done ?? 0) === 1;
}

/** Shared base: not cancelled, not return-completed (warehouse-in). */
export const PAYMENT_PENDING_ORDER_BASE_SQL_WHERE = `
  (o.is_returned = 0 OR o.is_returned = 2 OR o.is_returned IS NULL)
  AND (o.is_cancelled = 0 OR o.is_cancelled IS NULL)
  AND COALESCE(o.warehouse_in_done, 0) = 0
`;

/**
 * SQL WHERE fragment for neworder alias `o`.
 * Keeps partially returned (is_returned = 2) orders; excludes Return Completed.
 * Excludes fully paid rows (dashboard counts / pending-only lists).
 */
export const PAYMENT_PENDING_ORDER_SQL_WHERE = `
  (o.payment_status IS NULL OR o.payment_status COLLATE utf8mb4_unicode_ci != 'paid')
  AND ${PAYMENT_PENDING_ORDER_BASE_SQL_WHERE}
`;

/** Report “All / Completed”: include paid orders still on this report (not warehouse-in). */
export const PAYMENT_PENDING_ORDER_SQL_WHERE_INCLUDE_PAID = PAYMENT_PENDING_ORDER_BASE_SQL_WHERE;
