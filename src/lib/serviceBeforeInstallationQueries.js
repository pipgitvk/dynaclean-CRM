import { getDbConnection } from "@/lib/db";
import {
  sqlTrimUtf8EqColumns,
  sqlUtf8HasText,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";
import {
  buildOpenInstallationKpiInnerQuery,
  buildUpcomingInstallationsQuery,
  dispatchTypeJoin,
  resolveUpcomingInstallationType,
} from "@/lib/upcomingInstallationsQuery";
import {
  dispatchSerialEligibleForInstallation,
  pendingNeworderPredicates,
} from "@/lib/upcomingInstallationOrderEligibility";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import {
  buildAmcFilterSql,
  buildServiceRecordFilterSql,
  buildUpcomingInstallationListFilterSql,
  buildWpFilterSql,
} from "@/lib/serviceBeforeInstallationFilterSql";
import {
  enrichTotalRegisteredRows,
  fetchSimpleWarrantyProductPage,
  fetchTotalRegisteredBasePage,
} from "@/lib/serviceBeforeInstallationWpList";
import {
  U_DELIVERED_INSTALLATION_PENDING_SQL,
  U_DELIVERY_PENDING_AFTER_DISPATCH_SQL,
  U_INSTALLATION_COMPLETED_SQL,
  U_NO_FEEDBACK_COLLECTED_SQL,
} from "@/lib/openInstallationKpiSql";
import {
  INSTALLED_AFTER_REGISTERED_SQL,
  INSTALLATION_PENDING_AFTER_REGISTERED_SQL,
} from "@/lib/serviceBeforeInstallationWpExpressions";

function upcomingOverdueDelayedExtraSql() {
  return ` AND u.delivery_date < DATE_SUB(CURDATE(), INTERVAL ${OVERDUE_DELAYED_INSTALLATION_DAYS} DAY)`;
}

/** Pending installation orders with delivery date older than this many days. */
export const OVERDUE_DELAYED_INSTALLATION_DAYS = 2;

const HUB_COUNTS_CACHE = new Map();
const HUB_COUNTS_TTL_MS = 45_000;
const OPEN_INSTALLATION_KPI_CACHE = new Map();
const OPEN_INSTALLATION_KPI_TTL_MS = 30_000;

function openInstallationNeedsFullListShape(filters) {
  const f = parseSbiFilters(filters);
  return Boolean(
    f.search ||
      f.model ||
      f.state ||
      f.serial ||
      f.salesPerson ||
      f.serviceEngineer ||
      f.thirdPartyEngineer ||
      f.warrantyRegistration,
  );
}

function buildOpenInstallationInnerQuery(filters, { forList = false } = {}) {
  const parsed = parseSbiFilters(filters);
  const type = resolveUpcomingInstallationType(parsed.itemType);
  if (forList) {
    return buildUpcomingInstallationsQuery({
      type,
      registration: null,
      includeQuoteTotals: false,
      includeServiceDetails: false,
      includeInnerOrderBy: false,
    });
  }
  if (openInstallationNeedsFullListShape(filters)) {
    return buildUpcomingInstallationsQuery({
      type,
      registration: null,
      includeQuoteTotals: false,
      includeServiceDetails: false,
      includeInnerOrderBy: false,
    });
  }
  return buildOpenInstallationKpiInnerQuery({ type });
}

async function countUpcomingInstallations(conn, filters, { overdueDelayedOnly = false } = {}) {
  const inner = buildOpenInstallationInnerQuery(filters, { forList: false });
  const listFilter = buildUpcomingInstallationListFilterSql(filters);
  const extraSql = overdueDelayedOnly ? upcomingOverdueDelayedExtraSql() : "";
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS cnt FROM (${inner}) u WHERE 1=1 ${listFilter.sql}${extraSql}`,
    listFilter.params,
  );
  return Number(row?.cnt || 0);
}

/**
 * Hub KPI counts — skip GROUP_CONCAT / service_records / quotation_items
 * (full list query). Only pending orders with an eligible dispatch serial.
 */
async function countUpcomingInstallationHubTotals(conn, filters) {
  const f = parseSbiFilters(filters);
  const needsFullListShape = Boolean(f.search || f.model || f.state || f.serial);

  if (needsFullListShape) {
    const type = resolveUpcomingInstallationType(f.itemType);
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

  const type = resolveUpcomingInstallationType(f.itemType);
  const typeJoin = dispatchTypeJoin(type === "all" ? null : type);
  const quoteKey = sqlUtf8TrimExpr("d.quote_number");
  const overdueSql = `no.delivery_date < DATE_SUB(CURDATE(), INTERVAL ${OVERDUE_DELAYED_INSTALLATION_DAYS} DAY)`;

  let dateSql = "";
  const params = [];
  if (f.from) {
    dateSql += ` AND DATE(no.delivery_date) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    dateSql += ` AND DATE(no.delivery_date) <= ?`;
    params.push(f.to);
  }

  const [[row]] = await conn.execute(
    `SELECT
       COUNT(*) AS open_installation,
       SUM(CASE WHEN ${overdueSql} THEN 1 ELSE 0 END) AS overdue_delayed_installation
     FROM neworder no
     INNER JOIN (
       SELECT ${quoteKey} AS quote_key
       FROM dispatch d
       INNER JOIN neworder no_p
         ON ${sqlTrimUtf8EqColumns("no_p.quote_number", "d.quote_number")}
         AND ${pendingNeworderPredicates("no_p")}
       ${typeJoin}
       WHERE 1=1
         ${dispatchSerialEligibleForInstallation("d", "no_p")}
       GROUP BY quote_key
     ) agg ON ${sqlTrimUtf8EqColumns("agg.quote_key", "no.quote_number")}
     WHERE ${pendingNeworderPredicates("no")}
       ${dateSql}`,
    params,
  );

  return {
    open_installation: Number(row?.open_installation || 0),
    overdue_delayed_installation: Number(row?.overdue_delayed_installation || 0),
  };
}

