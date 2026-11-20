import {
  UTF8_COLLATE,
  sqlTrimUtf8EqColumns,
  sqlUtf8HasText,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import {
  INSTALLED_AFTER_REGISTERED_SQL,
  INSTALLATION_PENDING_AFTER_REGISTERED_SQL,
} from "@/lib/serviceBeforeInstallationWpExpressions";
import {
  U_ACTUALLY_DELIVERED_SQL,
  U_DELIVERED_INSTALLATION_PENDING_SQL,
  U_DELIVERY_PENDING_AFTER_DISPATCH_SQL,
  U_INSTALLATION_COMPLETED_SQL,
  U_NO_FEEDBACK_COLLECTED_SQL,
  U_OPEN_INSTALLATION_ORDER_SQL,
  U_INSTALLATION_PLANNED_SQL,
} from "@/lib/openInstallationKpiSql";

const DISPATCH_ON_ORDER_QUOTE = sqlTrimUtf8EqColumns("d.quote_number", "no.quote_number");

export function buildWpFilterSql(
  filters,
  {
    dateExpr = "COALESCE(wp.installation_date, wp.invoice_date)",
    omitTeamFilters = false,
    omitRegisteredInstallation = false,
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

  if (!omitRegisteredInstallation) {
    if (f.registeredInstallation === "pending") {
      sql += ` AND ${INSTALLATION_PENDING_AFTER_REGISTERED_SQL}`;
    } else if (f.registeredInstallation === "completed") {
      sql += ` AND ${INSTALLED_AFTER_REGISTERED_SQL}`;
    }
  }

  return { sql, params };
}

export function buildUpcomingInstallationListFilterSql(
  filters,
  { omitOpenInstallationBucket = false, omitTeamFilters = false } = {},
) {
  const f = parseSbiFilters(filters);
  let sql = "";
  const params = [];

  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      u.order_id LIKE ? OR u.quote_number LIKE ? OR u.company_name LIKE ?
      OR u.contact LIKE ? OR u.invoice_number LIKE ? OR u.delivery_address LIKE ?
      OR u.model LIKE ? OR u.name LIKE ? OR u.serial_number LIKE ? OR u.emp_name LIKE ?
      OR u.state LIKE ? OR u.order_sales_person LIKE ? OR u.assigned_by LIKE ?
      OR u.registered_by LIKE ?
      OR u.service_engineer LIKE ? OR u.third_party_engineer LIKE ?
      OR CAST(u.service_id AS CHAR) LIKE ?
    )`;
    params.push(...Array(16).fill(term));
  }
  if (f.model) {
    sql += ` AND u.model LIKE ?`;
    params.push(`%${f.model}%`);
  }
  if (f.state) {
    sql += ` AND u.state LIKE ?`;
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

  if (f.warrantyRegistration === "registered") {
    sql += ` AND COALESCE(u.warranty_registered, 0) = 1`;
  } else if (f.warrantyRegistration === "not_registered") {
    sql += ` AND COALESCE(u.warranty_registered, 0) = 0`;
  }

  if (f.orderDeliveryStatus === "delivered") {
    sql += ` AND ${U_ACTUALLY_DELIVERED_SQL}`;
  } else if (f.orderDeliveryStatus === "not_delivered") {
    sql += ` AND NOT ${U_ACTUALLY_DELIVERED_SQL}`;
  }

  if (f.serviceStatus) {
    if (f.serviceStatus === "__no_installation_service__") {
      sql += ` AND NOT EXISTS (
        SELECT 1
        FROM dispatch d_svc
        INNER JOIN service_records sr_svc
          ON ${sqlTrimUtf8EqColumns("sr_svc.serial_number", "d_svc.serial_no")}
        WHERE ${sqlTrimUtf8EqColumns("d_svc.quote_number", "u.quote_number")}
          AND UPPER(TRIM(COALESCE(sr_svc.service_type, ''))) = 'INSTALLATION'
      )`;
    } else {
      sql += ` AND EXISTS (
        SELECT 1
        FROM dispatch d_svc
        INNER JOIN service_records sr_svc
          ON ${sqlTrimUtf8EqColumns("sr_svc.serial_number", "d_svc.serial_no")}
        WHERE ${sqlTrimUtf8EqColumns("d_svc.quote_number", "u.quote_number")}
          AND UPPER(TRIM(COALESCE(sr_svc.service_type, ''))) = 'INSTALLATION'
          AND UPPER(TRIM(COALESCE(sr_svc.status, ''))) = UPPER(TRIM(?))
      )`;
      params.push(f.serviceStatus);
    }
  }

  if (!omitOpenInstallationBucket && !f.openInstallationBucket) {
    sql += ` AND ${U_OPEN_INSTALLATION_ORDER_SQL}`;
  }

  if (!omitOpenInstallationBucket) {
    if (f.openInstallationBucket === "delivered_pending") {
      sql += ` AND ${U_DELIVERED_INSTALLATION_PENDING_SQL}`;
    } else if (f.openInstallationBucket === "delivery_pending") {
      sql += ` AND ${U_DELIVERY_PENDING_AFTER_DISPATCH_SQL}`;
    } else if (f.openInstallationBucket === "installation_planned") {
      sql += ` AND ${U_INSTALLATION_PLANNED_SQL}`;
    } else if (f.openInstallationBucket === "completed") {
      sql += ` AND ${U_INSTALLATION_COMPLETED_SQL}`;
    } else if (f.openInstallationBucket === "feedback_collected") {
      sql += ` AND LOWER(TRIM(COALESCE(u.google_feedback_collected, ''))) = 'yes'`;
    } else if (f.openInstallationBucket === "no_feedback") {
      sql += ` AND ${U_NO_FEEDBACK_COLLECTED_SQL}`;
    }
  }

  if (!omitTeamFilters) {
    const nameEq = `TRIM(CONVERT(? USING utf8mb4)) COLLATE ${UTF8_COLLATE}`;
    if (f.salesPerson) {
      sql += ` AND ${sqlUtf8TrimExpr("u.order_sales_person")} COLLATE ${UTF8_COLLATE} = ${nameEq}`;
      params.push(f.salesPerson);
    }
    if (f.serviceEngineer) {
      sql += ` AND ${sqlUtf8TrimExpr("u.service_engineer")} COLLATE ${UTF8_COLLATE} = ${nameEq}`;
      params.push(f.serviceEngineer);
    }
    if (f.thirdPartyEngineer) {
      sql += ` AND ${sqlUtf8TrimExpr("u.third_party_engineer")} COLLATE ${UTF8_COLLATE} = ${nameEq}`;
      params.push(f.thirdPartyEngineer);
    }
    if (f.instCompletedBy) {
      sql += ` AND (
        ${sqlUtf8TrimExpr("u.service_engineer")} COLLATE ${UTF8_COLLATE} = ${nameEq}
        OR ${sqlUtf8TrimExpr("u.third_party_engineer")} COLLATE ${UTF8_COLLATE} = ${nameEq}
        OR ${sqlUtf8TrimExpr("u.completed_by_service_engineer")} COLLATE ${UTF8_COLLATE} = ${nameEq}
        OR ${sqlUtf8TrimExpr("u.installation_report_engineer")} COLLATE ${UTF8_COLLATE} = ${nameEq}
      )`;
      params.push(f.instCompletedBy, f.instCompletedBy, f.instCompletedBy, f.instCompletedBy);
    }
    if (f.assignedBy) {
      sql += ` AND ${sqlUtf8TrimExpr("u.registered_by")} COLLATE ${UTF8_COLLATE} = ${nameEq}`;
      params.push(f.assignedBy);
    }
    if (f.registeredBy) {
      sql += ` AND ${sqlUtf8TrimExpr("u.registered_by")} COLLATE ${UTF8_COLLATE} = ${nameEq}`;
      params.push(f.registeredBy);
    }
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