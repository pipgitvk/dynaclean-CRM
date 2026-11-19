import { getDbConnection } from "@/lib/db";
import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";
import {
  buildUpcomingInstallationsQuery,
  resolveUpcomingInstallationType,
} from "@/lib/upcomingInstallationsQuery";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import {
  buildAmcFilterSql,
  buildServiceRecordFilterSql,
  buildUpcomingInstallationListFilterSql,
  buildWpFilterSql,
  parseSbiFilters,
} from "@/lib/serviceBeforeInstallationFilters";

function upcomingOverdueDelayedExtraSql() {
  return ` AND u.delivery_date < DATE_SUB(CURDATE(), INTERVAL ${OVERDUE_DELAYED_INSTALLATION_DAYS} DAY)`;
}

/** Pending installation orders with delivery date older than this many days. */
export const OVERDUE_DELAYED_INSTALLATION_DAYS = 2;

async function countUpcomingInstallations(conn, filters, { overdueDelayedOnly = false } = {}) {
  const parsed = parseSbiFilters(filters);
  const type = resolveUpcomingInstallationType(parsed.itemType);
  const inner = buildUpcomingInstallationsQuery({ type, registration: null });
  const listFilter = buildUpcomingInstallationListFilterSql(filters);
  const extraSql = overdueDelayedOnly ? upcomingOverdueDelayedExtraSql() : "";
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS cnt FROM (${inner}) u WHERE 1=1 ${listFilter.sql}${extraSql}`,
    listFilter.params,
  );
  return Number(row?.cnt || 0);
}

/** Hub KPI: open + overdue delayed in one pass over the upcoming-installations subquery. */
async function countUpcomingInstallationHubTotals(conn, filters) {
  const parsed = parseSbiFilters(filters);
  const type = resolveUpcomingInstallationType(parsed.itemType);
  const inner = buildUpcomingInstallationsQuery({ type, registration: null });
  const listFilter = buildUpcomingInstallationListFilterSql(filters);
  const overdueSql = `u.delivery_date < DATE_SUB(CURDATE(), INTERVAL ${OVERDUE_DELAYED_INSTALLATION_DAYS} DAY)`;
  const [[row]] = await conn.execute(
    `SELECT
       COUNT(*) AS open_installation,
       SUM(CASE WHEN ${overdueSql} THEN 1 ELSE 0 END) AS overdue_delayed_installation
     FROM (${inner}) u WHERE 1=1 ${listFilter.sql}`,
    listFilter.params,
  );
  return {
    open_installation: Number(row?.open_installation || 0),
    overdue_delayed_installation: Number(row?.overdue_delayed_installation || 0),
  };
}

async function fetchUpcomingInstallationsPage(
  conn,
  filters,
  limit,
  skip,
  { overdueDelayedOnly = false } = {},
) {
  const parsed = parseSbiFilters(filters);
  const type = resolveUpcomingInstallationType(parsed.itemType);
  const inner = buildUpcomingInstallationsQuery({ type, registration: null });
  const listFilter = buildUpcomingInstallationListFilterSql(filters);
  const extraSql = overdueDelayedOnly ? upcomingOverdueDelayedExtraSql() : "";
  const baseParams = [...listFilter.params];

  const total = await countUpcomingInstallations(conn, filters, { overdueDelayedOnly });

  const orderBy = overdueDelayedOnly ? "u.delivery_date ASC" : "u.days_until_installation ASC";

  const [rows] = await conn.execute(
    `SELECT u.* FROM (${inner}) u WHERE 1=1 ${listFilter.sql}${extraSql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...baseParams, limit, skip],
  );

  return { total, data: rows };
}

export const NOT_INSTALLED_SQL = `(
  wp.installed_address IS NULL OR TRIM(wp.installed_address) = ''
)`;

export const IN_WARRANTY_SQL = `(
  wp.installation_date IS NOT NULL
  AND wp.warranty_period IS NOT NULL
  AND TRIM(CAST(wp.warranty_period AS CHAR)) <> ''
  AND DATE_ADD(DATE(wp.installation_date), INTERVAL CAST(wp.warranty_period AS UNSIGNED) MONTH) >= CURDATE()
)`;

const WARRANTY_END_DATE_SQL = `DATE_ADD(DATE(wp.installation_date), INTERVAL CAST(wp.warranty_period AS UNSIGNED) MONTH)`;

export const DUE_WARRANTY_EXPIRY_SQL = `(
  wp.installation_date IS NOT NULL
  AND wp.warranty_period IS NOT NULL
  AND TRIM(CAST(wp.warranty_period AS CHAR)) <> ''
  AND (
    ${WARRANTY_END_DATE_SQL} < CURDATE()
    OR ${WARRANTY_END_DATE_SQL} <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
  )
)`;

export const PENDING_SERVICE_SQL = `(
  UPPER(TRIM(COALESCE(sr.status, ''))) NOT IN ('COMPLETED', 'CANCELLED')
)`;

