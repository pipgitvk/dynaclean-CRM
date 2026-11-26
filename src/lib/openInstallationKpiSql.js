import {
  sqlTrimUtf8EqColumns,
  sqlUtf8HasText,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";

/** Placeholder dispatch serials from backfill (`temp`, `temp1`, `temp1-…`). */
export function sqlDispatchSerialIsTemp(columnExpr) {
  return `LOWER(${sqlUtf8TrimExpr(columnExpr)}) LIKE 'temp%'`;
}

export const SQL_QUOTE_HAS_TEMP_DISPATCH_SERIAL = (quoteNumberColumn) => `EXISTS (
  SELECT 1
  FROM dispatch d_tmp_sn
  WHERE ${sqlTrimUtf8EqColumns("d_tmp_sn.quote_number", quoteNumberColumn)}
    AND d_tmp_sn.serial_no IS NOT NULL
    AND ${sqlUtf8HasText("d_tmp_sn.serial_no")}
    AND ${sqlDispatchSerialIsTemp("d_tmp_sn.serial_no")}
)`;

export const NO_TEMP_DISPATCH_SERIAL_SQL = `(NOT ${SQL_QUOTE_HAS_TEMP_DISPATCH_SERIAL("no.quote_number")})`;

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

/**
 * On the way: dispatched (full or partial) but delivery not marked done.
 * Orders that are not dispatched yet are excluded.
 * Temp placeholder serials (`temp`, `temp1`, …) are excluded from this card/table.
 */
export const U_DELIVERY_PENDING_AFTER_DISPATCH_SQL = `(
  COALESCE(u.order_delivery_status, 0) = 0
  AND COALESCE(u.order_dispatch_status, 0) IN (1, 2)
  AND NOT ${SQL_QUOTE_HAS_TEMP_DISPATCH_SERIAL("u.quote_number")}
)`;

/** Open + delivered + installation not done. Temp placeholder serials are excluded. */
export const U_DELIVERED_INSTALLATION_PENDING_SQL = `(
  ${U_OPEN_INSTALLATION_ORDER_SQL}
  AND ${U_ACTUALLY_DELIVERED_SQL}
  AND NOT ${U_INSTALLATION_COMPLETED_SQL}
  AND NOT ${SQL_QUOTE_HAS_TEMP_DISPATCH_SERIAL("u.quote_number")}
)`;

export function isTempSerialNumber(value) {
  const parts = String(value || "")
    .trim()
    .toLowerCase()
    .split(/[\s,;/|]+/)
    .filter(Boolean);
  return parts.some((part) => part.startsWith("temp"));
}

/** Installation done on order but no installation report uploaded/saved on any INSTALLATION SR. */
export const U_NO_FEEDBACK_COLLECTED_SQL = `(COALESCE(u.no_feedback_collected, 0) = 1)`;

/** Any INSTALLATION service record on the order quote in PLANNED status. */
export const SQL_INSTALLATION_PLANNED_ON_QUOTE = (quoteNumberColumn) => `EXISTS (
  SELECT 1
  FROM dispatch d_pl
  INNER JOIN service_records sr_pl
    ON ${sqlTrimUtf8EqColumns("sr_pl.serial_number", "d_pl.serial_no")}
  WHERE ${sqlTrimUtf8EqColumns("d_pl.quote_number", quoteNumberColumn)}
    AND UPPER(TRIM(COALESCE(sr_pl.service_type, ''))) = 'INSTALLATION'
    AND UPPER(TRIM(COALESCE(sr_pl.status, ''))) = 'PLANNED'
)`;

/**
 * Same set as view_service_reports → Status PLANNED (INSTALLATION jobs on this quote).
 * Includes completed orders — SR can stay PLANNED after site install is marked on order.
 */
export const U_INSTALLATION_PLANNED_SQL = `(${SQL_INSTALLATION_PLANNED_ON_QUOTE("u.quote_number")})`;

export const NO_INSTALLATION_PLANNED_SQL = `(${SQL_INSTALLATION_PLANNED_ON_QUOTE("no.quote_number")})`;

/** INSTALLATION + PLANNED — mirrors ServiceTable status filter (service-record rows). */
export const SQL_SERVICE_RECORD_INSTALLATION_PLANNED = `(
  UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
  AND UPPER(TRIM(COALESCE(sr.status, ''))) = 'PLANNED'
)`;

/** Early filter on {@code neworder} before heavy aggregates (KPI bucket list). */
export const NO_ACTUALLY_DELIVERED_SQL = `(
  no.delivered_on IS NOT NULL
  AND TRIM(CAST(no.delivered_on AS CHAR)) NOT IN ('', '0000-00-00', '0000-00-00 00:00:00')
  AND DATE(no.delivered_on) > '1970-01-01'
)`;

/** Dispatched (1 full / 2 partial) but delivery not marked done; skip undispatched + temp serials. */
export const NO_DELIVERY_PENDING_AFTER_DISPATCH_SQL = `(
  COALESCE(no.delivery_status, 0) = 0
  AND COALESCE(no.dispatch_status, 0) IN (1, 2)
  AND ${NO_TEMP_DISPATCH_SERIAL_SQL}
)`;

export function openInstallationBucketRecordCount(bucket, breakdown = {}) {
  const b = String(bucket || "").trim().toLowerCase();
  if (b === "delivered_pending") return Number(breakdown.delivered_installation_pending ?? 0);
  if (b === "overdue_delayed") return Number(breakdown.overdue_delayed_installation ?? 0);
  if (b === "delivery_pending") return Number(breakdown.delivery_pending_after_dispatch ?? 0);
  if (b === "completed") return Number(breakdown.completed_installation ?? 0);
  if (b === "installation_planned") return Number(breakdown.installation_planned ?? 0);
  if (b === "feedback_collected" || b === "no_feedback")
    return Number(breakdown.feedback_collected ?? breakdown.no_feedback_collected ?? 0);
  return Number(breakdown.total ?? 0);
}