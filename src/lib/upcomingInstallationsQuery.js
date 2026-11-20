import { UNREGISTERED_PRODUCT_ORDER_SQL } from "@/lib/pendingProductRegistrationCount";
import { sqlTrimUtf8EqColumns, sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";
import {
  dispatchSerialEligibleForInstallation,
  pendingNeworderPredicates,
} from "@/lib/upcomingInstallationOrderEligibility";
import { buildNeworderOpenInstallationBucketWhereSql } from "@/lib/openInstallationBucketNeworderSql";

export { pendingNeworderPredicates } from "@/lib/upcomingInstallationOrderEligibility";

/** INSTALLATION + COMPLETED + no follow-up feedback on the service record. */
const NO_FEEDBACK_ON_COMPLETED_INSTALLATION_SQL = `
  UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'
  AND UPPER(TRIM(COALESCE(sr2.status, ''))) = 'COMPLETED'
  AND (
    sr2.final_feedback_on_call IS NULL
    OR TRIM(sr2.final_feedback_on_call) = ''
  )
  AND sr2.service_followup_at IS NULL
`;

const INSTALLATION_SR_TYPE_SQL = `UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'`;
const SR2_ASSIGNED_OK_SQL = `UPPER(TRIM(COALESCE(sr2.assigned_to, ''))) NOT IN ('', 'NOT ASSIGNED', 'UNASSIGNED')`;

/** Latest assigned installation engineers per quote (internal + third party). */
const SVC_INSTALLATION_TEAM_AGG_SQL = `
        SUBSTRING_INDEX(
          GROUP_CONCAT(
            CASE
              WHEN ${INSTALLATION_SR_TYPE_SQL}
                AND ${SR2_ASSIGNED_OK_SQL}
                AND LOWER(TRIM(COALESCE(sr2.assigned_to_type, 'internal'))) <> 'third_party'
              THEN sr2.assigned_to
            END
            ORDER BY sr2.service_id DESC
            SEPARATOR '||'
          ),
          '||',
          1
        ) AS service_engineer,
        SUBSTRING_INDEX(
          GROUP_CONCAT(
            CASE
              WHEN ${INSTALLATION_SR_TYPE_SQL}
                AND ${SR2_ASSIGNED_OK_SQL}
                AND LOWER(TRIM(COALESCE(sr2.assigned_to_type, ''))) = 'third_party'
              THEN sr2.assigned_to
            END
            ORDER BY sr2.service_id DESC
            SEPARATOR '||'
          ),
          '||',
          1
        ) AS third_party_engineer,`;

/** Restrict rows to quotes that still have a pending installation order */
function joinPendingOrderOnQuote(quoteColumnExpr, orderEligibility = {}) {
  return `
    INNER JOIN neworder no_p
      ON ${sqlTrimUtf8EqColumns("no_p.quote_number", quoteColumnExpr)}
      AND ${pendingNeworderPredicates("no_p", orderEligibility)}`;
}

function dispatchEligibleSql(dispatchAlias, orderAlias, orderEligibility = {}) {
  return dispatchSerialEligibleForInstallation(dispatchAlias, orderAlias, {
    lite: Boolean(orderEligibility.lite),
  });
}

export function dispatchTypeJoin(type) {
  if (type === "products") {
    return `
      INNER JOIN products_list pl
        ON ${sqlTrimUtf8EqColumns("pl.item_code", "d.item_code")}`;
  }
  if (type === "spares") {
    return `
      INNER JOIN spare_list sl
        ON ${sqlTrimUtf8EqColumns("sl.spare_number", "d.item_code")}`;
  }
  return "";
}

/**
 * Upcoming installations list — pre-aggregate dispatch / services / quote lines for
 * pending orders only (no per-row correlated subqueries; no sync on the hot path).
 */
export function resolveUpcomingInstallationType(itemType) {
  const v = String(itemType ?? "")
    .trim()
    .toLowerCase();
  if (v === "spares" || v === "spare") return "spares";
  if (v === "products" || v === "product") return "products";
  return "all";
}

/**
 * @param {{
 *   type?: string,
 *   registration?: string | null,
 *   includeQuoteTotals?: boolean,
 *   includeServiceDetails?: boolean,
 *   includeInnerOrderBy?: boolean,
 *   includeInstalledOrders?: boolean,
 *   openInstallationBucket?: string,
 *   quoteKeys?: string[] | null,
 * }} [options]
 */
export function buildUpcomingInstallationsQuery({
  type = "products",
  registration = null,
  includeQuoteTotals = true,
  includeServiceDetails = true,
  includeInnerOrderBy = true,
  includeInstalledOrders = false,
  openInstallationBucket = "",
  quoteKeys = null,
  lite = false,
} = {}) {
  const orderEligibility = { includeInstalledOrders, lite: Boolean(lite) };
  const bucketWhereOnNo = buildNeworderOpenInstallationBucketWhereSql(openInstallationBucket);
  const registrationFilter =
    registration === "unregistered" ? `AND ${UNREGISTERED_PRODUCT_ORDER_SQL}` : "";
  const dispatchType = type === "all" ? null : type;
  const keys = Array.isArray(quoteKeys)
    ? quoteKeys.map((k) => String(k || "").trim()).filter(Boolean)
    : [];
  const quoteKeyInSql =
    keys.length > 0
      ? `AND ${sqlUtf8TrimExpr("no.quote_number")} IN (${keys.map(() => "?").join(",")})`
      : "";
  const dispatchQuoteKeyInSql =
    keys.length > 0
      ? `AND ${sqlUtf8TrimExpr("d.quote_number")} IN (${keys.map(() => "?").join(",")})`
      : "";
  const dispatch2QuoteKeyInSql =
    keys.length > 0
      ? `AND ${sqlUtf8TrimExpr("d2.quote_number")} IN (${keys.map(() => "?").join(",")})`
      : "";

  const quoteKeyD = sqlUtf8TrimExpr("d.quote_number");
  const quoteKeyD2 = sqlUtf8TrimExpr("d2.quote_number");
  const quoteKeyQi = sqlUtf8TrimExpr("qi.quote_number");

  const serviceDetailsSelect = includeServiceDetails
    ? `GROUP_CONCAT(
          CONCAT_WS(
            '~',
            sr2.service_id,
            COALESCE(sr2.status, ''),
            COALESCE(
              DATE_FORMAT(sr2.planned_date, '%Y-%m-%d'),
              DATE_FORMAT(sr2.complaint_date, '%Y-%m-%d'),
              ''
            ),
            COALESCE(sr2.assigned_to, '')
          )
          ORDER BY sr2.service_id
          SEPARATOR ';;'
        ) AS service_details,`
    : `GROUP_CONCAT(
          DISTINCT CASE
            WHEN ${INSTALLATION_SR_TYPE_SQL}
            THEN CONCAT_WS(
              '~',
              sr2.service_id,
              COALESCE(sr2.status, ''),
              COALESCE(
                DATE_FORMAT(sr2.planned_date, '%Y-%m-%d'),
                DATE_FORMAT(sr2.complaint_date, '%Y-%m-%d'),
                ''
              ),
              COALESCE(sr2.assigned_to, '')
            )
          END
          ORDER BY sr2.service_id
          SEPARATOR ';;'
        ) AS service_details,`;

  const quoteTotalsJoin = includeQuoteTotals
    ? `LEFT JOIN (
      SELECT
        ${quoteKeyQi} AS quote_key,
        SUM(qi.total_price) AS pricing_total,
        SUM(qi.quantity) AS total_qty
      FROM quotation_items qi
      ${joinPendingOrderOnQuote("qi.quote_number", orderEligibility)}
      GROUP BY quote_key
    ) qtot ON ${sqlTrimUtf8EqColumns("qtot.quote_key", "no.quote_number")}`
    : "";

  const pricingSelect = includeQuoteTotals
    ? `COALESCE(qtot.pricing_total, 0) AS pricing_total,
      COALESCE(qtot.total_qty, 0) AS total_qty,`
    : `0 AS pricing_total,
      0 AS total_qty,`;

  const orderBy = includeInnerOrderBy ? `ORDER BY days_until_installation ASC` : "";

  return `
    SELECT
      no.id,
      no.order_id,
      no.quote_number,
      no.invoice_number,
      agg.serial_number,
      svc.service_id,
      svc.service_details,
      agg.model,
      agg.name,
      no.delivery_location AS delivery_address,
      no.company_name,
      no.contact,
      no.state,
      no.created_by AS emp_name,
      no.created_by AS order_sales_person,
      COALESCE(
        NULLIF(TRIM(no.booking_by), ''),
        NULLIF(TRIM(no.dispatch_person), '')
      ) AS assigned_by,
      COALESCE(no.installation_status, 0) AS order_installation_status,
      COALESCE(no.dispatch_status, 0) AS order_dispatch_status,
      COALESCE(no.delivery_status, 0) AS order_delivery_status,
      DATE_FORMAT(no.delivery_date, '%Y-%m-%d') AS delivery_date,
      DATE_FORMAT(no.delivered_on, '%Y-%m-%d') AS delivered_on,
      ${pricingSelect}
      CASE
        WHEN no.delivery_date < CURDATE() THEN 'overdue'
        WHEN no.delivery_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY) THEN 'upcoming'
        ELSE 'scheduled'
      END AS installation_status,
      CASE
        WHEN no.delivered_on IS NOT NULL
          AND no.delivered_on > '1970-01-01'
        THEN DATEDIFF(no.delivered_on, CURDATE())
        ELSE DATEDIFF(no.delivery_date, CURDATE())
      END AS days_until_installation,
      agg.warranty_registered,
      NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(agg.registration_meta, '||', 2), '||', -1), '') AS registered_at,
      NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(agg.registration_meta, '||', 3), '||', -1), '') AS registered_by,
      agg.dispatch_date,
      svc.service_engineer,
      svc.third_party_engineer,
      COALESCE(svc.installation_completed, 0) AS installation_completed,
      COALESCE(svc.no_feedback_collected, 0) AS no_feedback_collected
    FROM neworder no
    INNER JOIN (
      SELECT
        ${quoteKeyD} AS quote_key,
        GROUP_CONCAT(DISTINCT d.serial_no ORDER BY d.serial_no SEPARATOR ', ') AS serial_number,
        GROUP_CONCAT(DISTINCT d.item_code ORDER BY d.item_code SEPARATOR ', ') AS model,
        GROUP_CONCAT(DISTINCT d.item_name ORDER BY d.item_name SEPARATOR ', ') AS name,
        MAX(CASE WHEN wp.serial_number IS NOT NULL THEN 1 ELSE 0 END) AS warranty_registered,
        SUBSTRING_INDEX(
          GROUP_CONCAT(
            CASE
              WHEN wp.serial_number IS NOT NULL
              THEN CONCAT(
                LPAD(wp.id, 20, '0'),
                '||',
                DATE_FORMAT(COALESCE(wp.created_at, wp.invoice_date), '%Y-%m-%d'),
                '||',
                TRIM(COALESCE(wp.created_by, ''))
              )
            END
            ORDER BY wp.id DESC
            SEPARATOR ','
          ),
          ',',
          1
        ) AS registration_meta,
        DATE_FORMAT(MAX(COALESCE(d.updated_at, d.created_at)), '%Y-%m-%d') AS dispatch_date
      FROM dispatch d
      ${joinPendingOrderOnQuote("d.quote_number", orderEligibility)}
      ${dispatchTypeJoin(dispatchType)}
      LEFT JOIN warranty_products wp
        ON ${sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no")}
      WHERE 1=1
        ${dispatchEligibleSql("d", "no_p", orderEligibility)}
        ${dispatchQuoteKeyInSql}
      GROUP BY quote_key
    ) agg ON ${sqlTrimUtf8EqColumns("agg.quote_key", "no.quote_number")}
    LEFT JOIN (
      SELECT
        ${quoteKeyD2} AS quote_key,
        GROUP_CONCAT(DISTINCT sr2.service_id ORDER BY sr2.service_id SEPARATOR ', ') AS service_id,
        ${serviceDetailsSelect}
        ${SVC_INSTALLATION_TEAM_AGG_SQL}
        MAX(
          CASE
            WHEN UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'
              AND UPPER(TRIM(COALESCE(sr2.status, ''))) = 'COMPLETED'
            THEN 1
            ELSE 0
          END
        ) AS installation_completed,
        MAX(
          CASE
            WHEN ${NO_FEEDBACK_ON_COMPLETED_INSTALLATION_SQL}
            THEN 1
            ELSE 0
          END
        ) AS no_feedback_collected
      FROM dispatch d2
      ${joinPendingOrderOnQuote("d2.quote_number", orderEligibility)}
      INNER JOIN service_records sr2
        ON ${sqlTrimUtf8EqColumns("sr2.serial_number", "d2.serial_no")}
      WHERE 1=1
        ${dispatchEligibleSql("d2", "no_p", orderEligibility)}
        ${dispatch2QuoteKeyInSql}
      GROUP BY quote_key
    ) svc ON ${sqlTrimUtf8EqColumns("svc.quote_key", "no.quote_number")}
    ${quoteTotalsJoin}
    WHERE ${pendingNeworderPredicates("no", orderEligibility)}
      ${registrationFilter}
      ${bucketWhereOnNo}
      ${quoteKeyInSql}
    ${orderBy}
  `;
}

/** Bind params for quoteKeys IN clauses (agg + svc + outer), same order as SQL. */
export function upcomingInstallationQuoteKeyParams(quoteKeys) {
  const keys = Array.isArray(quoteKeys)
    ? quoteKeys.map((k) => String(k || "").trim()).filter(Boolean)
    : [];
  if (!keys.length) return [];
  // d.quote_number IN, d2.quote_number IN, no.quote_number IN
  return [...keys, ...keys, ...keys];
}

/**
 * Fast KPI/count shape: no GROUP_CONCAT lists, no warranty join, no quotation_items.
 * Alias columns match openInstallationKpiSql (`u.delivered_on`, `u.installation_completed`).
 */
export function buildOpenInstallationKpiInnerQuery({
  type = "products",
  includeInstalledOrders = false,
  openInstallationBucket = "",
  slim = true,
  lite = true,
} = {}) {
  const orderEligibility = { includeInstalledOrders, lite: Boolean(lite) };
  const bucketWhereOnNo = buildNeworderOpenInstallationBucketWhereSql(openInstallationBucket);
  const dispatchType = type === "all" ? null : type;
  const quoteKeyD = sqlUtf8TrimExpr("d.quote_number");
  const quoteKeyD2 = sqlUtf8TrimExpr("d2.quote_number");

  // Slim KPI: no warranty / engineer GROUP_CONCAT — only flags the 4 cards need.
  if (slim) {
    return `
    SELECT
      no.quote_number,
      COALESCE(no.installation_status, 0) AS order_installation_status,
      COALESCE(no.dispatch_status, 0) AS order_dispatch_status,
      COALESCE(no.delivery_status, 0) AS order_delivery_status,
      DATE_FORMAT(no.delivery_date, '%Y-%m-%d') AS delivery_date,
      DATE_FORMAT(no.delivered_on, '%Y-%m-%d') AS delivered_on,
      COALESCE(svc.installation_completed, 0) AS installation_completed,
      COALESCE(svc.no_feedback_collected, 0) AS no_feedback_collected
    FROM neworder no
    INNER JOIN (
      SELECT ${quoteKeyD} AS quote_key
      FROM dispatch d
      ${joinPendingOrderOnQuote("d.quote_number", orderEligibility)}
      ${dispatchTypeJoin(dispatchType)}
      WHERE 1=1
        ${dispatchEligibleSql("d", "no_p", orderEligibility)}
      GROUP BY quote_key
    ) agg ON ${sqlTrimUtf8EqColumns("agg.quote_key", "no.quote_number")}
    LEFT JOIN (
      SELECT
        ${quoteKeyD2} AS quote_key,
        MAX(
          CASE
            WHEN UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'
              AND UPPER(TRIM(COALESCE(sr2.status, ''))) = 'COMPLETED'
            THEN 1 ELSE 0
          END
        ) AS installation_completed,
        MAX(
          CASE
            WHEN ${NO_FEEDBACK_ON_COMPLETED_INSTALLATION_SQL}
            THEN 1 ELSE 0
          END
        ) AS no_feedback_collected
      FROM dispatch d2
      ${joinPendingOrderOnQuote("d2.quote_number", orderEligibility)}
      INNER JOIN service_records sr2
        ON ${sqlTrimUtf8EqColumns("sr2.serial_number", "d2.serial_no")}
      WHERE 1=1
        ${dispatchEligibleSql("d2", "no_p", orderEligibility)}
        AND UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'
      GROUP BY quote_key
    ) svc ON ${sqlTrimUtf8EqColumns("svc.quote_key", "no.quote_number")}
    WHERE ${pendingNeworderPredicates("no", orderEligibility)}
      ${bucketWhereOnNo}
  `;
  }

  return `
    SELECT
      no.quote_number,
      COALESCE(no.installation_status, 0) AS order_installation_status,
      COALESCE(no.dispatch_status, 0) AS order_dispatch_status,
      COALESCE(no.delivery_status, 0) AS order_delivery_status,
      DATE_FORMAT(no.delivery_date, '%Y-%m-%d') AS delivery_date,
      DATE_FORMAT(no.delivered_on, '%Y-%m-%d') AS delivered_on,
      no.state,
      no.created_by AS order_sales_person,
      COALESCE(
        NULLIF(TRIM(no.booking_by), ''),
        NULLIF(TRIM(no.dispatch_person), '')
      ) AS assigned_by,
      COALESCE(svc.installation_completed, 0) AS installation_completed,
      COALESCE(svc.no_feedback_collected, 0) AS no_feedback_collected,
      svc.service_engineer,
      svc.third_party_engineer,
      COALESCE(agg.warranty_registered, 0) AS warranty_registered,
      NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(agg.registration_meta, '||', 3), '||', -1), '') AS registered_by
    FROM neworder no
    INNER JOIN (
      SELECT
        ${quoteKeyD} AS quote_key,
        MAX(CASE WHEN wp.serial_number IS NOT NULL THEN 1 ELSE 0 END) AS warranty_registered,
        SUBSTRING_INDEX(
          GROUP_CONCAT(
            CASE
              WHEN wp.serial_number IS NOT NULL
              THEN CONCAT(
                LPAD(wp.id, 20, '0'),
                '||',
                DATE_FORMAT(COALESCE(wp.created_at, wp.invoice_date), '%Y-%m-%d'),
                '||',
                TRIM(COALESCE(wp.created_by, ''))
              )
            END
            ORDER BY wp.id DESC
            SEPARATOR ','
          ),
          ',',
          1
        ) AS registration_meta
      FROM dispatch d
      ${joinPendingOrderOnQuote("d.quote_number", orderEligibility)}
      ${dispatchTypeJoin(dispatchType)}
      LEFT JOIN warranty_products wp
        ON ${sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no")}
      WHERE 1=1
        ${dispatchEligibleSql("d", "no_p", orderEligibility)}
      GROUP BY quote_key
    ) agg ON ${sqlTrimUtf8EqColumns("agg.quote_key", "no.quote_number")}
    LEFT JOIN (
      SELECT
        ${quoteKeyD2} AS quote_key,
        ${SVC_INSTALLATION_TEAM_AGG_SQL}
        MAX(
          CASE
            WHEN UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'
              AND UPPER(TRIM(COALESCE(sr2.status, ''))) = 'COMPLETED'
            THEN 1
            ELSE 0
          END
        ) AS installation_completed,
        MAX(
          CASE
            WHEN ${NO_FEEDBACK_ON_COMPLETED_INSTALLATION_SQL}
            THEN 1
            ELSE 0
          END
        ) AS no_feedback_collected
      FROM dispatch d2
      ${joinPendingOrderOnQuote("d2.quote_number", orderEligibility)}
      INNER JOIN service_records sr2
        ON ${sqlTrimUtf8EqColumns("sr2.serial_number", "d2.serial_no")}
      WHERE 1=1
        ${dispatchEligibleSql("d2", "no_p", orderEligibility)}
        AND UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'
      GROUP BY quote_key
    ) svc ON ${sqlTrimUtf8EqColumns("svc.quote_key", "no.quote_number")}
    WHERE ${pendingNeworderPredicates("no", orderEligibility)}
      ${bucketWhereOnNo}
  `;
}