/** Open Complaints card — pending complaint service records only (not installation, etc.). */
export const OPEN_COMPLAINTS_SQL = `(
  UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'COMPLAINT'
)`;

/** Open Installation — pending installation jobs from Service Records (view_service_reports). */
export const OPEN_INSTALLATIONS_SQL = `(
  UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
)`;

export const ACTIVE_AMC_SQL = `(
  LOWER(TRIM(status)) = 'approved'
  AND amc_end_datetime IS NOT NULL
  AND DATE(amc_end_datetime) >= CURDATE()
)`;

export const DUE_AMC_SQL = `(
  LOWER(TRIM(status)) = 'approved'
  AND amc_end_datetime IS NOT NULL
  AND (
    DATE(amc_end_datetime) < CURDATE()
    OR DATE(amc_end_datetime) <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
  )
)`;

export async function fetchServiceBeforeInstallationHubCounts(filters = {}) {
  const pool = await getDbConnection();
  const f = parseSbiFilters(filters);
  const wpFilter = buildWpFilterSql(f);
  const srFilter = buildServiceRecordFilterSql(f, {
    dateExpr: "COALESCE(sr.planned_date, sr.complaint_date)",
  });
  const amcFilter = buildAmcFilterSql(f);

  const wpSql = `SELECT
       COUNT(*) AS total_registered,
       SUM(CASE WHEN ${IN_WARRANTY_SQL} THEN 1 ELSE 0 END) AS active_warranty,
       SUM(CASE WHEN ${DUE_WARRANTY_EXPIRY_SQL} THEN 1 ELSE 0 END) AS due_warranty_expiry
     FROM warranty_products wp
     WHERE 1=1 ${wpFilter.sql}`;

  const srSql = `SELECT COUNT(*) AS open_completions
     FROM service_records sr
     LEFT JOIN warranty_products wp
       ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
     WHERE ${PENDING_SERVICE_SQL}
       AND ${OPEN_COMPLAINTS_SQL}
       ${srFilter.sql}`;

  const amcSql = `SELECT
       SUM(CASE WHEN ${ACTIVE_AMC_SQL} THEN 1 ELSE 0 END) AS active_amc,
       SUM(CASE WHEN ${DUE_AMC_SQL} THEN 1 ELSE 0 END) AS due_amc_expiring
     FROM amc_cmc
     WHERE 1=1 ${amcFilter.sql}`;

  const [wpResult, srResult, amcResult, upcomingTotals] = await Promise.all([
    pool.execute(wpSql, wpFilter.params),
    pool.execute(srSql, srFilter.params),
    pool.execute(amcSql, amcFilter.params),
    countUpcomingInstallationHubTotals(pool, f),
  ]);

  const wpRow = wpResult[0]?.[0];
  const srRow = srResult[0]?.[0];
  const amcRow = amcResult[0]?.[0];

  return {
    total_registered: Number(wpRow?.total_registered || 0),
    open_installation: upcomingTotals.open_installation,
    open_completions: Number(srRow?.open_completions || 0),
    overdue_delayed_installation: upcomingTotals.overdue_delayed_installation,
    active_warranty: Number(wpRow?.active_warranty || 0),
    due_warranty_expiry: Number(wpRow?.due_warranty_expiry || 0),
    active_amc: Number(amcRow?.active_amc || 0),
    due_amc_expiring: Number(amcRow?.due_amc_expiring || 0),
  };
}

