import { getDbConnection } from "@/lib/db";
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
  const conn = await getDbConnection();
  const f = parseSbiFilters(filters);
  const wpFilter = buildWpFilterSql(f);
  const srFilter = buildServiceRecordFilterSql(f, {
    dateExpr: "COALESCE(sr.planned_date, sr.complaint_date)",
  });
  const amcFilter = buildAmcFilterSql(f);

  const [[wpRow]] = await conn.execute(
    `SELECT
       COUNT(*) AS total_registered,
       SUM(CASE WHEN ${IN_WARRANTY_SQL} THEN 1 ELSE 0 END) AS active_warranty,
       SUM(CASE WHEN ${DUE_WARRANTY_EXPIRY_SQL} THEN 1 ELSE 0 END) AS due_warranty_expiry
     FROM warranty_products wp
     WHERE 1=1 ${wpFilter.sql}`,
    wpFilter.params,
  );

  const [[openInstRow]] = await conn.execute(
    `SELECT COUNT(*) AS open_installation
     FROM service_records sr
     LEFT JOIN warranty_products wp
       ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
     WHERE ${PENDING_SERVICE_SQL}
       AND ${OPEN_INSTALLATIONS_SQL}
       ${srFilter.sql}`,
    srFilter.params,
  );

  const [[srRow]] = await conn.execute(
    `SELECT COUNT(*) AS open_completions
     FROM service_records sr
     LEFT JOIN warranty_products wp
       ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
     WHERE ${PENDING_SERVICE_SQL}
       AND ${OPEN_COMPLAINTS_SQL}
       ${srFilter.sql}`,
    srFilter.params,
  );

  const overdueDelayedTotal = await countUpcomingInstallations(conn, f, {
    overdueDelayedOnly: true,
  });

  const [[amcRow]] = await conn.execute(
    `SELECT
       SUM(CASE WHEN ${ACTIVE_AMC_SQL} THEN 1 ELSE 0 END) AS active_amc,
       SUM(CASE WHEN ${DUE_AMC_SQL} THEN 1 ELSE 0 END) AS due_amc_expiring
     FROM amc_cmc
     WHERE 1=1 ${amcFilter.sql}`,
    amcFilter.params,
  );

  return {
    total_registered: Number(wpRow?.total_registered || 0),
    open_installation: Number(openInstRow?.open_installation || 0),
    open_completions: Number(srRow?.open_completions || 0),
    overdue_delayed_installation: overdueDelayedTotal,
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

  if (segment === "open-completions" || segment === "open-installation") {
    const srFilter = buildServiceRecordFilterSql(filters, {
      dateExpr: "COALESCE(sr.planned_date, sr.complaint_date)",
    });
    const typeSql =
      segment === "open-completions" ? OPEN_COMPLAINTS_SQL : OPEN_INSTALLATIONS_SQL;
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
       wp.invoice_number,
       wp.invoice_date,
       wp.installation_date,
       wp.warranty_period,
       wp.installed_address,
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