function openInstallationBreakdownAggregateSql(inner, listFilter, extraSql) {
  return `SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN ${U_DELIVERED_INSTALLATION_PENDING_SQL} THEN 1 ELSE 0 END) AS delivered_installation_pending,
    SUM(CASE WHEN ${U_DELIVERY_PENDING_AFTER_DISPATCH_SQL} THEN 1 ELSE 0 END) AS delivery_pending_after_dispatch,
    SUM(CASE WHEN ${U_INSTALLATION_COMPLETED_SQL} THEN 1 ELSE 0 END) AS completed_installation,
    SUM(CASE WHEN ${U_NO_FEEDBACK_COLLECTED_SQL} THEN 1 ELSE 0 END) AS no_feedback_collected
  FROM (${inner}) u WHERE 1=1 ${listFilter.sql}${extraSql}`;
}

function parseOpenInstallationBreakdownRow(row) {
  return {
    total: Number(row?.total || 0),
    delivered_installation_pending: Number(row?.delivered_installation_pending || 0),
    delivery_pending_after_dispatch: Number(row?.delivery_pending_after_dispatch || 0),
    completed_installation: Number(row?.completed_installation || 0),
    no_feedback_collected: Number(row?.no_feedback_collected || 0),
  };
}

function openInstallationKpiCacheKey(filters, overdueDelayedOnly) {
  const f = parseSbiFilters(filters);
  return JSON.stringify({
    overdueDelayedOnly: Boolean(overdueDelayedOnly),
    search: f.search,
    model: f.model,
    state: f.state,
    serial: f.serial,
    from: f.from,
    to: f.to,
    itemType: f.itemType,
  });
}

