import { UNREGISTERED_PRODUCT_ORDER_SQL } from "@/lib/pendingProductRegistrationCount";
import { sqlTrimUtf8EqColumns, sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

function pendingNeworderPredicates(alias = "no_p") {
  return `
    ${alias}.installation_status = 0
    AND (${alias}.is_returned = 0 OR ${alias}.is_returned = 2 OR ${alias}.is_returned IS NULL)
    AND (${alias}.is_cancelled = 0 OR ${alias}.is_cancelled IS NULL)
    AND ${alias}.delivery_date IS NOT NULL
    AND ${alias}.dispatch_status = 1`;
}

/** Restrict rows to quotes that still have a pending installation order */
function joinPendingOrderOnQuote(quoteColumnExpr) {
  return `
    INNER JOIN neworder no_p
      ON ${sqlTrimUtf8EqColumns("no_p.quote_number", quoteColumnExpr)}
      AND ${pendingNeworderPredicates("no_p")}`;
}

function dispatchTypeJoin(type) {
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
export function buildUpcomingInstallationsQuery({ type = "products", registration = null } = {}) {
  const registrationFilter =
    registration === "unregistered" ? `AND ${UNREGISTERED_PRODUCT_ORDER_SQL}` : "";

  const quoteKeyD = sqlUtf8TrimExpr("d.quote_number");
  const quoteKeyD2 = sqlUtf8TrimExpr("d2.quote_number");
  const quoteKeyQi = sqlUtf8TrimExpr("qi.quote_number");

  return `
    SELECT
      no.id,
      no.order_id,
      no.quote_number,
      no.invoice_number,
      agg.serial_number,
      svc.service_id,
      agg.model,
      agg.name,
      no.delivery_location AS delivery_address,
      no.company_name,
      no.contact,
      no.created_by AS emp_name,
      DATE_FORMAT(no.delivery_date, '%Y-%m-%d') AS delivery_date,
      DATE_FORMAT(no.delivered_on, '%Y-%m-%d') AS delivered_on,
      COALESCE(qtot.pricing_total, 0) AS pricing_total,
      COALESCE(qtot.total_qty, 0) AS total_qty,
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
      agg.warranty_registered
    FROM neworder no
    INNER JOIN (
      SELECT
        ${quoteKeyD} AS quote_key,
        GROUP_CONCAT(DISTINCT d.serial_no ORDER BY d.serial_no SEPARATOR ', ') AS serial_number,
        GROUP_CONCAT(DISTINCT d.item_code ORDER BY d.item_code SEPARATOR ', ') AS model,
        GROUP_CONCAT(DISTINCT d.item_name ORDER BY d.item_name SEPARATOR ', ') AS name,
        MAX(CASE WHEN wp.serial_number IS NOT NULL THEN 1 ELSE 0 END) AS warranty_registered
      FROM dispatch d
      ${joinPendingOrderOnQuote("d.quote_number")}
      ${dispatchTypeJoin(type)}
      LEFT JOIN warranty_products wp
        ON ${sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no")}
      WHERE d.serial_no IS NOT NULL
        AND TRIM(d.serial_no) <> ''
      GROUP BY quote_key
    ) agg ON ${sqlTrimUtf8EqColumns("agg.quote_key", "no.quote_number")}
    LEFT JOIN (
      SELECT
        ${quoteKeyD2} AS quote_key,
        GROUP_CONCAT(DISTINCT sr2.service_id ORDER BY sr2.service_id SEPARATOR ', ') AS service_id
      FROM dispatch d2
      ${joinPendingOrderOnQuote("d2.quote_number")}
      INNER JOIN service_records sr2
        ON ${sqlTrimUtf8EqColumns("sr2.serial_number", "d2.serial_no")}
      WHERE d2.serial_no IS NOT NULL
        AND TRIM(d2.serial_no) <> ''
      GROUP BY quote_key
    ) svc ON ${sqlTrimUtf8EqColumns("svc.quote_key", "no.quote_number")}
    LEFT JOIN (
      SELECT
        ${quoteKeyQi} AS quote_key,
        SUM(qi.total_price) AS pricing_total,
        SUM(qi.quantity) AS total_qty
      FROM quotation_items qi
      ${joinPendingOrderOnQuote("qi.quote_number")}
      GROUP BY quote_key
    ) qtot ON ${sqlTrimUtf8EqColumns("qtot.quote_key", "no.quote_number")}
    WHERE ${pendingNeworderPredicates("no")}
      ${registrationFilter}
    ORDER BY days_until_installation ASC
  `;
}
