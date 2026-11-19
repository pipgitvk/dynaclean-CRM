import {
  UTF8_COLLATE,
  sqlTrimUtf8EqColumns,
  sqlUtf8HasText,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";

const DISPATCH_ON_ORDER_QUOTE = sqlTrimUtf8EqColumns("d.quote_number", "no.quote_number");

export function buildWpFilterSql(
  filters,
  {
    dateExpr = "COALESCE(wp.installation_date, wp.invoice_date)",
    omitTeamFilters = false,
  } = {},
) {
  const f = parseSbiFilters(filters);
  let sql = "";
  const params = [];

  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      wp.serial_number LIKE ? OR wp.customer_name LIKE ? OR wp.model LIKE ?
      OR wp.contact LIKE ? OR wp.invoice_number LIKE ? OR wp.product_name LIKE ?
      OR wp.installed_address LIKE ? OR wp.email LIKE ? OR wp.state LIKE ?
      OR wp.specification LIKE ? OR wp.contact_person LIKE ?
    )`;
    params.push(...Array(11).fill(term));
  }
  if (f.model) {
    sql += ` AND wp.model LIKE ?`;
    params.push(`%${f.model}%`);
  }
  if (f.state) {
    sql += ` AND wp.state LIKE ?`;
    params.push(`%${f.state}%`);
  }
  if (f.serial) {
    sql += ` AND wp.serial_number LIKE ?`;
    params.push(`%${f.serial}%`);
  }
  if (f.from) {
    sql += ` AND DATE(${dateExpr}) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    sql += ` AND DATE(${dateExpr}) <= ?`;
    params.push(f.to);
  }

  if (!omitTeamFilters) {
    const nameEq = `TRIM(CONVERT(? USING utf8mb4)) COLLATE ${UTF8_COLLATE}`;

    if (f.salesPerson) {
      sql += ` AND (
        ${sqlUtf8TrimExpr("wp.created_by")} COLLATE ${UTF8_COLLATE} = ${nameEq}
        OR EXISTS (
          SELECT 1
          FROM dispatch d
          INNER JOIN neworder no
            ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
          WHERE ${sqlTrimUtf8EqColumns("d.serial_no", "wp.serial_number")}
            AND ${sqlUtf8TrimExpr("no.created_by")} COLLATE ${UTF8_COLLATE} = ${nameEq}
        )
        OR EXISTS (
          SELECT 1
          FROM neworder no
          WHERE ${sqlUtf8HasText("wp.invoice_number")}
            AND ${sqlTrimUtf8EqColumns("no.invoice_number", "wp.invoice_number")}
            AND ${sqlUtf8TrimExpr("no.created_by")} COLLATE ${UTF8_COLLATE} = ${nameEq}
        )
      )`;
      params.push(f.salesPerson, f.salesPerson, f.salesPerson);
    }
    if (f.serviceEngineer) {
      sql += ` AND EXISTS (
        SELECT 1
        FROM service_records sr
        WHERE ${sqlTrimUtf8EqColumns("sr.serial_number", "wp.serial_number")}
          AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
          AND UPPER(TRIM(COALESCE(sr.assigned_to, ''))) NOT IN ('', 'NOT ASSIGNED', 'UNASSIGNED')
          AND LOWER(TRIM(COALESCE(sr.assigned_to_type, 'internal'))) <> 'third_party'
          AND ${sqlUtf8TrimExpr("sr.assigned_to")} COLLATE ${UTF8_COLLATE} = ${nameEq}
      )`;
      params.push(f.serviceEngineer);
    }
    if (f.thirdPartyEngineer) {
      sql += ` AND EXISTS (
        SELECT 1
        FROM service_records sr
        WHERE ${sqlTrimUtf8EqColumns("sr.serial_number", "wp.serial_number")}
          AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
          AND UPPER(TRIM(COALESCE(sr.assigned_to, ''))) NOT IN ('', 'NOT ASSIGNED', 'UNASSIGNED')
          AND LOWER(TRIM(COALESCE(sr.assigned_to_type, ''))) = 'third_party'
          AND ${sqlUtf8TrimExpr("sr.assigned_to")} COLLATE ${UTF8_COLLATE} = ${nameEq}
      )`;
      params.push(f.thirdPartyEngineer);
    }
  }

  return { sql, params };
}

export function buildUpcomingInstallationListFilterSql(filters) {
  const f = parseSbiFilters(filters);
  let sql = "";
  const params = [];

  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      u.order_id LIKE ? OR u.quote_number LIKE ? OR u.company_name LIKE ?
      OR u.contact LIKE ? OR u.invoice_number LIKE ? OR u.delivery_address LIKE ?
      OR u.model LIKE ? OR u.name LIKE ? OR u.serial_number LIKE ? OR u.emp_name LIKE ?
      OR CAST(u.service_id AS CHAR) LIKE ?
    )`;
    params.push(...Array(10).fill(term));
  }
  if (f.model) {
    sql += ` AND u.model LIKE ?`;
    params.push(`%${f.model}%`);
  }
  if (f.state) {
    sql += ` AND u.delivery_address LIKE ?`;
    params.push(`%${f.state}%`);
  }
  if (f.serial) {
    sql += ` AND (u.serial_number LIKE ? OR u.invoice_number LIKE ? OR u.order_id LIKE ?)`;
    params.push(`%${f.serial}%`, `%${f.serial}%`, `%${f.serial}%`);
  }
  if (f.from) {
    sql += ` AND DATE(u.delivery_date) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    sql += ` AND DATE(u.delivery_date) <= ?`;
    params.push(f.to);
  }

  return { sql, params };
}