export async function fetchOpenInstallationBreakdown(
  conn,
  filters,
  { overdueDelayedOnly = false } = {},
) {
  const cacheKey = openInstallationKpiCacheKey(filters, overdueDelayedOnly);
  const cached = OPEN_INSTALLATION_KPI_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < OPEN_INSTALLATION_KPI_TTL_MS) {
    return cached.data;
  }

  const inner = buildOpenInstallationInnerQuery(filters, { forList: false });
  const listFilter = buildUpcomingInstallationListFilterSql(filters, {
    omitOpenInstallationBucket: true,
  });
  const extraSql = overdueDelayedOnly ? upcomingOverdueDelayedExtraSql() : "";
  const [[row]] = await conn.execute(
    openInstallationBreakdownAggregateSql(inner, listFilter, extraSql),
    listFilter.params,
  );
  const data = parseOpenInstallationBreakdownRow(row);
  OPEN_INSTALLATION_KPI_CACHE.set(cacheKey, { at: Date.now(), data });
  return data;
}

async function fetchUpcomingInstallationsPage(
  conn,
  filters,
  limit,
  skip,
  { overdueDelayedOnly = false, includeBreakdown = false } = {},
) {
  const parsed = parseSbiFilters(filters);
  const listInner = buildOpenInstallationInnerQuery(filters, { forList: true });
  const listFilter = buildUpcomingInstallationListFilterSql(filters);
  const extraSql = overdueDelayedOnly ? upcomingOverdueDelayedExtraSql() : "";
  const baseParams = [...listFilter.params];
  const hasBucket = Boolean(parsed.openInstallationBucket);

  const orderBy = overdueDelayedOnly ? "u.delivery_date ASC" : "u.days_until_installation ASC";

  const rowsPromise = conn.execute(
    `SELECT u.* FROM (${listInner}) u WHERE 1=1 ${listFilter.sql}${extraSql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...baseParams, limit, skip],
  );

  const breakdownPromise = includeBreakdown
    ? fetchOpenInstallationBreakdown(conn, filters, { overdueDelayedOnly })
    : Promise.resolve(null);

  // No KPI bucket → reuse breakdown.total for pagination (skip 2nd heavy COUNT).
  const countPromise =
    includeBreakdown && !hasBucket
      ? Promise.resolve(null)
      : conn.execute(
          `SELECT COUNT(*) AS cnt FROM (${buildOpenInstallationInnerQuery(filters, {
            forList: false,
          })}) u WHERE 1=1 ${listFilter.sql}${extraSql}`,
          baseParams,
        );

  const [rowsExec, openInstallationBreakdown, countExec] = await Promise.all([
    rowsPromise,
    breakdownPromise,
    countPromise,
  ]);

  const rows = rowsExec[0];
  const total =
    includeBreakdown && !hasBucket
      ? Number(openInstallationBreakdown?.total || 0)
      : Number(countExec?.[0]?.[0]?.cnt || 0);

  return {
    total,
    data: rows,
    openInstallationBreakdown: openInstallationBreakdown ?? undefined,
  };
}

export const NOT_INSTALLED_SQL = `(
  wp.installed_address IS NULL OR TRIM(wp.installed_address) = ''
)`;

export { INSTALLED_AFTER_REGISTERED_SQL, INSTALLATION_PENDING_AFTER_REGISTERED_SQL };

function wpTotalRegisteredAggregateSql(where) {
  return `SELECT
    COUNT(*) AS cnt,
    SUM(CASE WHEN ${INSTALLED_AFTER_REGISTERED_SQL} THEN 1 ELSE 0 END) AS installation_completed,
    SUM(CASE WHEN ${INSTALLATION_PENDING_AFTER_REGISTERED_SQL} THEN 1 ELSE 0 END) AS installation_pending
  FROM warranty_products wp ${where}`;
}

function parseTotalRegisteredAggregateRow(row) {
  return {
    total: Number(row?.cnt || 0),
    installation_completed: Number(row?.installation_completed || 0),
    installation_pending: Number(row?.installation_pending || 0),
  };
}

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

function serviceRecordFilterNeedsWpJoin(f) {
  return Boolean(f.search || f.model || f.serial || (f.state && !f.assignedTo));
}

export async function fetchServiceBeforeInstallationHubCounts(filters = {}) {
  const f = parseSbiFilters(filters);
  const cacheKey = JSON.stringify(f);
  const cached = HUB_COUNTS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < HUB_COUNTS_TTL_MS) {
    return cached.data;
  }

  const pool = await getDbConnection();
  const wpFilter = buildWpFilterSql(f);
  const srFilter = buildServiceRecordFilterSql(f, {
    dateExpr: "COALESCE(sr.planned_date, sr.complaint_date)",
  });
  const amcFilter = buildAmcFilterSql(f);
  const needsWp = serviceRecordFilterNeedsWpJoin(f);

  const wpSql = `SELECT
       COUNT(*) AS total_registered,
       SUM(CASE WHEN ${IN_WARRANTY_SQL} THEN 1 ELSE 0 END) AS active_warranty,
       SUM(CASE WHEN ${DUE_WARRANTY_EXPIRY_SQL} THEN 1 ELSE 0 END) AS due_warranty_expiry
     FROM warranty_products wp
     WHERE 1=1 ${wpFilter.sql}`;

  // Hub period filters rarely need warranty join — skipping TRIM serial join is a big win.
  const srSql = needsWp
    ? `SELECT COUNT(*) AS open_completions
       FROM service_records sr
       LEFT JOIN warranty_products wp
         ON ${sqlTrimUtf8EqColumns("sr.serial_number", "wp.serial_number")}
       WHERE ${PENDING_SERVICE_SQL}
         AND ${OPEN_COMPLAINTS_SQL}
         ${srFilter.sql}`
    : `SELECT COUNT(*) AS open_completions
       FROM service_records sr
       WHERE ${PENDING_SERVICE_SQL}
         AND ${OPEN_COMPLAINTS_SQL}
         ${srFilter.sql}`;

  const amcSql = `SELECT
       SUM(CASE WHEN ${ACTIVE_AMC_SQL} THEN 1 ELSE 0 END) AS active_amc,
       SUM(CASE WHEN ${DUE_AMC_SQL} THEN 1 ELSE 0 END) AS due_amc_expiring
     FROM amc_cmc
     WHERE 1=1 ${amcFilter.sql}`;

  const t0 = Date.now();
  const [wpResult, srResult, amcResult, upcomingTotals] = await Promise.all([
    pool.execute(wpSql, wpFilter.params),
    pool.execute(srSql, srFilter.params),
    pool.execute(amcSql, amcFilter.params),
    countUpcomingInstallationHubTotals(pool, f),
  ]);

  const wpRow = wpResult[0]?.[0];
  const srRow = srResult[0]?.[0];
  const amcRow = amcResult[0]?.[0];

  const data = {
    total_registered: Number(wpRow?.total_registered || 0),
    open_installation: upcomingTotals.open_installation,
    open_completions: Number(srRow?.open_completions || 0),
    overdue_delayed_installation: upcomingTotals.overdue_delayed_installation,
    active_warranty: Number(wpRow?.active_warranty || 0),
    due_warranty_expiry: Number(wpRow?.due_warranty_expiry || 0),
    active_amc: Number(amcRow?.active_amc || 0),
    due_amc_expiring: Number(amcRow?.due_amc_expiring || 0),
  };

  if (Date.now() - t0 > 800) {
    console.warn(`[sbi hub] counts ${Date.now() - t0}ms`);
  }

  HUB_COUNTS_CACHE.set(cacheKey, { at: Date.now(), data });
  return data;
}

export async function fetchServiceBeforeInstallationSegmentPage(segment, options = {}) {
  if (!isServiceBeforeInstallationSegment(segment)) {
    throw new Error("Invalid segment");
  }

  const filters = parseSbiFilters(options);
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
  const skip = Math.max(Number(options.skip) || 0, 0);
  const deferTotal = Boolean(options.deferTotal);

  const conn = await getDbConnection();
  const safeLimit = limit;
  const safeSkip = skip;

  if (segment === "open-installation") {
    const listFilters = parseSbiFilters(filters);
    const withProducts =
      listFilters.itemType === "" || listFilters.itemType === "all"
        ? { ...filters, itemType: "products" }
        : filters;
    if (options.breakdownOnly) {
      const openInstallationBreakdown = await fetchOpenInstallationBreakdown(conn, withProducts, {
        overdueDelayedOnly: false,
      });
      return {
        total: openInstallationBreakdown.total,
        data: [],
        openInstallationBreakdown,
      };
    }
    return fetchUpcomingInstallationsPage(conn, withProducts, safeLimit, safeSkip, {
      overdueDelayedOnly: false,
      includeBreakdown: options.includeOpenInstallationBreakdown !== false,
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
  const breakdownWpFilter =
    segment === "total-registered"
      ? buildWpFilterSql(filters, { omitRegisteredInstallation: true })
      : wpFilter;
  const where = `WHERE ${filterSql} ${wpFilter.sql}`;
  const breakdownWhere = `WHERE ${filterSql} ${breakdownWpFilter.sql}`;
  const baseParams = [...wpFilter.params];
  const breakdownParams = [...breakdownWpFilter.params];

  const fetchLimit = deferTotal ? safeLimit + 1 : safeLimit;

  const loadRows = async () => {
    let rows;
    if (segment === "total-registered") {
      const t0 = Date.now();
      rows = await fetchTotalRegisteredBasePage(conn, where, baseParams, fetchLimit, safeSkip);
      const tBase = Date.now();
      const pageRows = deferTotal ? rows.slice(0, safeLimit) : rows;
      await enrichTotalRegisteredRows(conn, pageRows);
      const tEnrich = Date.now();
      if (tEnrich - t0 > 800) {
        console.warn(
          `[sbi total-registered] base=${tBase - t0}ms enrich=${tEnrich - tBase}ms rows=${pageRows.length}`,
        );
      }
      return { rows: pageRows, hasExtra: deferTotal && rows.length > safeLimit };
    }
    rows = await fetchSimpleWarrantyProductPage(conn, where, baseParams, fetchLimit, safeSkip);
    const pageRows = deferTotal ? rows.slice(0, safeLimit) : rows;
    return { rows: pageRows, hasExtra: deferTotal && rows.length > safeLimit };
  };

  const runBreakdownAgg = async () => {
    if (segment !== "total-registered") return null;
    const [result] = await conn.execute(wpTotalRegisteredAggregateSql(breakdownWhere), breakdownParams);
    const agg = parseTotalRegisteredAggregateRow(result[0]);
    return {
      total_registered: agg.total,
      installation_pending: agg.installation_pending,
      installation_completed: agg.installation_completed,
    };
  };

  if (deferTotal) {
    const countPromise = conn.execute(`SELECT COUNT(*) AS cnt FROM warranty_products wp ${where}`, baseParams);
    const [{ rows, hasExtra }, countResult, installationBreakdown] = await Promise.all([
      loadRows(),
      countPromise,
      runBreakdownAgg(),
    ]);
    const countRow = countResult[0]?.[0];
    return {
      total: null,
      data: rows,
      hasMore: hasExtra,
      installationBreakdown: installationBreakdown ?? undefined,
      listTotal: Number(countRow?.cnt || 0),
    };
  }

  const [countResult, loaded, installationBreakdown] = await Promise.all([
    conn.execute(`SELECT COUNT(*) AS cnt FROM warranty_products wp ${where}`, baseParams),
    loadRows(),
    runBreakdownAgg(),
  ]);
  const countRow = countResult[0]?.[0];
  const listTotal = Number(countRow?.cnt || 0);

  return {
    total: listTotal,
    data: loaded.rows,
    hasMore: safeSkip + loaded.rows.length < listTotal,
    installationBreakdown: installationBreakdown ?? undefined,
  };
}

export async function countWarrantyProductsSegment(conn, segment, filters = {}) {
  let filterSql = "1=1";
  if (segment === "active-warranty") filterSql = IN_WARRANTY_SQL;
  else if (segment === "due-warranty-expiry") filterSql = DUE_WARRANTY_EXPIRY_SQL;
  else if (segment !== "total-registered") return 0;

  const wpFilter = buildWpFilterSql(filters);
  const where = `WHERE ${filterSql} ${wpFilter.sql}`;
  const [[row]] = await conn.execute(wpTotalRegisteredAggregateSql(where), [...wpFilter.params]);
  return parseTotalRegisteredAggregateRow(row).total;
}

function wpSegmentBaseFilterSql(segment) {
  if (segment === "total-registered") return "1=1";
  if (segment === "active-warranty") return IN_WARRANTY_SQL;
  if (segment === "due-warranty-expiry") return DUE_WARRANTY_EXPIRY_SQL;
  return null;
}

const INSTALLATION_SR_ASSIGNED_OK = `UPPER(TRIM(COALESCE(sr.assigned_to, ''))) NOT IN ('', 'NOT ASSIGNED', 'UNASSIGNED')`;

const WP_FILTER_OPTIONS_CACHE = new Map();
const WP_FILTER_OPTIONS_TTL_MS = 2 * 60 * 1000;
const WP_FILTER_OPTIONS_NAME_LIMIT = 250;

/** Distinct sales / engineer names for warranty-product segments (JOIN-based, not per-row subqueries). */
export async function fetchServiceBeforeInstallationWpFilterOptions(segment, filters = {}) {
  const base = wpSegmentBaseFilterSql(segment);
  if (!base) return null;

  const cacheKey = JSON.stringify({ segment, f: parseSbiFilters(filters) });
  const cached = WP_FILTER_OPTIONS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < WP_FILTER_OPTIONS_TTL_MS) {
    return cached.data;
  }

  const conn = await getDbConnection();
  const wpFilter = buildWpFilterSql(filters, { omitTeamFilters: true });
  const wpWhere = `${base} ${wpFilter.sql}`;
  const baseParams = [...wpFilter.params];

  const salesSql = `
    SELECT DISTINCT sales_name AS name
    FROM (
      SELECT ${sqlUtf8TrimExpr("wp.created_by")} AS sales_name
      FROM warranty_products wp
      WHERE ${wpWhere}
      UNION
      SELECT ${sqlUtf8TrimExpr("no.created_by")} AS sales_name
      FROM warranty_products wp
      INNER JOIN dispatch d ON ${sqlTrimUtf8EqColumns("d.serial_no", "wp.serial_number")}
      INNER JOIN neworder no ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
      WHERE ${wpWhere} AND ${sqlUtf8HasText("no.created_by")}
      UNION
      SELECT ${sqlUtf8TrimExpr("no.created_by")} AS sales_name
      FROM warranty_products wp
      INNER JOIN neworder no ON ${sqlTrimUtf8EqColumns("no.invoice_number", "wp.invoice_number")}
      WHERE ${wpWhere}
        AND ${sqlUtf8HasText("wp.invoice_number")}
        AND ${sqlUtf8HasText("no.created_by")}
    ) AS sales_union
    WHERE CHAR_LENGTH(sales_name) > 0
    ORDER BY name ASC
    LIMIT ${WP_FILTER_OPTIONS_NAME_LIMIT}`;

  const salesParams = [...baseParams, ...baseParams, ...baseParams];

  async function distinctRankedInstallationEngineers(engineerKind) {
    const typeSql =
      engineerKind === "third_party"
        ? `AND LOWER(TRIM(COALESCE(sr.assigned_to_type, ''))) = 'third_party'`
        : `AND LOWER(TRIM(COALESCE(sr.assigned_to_type, 'internal'))) <> 'third_party'`;

    const [rows] = await conn.execute(
      `SELECT DISTINCT ${sqlUtf8TrimExpr("assigned_to")} AS name
       FROM (
         SELECT sr.assigned_to,
           ROW_NUMBER() OVER (
             PARTITION BY wp.id
             ORDER BY
               CASE
                 WHEN UPPER(TRIM(COALESCE(sr.status, ''))) IN ('COMPLETED', 'WORKED') THEN 0
                 ELSE 1
               END,
               sr.service_id DESC
           ) AS rn
         FROM warranty_products wp
         INNER JOIN service_records sr
           ON ${sqlTrimUtf8EqColumns("sr.serial_number", "wp.serial_number")}
         WHERE ${wpWhere}
           AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
           AND ${INSTALLATION_SR_ASSIGNED_OK}
           ${typeSql}
       ) ranked
       WHERE rn = 1 AND ${sqlUtf8HasText("assigned_to")}
       ORDER BY name ASC
       LIMIT ${WP_FILTER_OPTIONS_NAME_LIMIT}`,
      baseParams,
    );
    return rows.map((r) => String(r.name || "").trim()).filter(Boolean);
  }

  const [salesRows, serviceEngineers, thirdPartyEngineers] = await Promise.all([
    conn.execute(salesSql, salesParams).then(([rows]) => rows),
    distinctRankedInstallationEngineers("internal"),
    distinctRankedInstallationEngineers("third_party"),
  ]);

  const salesPersons = salesRows.map((r) => String(r.name || "").trim()).filter(Boolean);

  const data = { salesPersons, serviceEngineers, thirdPartyEngineers };
  WP_FILTER_OPTIONS_CACHE.set(cacheKey, { at: Date.now(), data });
  return data;
}

const OPEN_FILTER_OPTIONS_CACHE = new Map();
const OPEN_FILTER_OPTIONS_TTL_MS = 2 * 60 * 1000;
const OPEN_FILTER_OPTIONS_NAME_LIMIT = 250;

async function fetchOpenInstallationFilterOptions(conn, filters = {}) {
  const parsed = parseSbiFilters(filters);
  const withProducts =
    parsed.itemType === "" || parsed.itemType === "all"
      ? { ...filters, itemType: "products" }
      : filters;
  const inner = buildOpenInstallationInnerQuery(withProducts, { forList: true });
  const listFilter = buildUpcomingInstallationListFilterSql(withProducts, {
    omitOpenInstallationBucket: true,
    omitTeamFilters: true,
  });
  const where = `WHERE 1=1 ${listFilter.sql}`;
  const params = listFilter.params;
  const limit = OPEN_FILTER_OPTIONS_NAME_LIMIT;

  const distinctSql = (column) =>
    `SELECT DISTINCT ${sqlUtf8TrimExpr(column)} AS name
     FROM (${inner}) u
     ${where}
       AND ${sqlUtf8HasText(column)}
     ORDER BY name ASC
     LIMIT ${limit}`;

  const [salesRows, serviceEngineers, thirdPartyEngineers] = await Promise.all([
    conn.execute(distinctSql("u.order_sales_person"), params).then(([rows]) => rows),
    conn.execute(distinctSql("u.service_engineer"), params).then(([rows]) => rows),
    conn.execute(distinctSql("u.third_party_engineer"), params).then(([rows]) => rows),
  ]);

  return {
    salesPersons: salesRows.map((r) => String(r.name || "").trim()).filter(Boolean),
    serviceEngineers: serviceEngineers.map((r) => String(r.name || "").trim()).filter(Boolean),
    thirdPartyEngineers: thirdPartyEngineers
      .map((r) => String(r.name || "").trim())
      .filter(Boolean),
  };
}

/** Distinct sales / engineer names for open-installation list filters. */
export async function fetchServiceBeforeInstallationSegmentFilterOptions(segment, filters = {}) {
  if (segment === "total-registered" || segment === "active-warranty" || segment === "due-warranty-expiry") {
    return fetchServiceBeforeInstallationWpFilterOptions(segment, filters);
  }
  if (segment !== "open-installation" && segment !== "overdue-delayed-installation") {
    return null;
  }

  const cacheKey = JSON.stringify({ segment, f: parseSbiFilters(filters) });
  const cached = OPEN_FILTER_OPTIONS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < OPEN_FILTER_OPTIONS_TTL_MS) {
    return cached.data;
  }

  const conn = await getDbConnection();
  const data = await fetchOpenInstallationFilterOptions(conn, filters);
  OPEN_FILTER_OPTIONS_CACHE.set(cacheKey, { at: Date.now(), data });
  return data;
}