/**
 * Shared eligibility rules for payment-pending reports, counts, and cron jobs.
 * Excludes Return Completed orders (warehouse-in done).
 */

/** Returns true when order should be treated as Return Completed. */
export function isReturnCompletedOrder(order) {
  return Number(order?.warehouse_in_done ?? 0) === 1;
}

/**
 * SQL WHERE fragment for neworder alias `o`.
 * Keeps partially returned (is_returned = 2) orders; excludes Return Completed.
 */
export const PAYMENT_PENDING_ORDER_SQL_WHERE = `
  (o.payment_status IS NULL OR o.payment_status COLLATE utf8mb4_unicode_ci != 'paid')
  AND (o.is_returned = 0 OR o.is_returned = 2 OR o.is_returned IS NULL)
  AND (o.is_cancelled = 0 OR o.is_cancelled IS NULL)
  AND COALESCE(o.warehouse_in_done, 0) = 0
`;