export function buildServiceRecordFilterSql(filters, { dateExpr = "sr.complaint_date" } = {}) {
  const f = parseSbiFilters(filters);
  let sql = "";
  const params = [];

  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      sr.serial_number LIKE ? OR sr.service_id LIKE ? OR sr.service_type LIKE ?
      OR sr.complaint_summary LIKE ? OR sr.status LIKE ? OR wp.customer_name LIKE ?
      OR wp.model LIKE ? OR wp.serial_number LIKE ? OR sr.assigned_to LIKE ?
    )`;
    params.push(...Array(9).fill(term));
  }
  if (f.model) {
    sql += ` AND wp.model LIKE ?`;
    params.push(`%${f.model}%`);
  }
  if (f.assignedTo) {
    sql += ` AND sr.assigned_to LIKE ?`;
    params.push(`%${f.assignedTo}%`);
  } else if (f.state) {
    sql += ` AND (wp.state LIKE ? OR sr.assigned_to LIKE ?)`;
    params.push(`%${f.state}%`, `%${f.state}%`);
  }
  if (f.serviceStatus) {
    sql += ` AND sr.status LIKE ?`;
    params.push(`%${f.serviceStatus}%`);
  }
  if (f.serial) {
    sql += ` AND (sr.serial_number LIKE ? OR wp.serial_number LIKE ?)`;
    params.push(`%${f.serial}%`, `%${f.serial}%`);
  }
  if (f.from) {
    sql += ` AND DATE(${dateExpr}) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    sql += ` AND DATE(${dateExpr}) <= ?`;
    params.push(f.to);
  }

  return { sql, params };
}

export function buildOrderFilterSql(filters) {
  const f = parseSbiFilters(filters);
  let sql = "";
  const params = [];

  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      no.order_id LIKE ? OR no.quote_number LIKE ? OR no.company_name LIKE ?
      OR no.contact LIKE ? OR no.invoice_number LIKE ? OR no.delivery_location LIKE ?
    )`;
    params.push(...Array(6).fill(term));
  }
  if (f.model) {
    const term = `%${f.model}%`;
    sql += ` AND EXISTS (
      SELECT 1 FROM dispatch d
      LEFT JOIN quotation_items qi
        ON ${sqlTrimUtf8EqColumns("qi.quote_number", "d.quote_number")}
       AND ${sqlTrimUtf8EqColumns("qi.item_code", "d.item_code")}
      WHERE ${DISPATCH_ON_ORDER_QUOTE}
        AND COALESCE(d.stock_deducted, 0) = 1
        AND (
          d.item_code LIKE ? OR d.item_name LIKE ?
          OR qi.item_code LIKE ? OR qi.item_name LIKE ?
        )
    )`;
    params.push(term, term, term, term);
  }
  if (f.itemType === "products") {
    sql += ` AND EXISTS (
      SELECT 1 FROM dispatch d
      INNER JOIN products_list pl
        ON ${sqlTrimUtf8EqColumns("pl.item_code", "d.item_code")}
      WHERE ${DISPATCH_ON_ORDER_QUOTE}
        AND COALESCE(d.stock_deducted, 0) = 1
    )`;
  } else if (f.itemType === "spares") {
    sql += ` AND EXISTS (
      SELECT 1 FROM dispatch d
      INNER JOIN spare_list sl
        ON ${sqlTrimUtf8EqColumns("sl.spare_number", "d.item_code")}
      WHERE ${DISPATCH_ON_ORDER_QUOTE}
        AND COALESCE(d.stock_deducted, 0) = 1
    )`;
  }
  if (f.state) {
    sql += ` AND no.state LIKE ?`;
    params.push(`%${f.state}%`);
  }
  if (f.serial) {
    sql += ` AND (no.invoice_number LIKE ? OR no.order_id LIKE ?)`;
    params.push(`%${f.serial}%`, `%${f.serial}%`);
  }
  if (f.from) {
    sql += ` AND DATE(no.delivery_date) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    sql += ` AND DATE(no.delivery_date) <= ?`;
    params.push(f.to);
  }

  return { sql, params };
}

export function buildAmcFilterSql(filters) {
  const f = parseSbiFilters(filters);
  let sql = "";
  const params = [];

  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      serial_number LIKE ? OR company_name LIKE ? OR contact LIKE ? OR email LIKE ?
      OR model LIKE ? OR created_by LIKE ?
    )`;
    params.push(...Array(6).fill(term));
  }
  if (f.model) {
    sql += ` AND model LIKE ?`;
    params.push(`%${f.model}%`);
  }
  if (f.state) {
    sql += ` AND company_name LIKE ?`;
    params.push(`%${f.state}%`);
  }
  if (f.serial) {
    sql += ` AND serial_number LIKE ?`;
    params.push(`%${f.serial}%`);
  }
  if (f.from) {
    sql += ` AND DATE(amc_start_datetime) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    sql += ` AND DATE(amc_start_datetime) <= ?`;
    params.push(f.to);
  }

  return { sql, params };
}