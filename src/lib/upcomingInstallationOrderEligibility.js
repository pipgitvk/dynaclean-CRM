import { sqlTrimUtf8EqColumns, sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

/**
 * Orders eligible for upcoming installation:
 * - Fully dispatched (dispatch_status = 1), or
 * - Partial dispatch (2) with at least one delivery save and shipped serial.
 */
export function pendingNeworderPredicates(
  alias = "no_p",
  { includeInstalledOrders = false, lite = false } = {},
) {
  const installationStatusSql = includeInstalledOrders
    ? `COALESCE(${alias}.installation_status, 0) IN (0, 1)`
    : `COALESCE(${alias}.installation_status, 0) = 0`;
  const base = `
    ${installationStatusSql}
    AND (${alias}.is_returned = 0 OR ${alias}.is_returned = 2 OR ${alias}.is_returned IS NULL)
    AND (${alias}.is_cancelled = 0 OR ${alias}.is_cancelled IS NULL)
    AND ${alias}.delivery_date IS NOT NULL`;
  // Lite: skip EXISTS on dispatch (caller already joins dispatch with a serial).
  if (lite) {
    return `
    ${base}
    AND (
      COALESCE(${alias}.dispatch_status, 0) = 1
      OR COALESCE(${alias}.delivery_status, 0) IN (1, 2)
    )`;
  }
  return `
    ${base}
    AND (
      COALESCE(${alias}.dispatch_status, 0) = 1
      OR (
        COALESCE(${alias}.delivery_status, 0) IN (1, 2)
        AND EXISTS (
          SELECT 1
          FROM dispatch d_elig
          WHERE ${sqlTrimUtf8EqColumns("d_elig.quote_number", `${alias}.quote_number`)}
            AND COALESCE(d_elig.stock_deducted, 0) = 1
            AND d_elig.serial_no IS NOT NULL
            AND ${sqlUtf8TrimExpr("d_elig.serial_no")} <> ''
        )
      )
    )`;
}

/**
 * Partial dispatch: only serials shipped on or before the latest saved delivery batch.
 * Full dispatch: any row with a serial (legacy behaviour).
 */
export function dispatchSerialEligibleForInstallation(
  dispatchAlias = "d",
  orderAlias = "no_p",
  { lite = false } = {},
) {
  // Lite: no order_delivery_batches correlated subquery (huge win on ~1k orders).
  if (lite) {
    return `
    AND ${dispatchAlias}.serial_no IS NOT NULL
    AND TRIM(${dispatchAlias}.serial_no) <> ''
    AND (
      COALESCE(${orderAlias}.dispatch_status, 0) = 1
      OR (
        COALESCE(${orderAlias}.delivery_status, 0) IN (1, 2)
        AND COALESCE(${dispatchAlias}.stock_deducted, 0) = 1
      )
    )`;
  }
  return `
    AND ${dispatchAlias}.serial_no IS NOT NULL
    AND ${sqlUtf8TrimExpr(`${dispatchAlias}.serial_no`)} <> ''
    AND (
      (
        COALESCE(${orderAlias}.dispatch_status, 0) = 1
        AND COALESCE(${orderAlias}.delivery_status, 0) IN (0, 1)
      )
      OR (
        COALESCE(${orderAlias}.delivery_status, 0) IN (1, 2)
        AND COALESCE(${dispatchAlias}.stock_deducted, 0) = 1
        AND COALESCE(${dispatchAlias}.updated_at, ${dispatchAlias}.created_at, '1970-01-01')
          <= COALESCE(
            (
              SELECT MAX(odb.created_at)
              FROM order_delivery_batches odb
              WHERE ${sqlTrimUtf8EqColumns("odb.order_id", `${orderAlias}.order_id`)}
                AND odb.delivered_on IS NOT NULL
                AND odb.delivered_on > '1970-01-01'
            ),
            (
              CASE
                WHEN ${orderAlias}.delivered_on IS NOT NULL
                  AND ${orderAlias}.delivered_on > '1970-01-01'
                THEN TIMESTAMP(${orderAlias}.delivered_on)
                ELSE NULL
              END
            ),
            '1970-01-01'
          )
      )
    )`;
}