export async function fetchServiceBeforeInstallationSegmentPage(segment, options = {}) {
  if (!isServiceBeforeInstallationSegment(segment)) {
    throw new Error("Invalid segment");
  }

  const filters = parseSbiFilters(options);
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
  const skip = Math.max(Number(options.skip) || 0, 0);

  const conn = await getDbConnection();
  const safeLimit = limit;
  const safeSkip = skip;

  if (segment === "open-installation") {
    return fetchUpcomingInstallationsPage(conn, filters, safeLimit, safeSkip, {
      overdueDelayedOnly: false,
    });
  }

  if (segment === "open-completions") {
    const srFilter = buildServiceRecordFilterSql(filters, {
      dateExpr: "COALESCE(sr.planned_date, sr.complaint_date)",
    });
    const typeSql = OPEN_COMPLAINTS_SQL;
    const where = `WHERE ${PENDING_SERVICE_SQL} AND ${typeSql} ${srFilter.sql}`;
    const baseParams = [...srFilter.params];

    const [[countRow]] = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM service_records sr
       LEFT JOIN warranty_products wp
         ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
       ${where}`,
      baseParams,
    );

    const [rows] = await conn.execute(
      `SELECT
         sr.service_id,
         sr.serial_number,
         sr.service_type,
         sr.status,
         sr.complaint_date,
         sr.planned_date,
         sr.complaint_summary,
         sr.assigned_to,
         wp.customer_name,
         wp.model,
         wp.contact,
         wp.product_name
       FROM service_records sr
       LEFT JOIN warranty_products wp
         ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
       ${where}
       ORDER BY sr.service_id DESC
       LIMIT ? OFFSET ?`,
      [...baseParams, safeLimit, safeSkip],
    );

    return {
      total: Number(countRow?.cnt || 0),
      data: rows,
    };
  }

  if (segment === "overdue-delayed-installation") {
    return fetchUpcomingInstallationsPage(conn, filters, safeLimit, safeSkip, {
      overdueDelayedOnly: true,
    });
  }

  if (segment === "active-amc" || segment === "due-amc-expiring") {
    const filterSql = segment === "active-amc" ? ACTIVE_AMC_SQL : DUE_AMC_SQL;
    const amcFilter = buildAmcFilterSql(filters);
    const where = `WHERE ${filterSql} ${amcFilter.sql}`;
    const baseParams = [...amcFilter.params];

    const [[countRow]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM amc_cmc ${where}`,
      baseParams,
    );

    const [rows] = await conn.execute(
      `SELECT
         id,
         serial_number,
         company_name,
         contact,
         email,
         model,
         status,
         amc_start_datetime,
         amc_end_datetime,
         created_by
       FROM amc_cmc
       ${where}
       ORDER BY amc_end_datetime ASC
       LIMIT ? OFFSET ?`,
      [...baseParams, safeLimit, safeSkip],
    );

    return {
      total: Number(countRow?.cnt || 0),
      data: rows,
    };
  }

  let filterSql = "1=1";
  if (segment === "total-registered") filterSql = "1=1";
  else if (segment === "active-warranty") filterSql = IN_WARRANTY_SQL;
  else if (segment === "due-warranty-expiry") filterSql = DUE_WARRANTY_EXPIRY_SQL;

  const wpFilter = buildWpFilterSql(filters);
  const where = `WHERE ${filterSql} ${wpFilter.sql}`;
  const baseParams = [...wpFilter.params];

  const [[countRow]] = await conn.execute(
    `SELECT COUNT(*) AS cnt FROM warranty_products wp ${where}`,
    baseParams,
  );

  const [rows] = await conn.execute(
    `SELECT
       wp.id,
       wp.serial_number,
       wp.customer_name,
       wp.model,
       wp.product_name,
       wp.contact,
       wp.email,
       wp.contact_person,
       wp.customer_address,
       wp.state,
       wp.site_person,
       wp.site_contact,
       wp.site_email,
       wp.invoice_number,
       wp.invoice_date,
       wp.invoice_file,
       wp.installation_date,
       wp.warranty_period,
       wp.installed_address,
       wp.created_by AS registered_by,
       wp.created_at AS registered_at,
       (
         SELECT MIN(c.customer_id)
         FROM customers c
         WHERE (
           TRIM(COALESCE(wp.contact, '')) <> ''
           AND TRIM(COALESCE(c.phone, '')) = TRIM(wp.contact)
         )
         OR (
           TRIM(COALESCE(wp.email, '')) <> ''
           AND LOWER(TRIM(COALESCE(c.email, ''))) = LOWER(TRIM(wp.email))
         )
       ) AS customer_id,
       COALESCE(
         (
           SELECT no.created_by
           FROM dispatch d
           INNER JOIN neworder no
             ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
           WHERE ${sqlTrimUtf8EqColumns("d.serial_no", "wp.serial_number")}
             AND TRIM(COALESCE(no.created_by, '')) <> ''
           ORDER BY no.id DESC
           LIMIT 1
         ),
         (
           SELECT no.created_by
           FROM neworder no
           WHERE TRIM(COALESCE(wp.invoice_number, '')) <> ''
             AND ${sqlTrimUtf8EqColumns("no.invoice_number", "wp.invoice_number")}
             AND TRIM(COALESCE(no.created_by, '')) <> ''
           ORDER BY no.id DESC
           LIMIT 1
         )
       ) AS order_sales_person,
       (
         SELECT sr.assigned_to
         FROM service_records sr
         WHERE ${sqlTrimUtf8EqColumns("sr.serial_number", "wp.serial_number")}
           AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
           AND UPPER(TRIM(COALESCE(sr.assigned_to, ''))) NOT IN ('', 'NOT ASSIGNED', 'UNASSIGNED')
         ORDER BY
           CASE
             WHEN UPPER(TRIM(COALESCE(sr.status, ''))) IN ('COMPLETED', 'WORKED') THEN 0
             ELSE 1
           END,
           sr.service_id DESC
         LIMIT 1
       ) AS installation_engineer,
       DATE_ADD(DATE(wp.installation_date), INTERVAL CAST(wp.warranty_period AS UNSIGNED) MONTH) AS warranty_end_date
     FROM warranty_products wp
     ${where}
     ORDER BY wp.id DESC
     LIMIT ? OFFSET ?`,
    [...baseParams, safeLimit, safeSkip],
  );

  return {
    total: Number(countRow?.cnt || 0),
    data: rows,
  };
}