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
  upcomingInstallationQuoteKeyParams,
} from "@/lib/upcomingInstallationsQuery";
import { buildNeworderOpenInstallationBucketWhereSql } from "@/lib/openInstallationBucketNeworderSql";
import { buildOpenCompletionsBucketWhereSql } from "@/lib/openCompletionsBucketSql";
import { activeWarrantyBucketBaseSql } from "@/lib/activeWarrantyBucketSql";
import {
  ACTIVE_AMC_SQL,
  AMC_EXPIRING_30_DAYS_SQL,
  activeAmcBucketBaseSql,
  DUE_AMC_SQL,
  EXPIRED_AMC_SQL,
} from "@/lib/activeAmcSql";
import { ensureServiceReportStepsTable } from "@/lib/ensureServiceReportStepsTable";
import {
  dispatchSerialEligibleForInstallation,
  pendingNeworderPredicates,
} from "@/lib/upcomingInstallationOrderEligibility";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import {
  forceOpenInstallationProductsOnly,
  normalizeOpenCompletionsBucket,
  parseSbiFilters,
  sbiFiltersForOpenInstallationKpi,
} from "@/lib/serviceBeforeInstallationFilters";
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
  U_INSTALLATION_PLANNED_SQL,
  U_NO_FEEDBACK_COLLECTED_SQL,
  NO_DELIVERY_PENDING_AFTER_DISPATCH_SQL,
  NO_INSTALLATION_PLANNED_SQL,
  NO_TEMP_DISPATCH_SERIAL_SQL,
  SQL_SERVICE_RECORD_INSTALLATION_PLANNED,
  sqlDispatchSerialIsTemp,
  openInstallationBucketRecordCount,
} from "@/lib/openInstallationKpiSql";
import {
  INSTALLED_AFTER_REGISTERED_SQL,
  INSTALLATION_PENDING_AFTER_REGISTERED_SQL,
} from "@/lib/serviceBeforeInstallationWpExpressions";
import { enrichOpenInstallationRowsWithServices } from "@/lib/openInstallationServiceEnrich";
import { mergeOpenInstallationParallelEnrichment } from "@/lib/openInstallationListEnrich";

function upcomingOverdueDelayedExtraSql() {
  return ` AND u.delivery_date < DATE_SUB(CURDATE(), INTERVAL ${OVERDUE_DELAYED_INSTALLATION_DAYS} DAY)`;
}

/** Pending installation orders with delivery date older than this many days. */
export const OVERDUE_DELAYED_INSTALLATION_DAYS = 2;

const HUB_COUNTS_CACHE = new Map();
const HUB_COUNTS_TTL_MS = 45_000;
const OPEN_INSTALLATION_KPI_CACHE = new Map();
const OPEN_INSTALLATION_KPI_INFLIGHT = new Map();
const OPEN_INSTALLATION_KPI_TTL_MS = 90_000;
/** Bump when count semantics change so stale under-counts (e.g. forced products) are dropped. */
const OPEN_INSTALLATION_KPI_CACHE_VER = "v15-dispatched-only";

const DELIVERED_ON_SQL = `(
  no.delivered_on IS NOT NULL
  AND TRIM(CAST(no.delivered_on AS CHAR)) NOT IN ('', '0000-00-00', '0000-00-00 00:00:00')
  AND no.delivered_on > '1970-01-01'
)`;

function openInstallationNeedsFullListShape(filters) {
  const f = parseSbiFilters(filters);
  return Boolean(
    f.serviceEngineer ||
      f.thirdPartyEngineer ||
      f.orderDeliveryStatus ||
      f.assignedBy ||
      f.registeredBy ||
      f.serviceStatus,
  );
}

/** Search / reg status / model etc. apply on neworder fast path via appendOpenInstallationNeworderExtraFilters. */
function openInstallationKpiNeedsFullBreakdown(filters) {
  return openInstallationNeedsFullListShape(filters);
}

function sqlQuoteHasAnyWarrantyRegistration(quoteNoColumn) {
  return `EXISTS (
    SELECT 1
    FROM dispatch d_wr
    INNER JOIN warranty_products wp_wr
      ON ${sqlTrimUtf8EqColumns("wp_wr.serial_number", "d_wr.serial_no")}
    WHERE ${sqlTrimUtf8EqColumns("d_wr.quote_number", quoteNoColumn)}
      AND d_wr.serial_no IS NOT NULL
      AND ${sqlUtf8HasText("d_wr.serial_no")}
  )`;
}

/** One-shot registered-quote set — same rule as table Registered badge (dispatch serial in warranty_products). */
function sqlOpenInstallationWarrantyJoin(warrantyRegistration) {
  if (warrantyRegistration !== "registered" && warrantyRegistration !== "not_registered") {
    return { joinSql: "", extraWhere: "" };
  }
  const sub = `(
    SELECT DISTINCT ${sqlUtf8TrimExpr("d_wr.quote_number")} AS quote_key
    FROM dispatch d_wr
    INNER JOIN warranty_products wp_wr
      ON ${sqlTrimUtf8EqColumns("wp_wr.serial_number", "d_wr.serial_no")}
    WHERE d_wr.quote_number IS NOT NULL
      AND ${sqlUtf8HasText("d_wr.quote_number")}
      AND d_wr.serial_no IS NOT NULL
      AND ${sqlUtf8HasText("d_wr.serial_no")}
  ) oi_wr`;
  const on = `oi_wr.quote_key = ${sqlUtf8TrimExpr("no.quote_number")}`;
  if (warrantyRegistration === "registered") {
    return { joinSql: `\n    INNER JOIN ${sub} ON ${on}`, extraWhere: "" };
  }
  return {
    joinSql: `\n    LEFT JOIN ${sub} ON ${on}`,
    extraWhere: ` AND oi_wr.quote_key IS NULL`,
  };
}

function sqlQuoteHasProductOnQuotation(quoteColumn) {
  return `EXISTS (
    SELECT 1
    FROM quotation_items qi_ds
    INNER JOIN products_list pl_ds
      ON ${sqlTrimUtf8EqColumns("pl_ds.item_code", "qi_ds.item_code")}
    WHERE ${sqlTrimUtf8EqColumns("qi_ds.quote_number", quoteColumn)}
  )`;
}

function sqlNeworderDispatchStatusWhere(dispatchStatus) {
  if (dispatchStatus === "not_completed") {
    return ` AND COALESCE(no.dispatch_status, 0) = 0`;
  }
  if (dispatchStatus === "completed") {
    return ` AND COALESCE(no.dispatch_status, 0) = 1`;
  }
  return "";
}

function sqlOpenInstallationQuotationProductsJoin() {
  return `INNER JOIN (
    SELECT DISTINCT ${sqlUtf8TrimExpr("qi.quote_number")} AS quote_key
    FROM quotation_items qi
    INNER JOIN products_list pl
      ON ${sqlTrimUtf8EqColumns("pl.item_code", "qi.item_code")}
    WHERE qi.quote_number IS NOT NULL
      AND ${sqlUtf8TrimExpr("qi.quote_number")} <> ''
  ) oi_qi_prod ON oi_qi_prod.quote_key = ${sqlUtf8TrimExpr("no.quote_number")}`;
}

function sqlOpenInstallationProductsJoin(dispatchStatus) {
  if (dispatchStatus === "completed") {
    return sqlOpenInstallationItemTypeJoin("products");
  }
  // All + not_completed: product quotes only (no dispatch row required; spare-only excluded).
  return sqlOpenInstallationQuotationProductsJoin();
}

/**
 * Open Installation list/KPI joins. Always products-only; dispatch All does not require a dispatch row.
 */
function openInstallationNeworderJoinPlan(filters) {
  const f = parseSbiFilters(forceOpenInstallationProductsOnly(filters));
  let joinSql = "";
  let extraWhere = sqlNeworderDispatchStatusWhere(f.dispatchStatus);
  const skipDispatchStatus = Boolean(extraWhere);
  const prodJoin = sqlOpenInstallationProductsJoin(f.dispatchStatus);
  if (prodJoin) joinSql += `\n    ${prodJoin}`;
  const wr = sqlOpenInstallationWarrantyJoin(f.warrantyRegistration);
  if (wr.joinSql) joinSql += wr.joinSql;
  if (wr.extraWhere) extraWhere += wr.extraWhere;

  return {
    joinSql,
    extraWhere,
    skipItemType: Boolean(prodJoin),
    skipDispatchStatus,
    skipWarrantyRegistration: Boolean(wr.joinSql),
  };
}

/** One-shot product/spare quote set — avoids correlated EXISTS per neworder row. */
function sqlOpenInstallationItemTypeJoin(itemType, alias = "oi_item_q") {
  const type = resolveUpcomingInstallationType(itemType);
  if (type === "products") {
    return `INNER JOIN (
      SELECT DISTINCT ${sqlUtf8TrimExpr("d_it.quote_number")} AS quote_key
      FROM dispatch d_it
      INNER JOIN products_list pl
        ON ${sqlTrimUtf8EqColumns("pl.item_code", "d_it.item_code")}
      WHERE d_it.quote_number IS NOT NULL
        AND ${sqlUtf8TrimExpr("d_it.quote_number")} <> ''
    ) ${alias} ON ${alias}.quote_key = ${sqlUtf8TrimExpr("no.quote_number")}`;
  }
  if (type === "spares") {
    return `INNER JOIN (
      SELECT DISTINCT ${sqlUtf8TrimExpr("d_it.quote_number")} AS quote_key
      FROM dispatch d_it
      INNER JOIN spare_list sl
        ON ${sqlTrimUtf8EqColumns("sl.spare_number", "d_it.item_code")}
      WHERE d_it.quote_number IS NOT NULL
        AND ${sqlUtf8TrimExpr("d_it.quote_number")} <> ''
    ) ${alias} ON ${alias}.quote_key = ${sqlUtf8TrimExpr("no.quote_number")}`;
  }
  return "";
}

function appendOpenInstallationNeworderExtraFilters(
  filters,
  sql,
  params,
  {
    overdueDelayedOnly = false,
    skipItemType = false,
    skipDispatchStatus = false,
    skipWarrantyRegistration = false,
  } = {},
) {
  const f = parseSbiFilters(filters);

  if (overdueDelayedOnly) {
    sql += ` AND no.delivery_date < DATE_SUB(CURDATE(), INTERVAL ${OVERDUE_DELAYED_INSTALLATION_DAYS} DAY)`;
  }
  if (f.from) {
    sql += ` AND DATE(no.delivery_date) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    sql += ` AND DATE(no.delivery_date) <= ?`;
    params.push(f.to);
  }
  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      no.order_id LIKE ? OR no.quote_number LIKE ? OR no.company_name LIKE ?
      OR no.contact LIKE ? OR no.invoice_number LIKE ? OR no.delivery_location LIKE ?
      OR no.state LIKE ? OR no.created_by LIKE ?
      OR EXISTS (
        SELECT 1
        FROM dispatch d_srch
        INNER JOIN service_records sr_srch
          ON ${sqlTrimUtf8EqColumns("sr_srch.serial_number", "d_srch.serial_no")}
        WHERE ${sqlTrimUtf8EqColumns("d_srch.quote_number", "no.quote_number")}
          AND UPPER(TRIM(COALESCE(sr_srch.service_type, ''))) = 'INSTALLATION'
          AND CAST(sr_srch.service_id AS CHAR) LIKE ?
      )
    )`;
    params.push(...Array(8).fill(term), term);
  }
  if (f.state) {
    sql += ` AND no.state LIKE ?`;
    params.push(`%${f.state}%`);
  }
  if (f.serial) {
    sql += ` AND (no.invoice_number LIKE ? OR no.order_id LIKE ? OR no.quote_number LIKE ?)`;
    params.push(`%${f.serial}%`, `%${f.serial}%`, `%${f.serial}%`);
  }
  if (f.salesPerson) {
    sql += ` AND TRIM(no.created_by) = TRIM(?)`;
    params.push(f.salesPerson);
  }
  if (f.model) {
    sql += ` AND EXISTS (
      SELECT 1
      FROM dispatch d_m
      WHERE ${sqlTrimUtf8EqColumns("d_m.quote_number", "no.quote_number")}
        AND d_m.item_code LIKE ?
    )`;
    params.push(`%${f.model}%`);
  }
  if (!skipDispatchStatus) {
    sql += sqlNeworderDispatchStatusWhere(f.dispatchStatus);
  }

  const itemType = resolveUpcomingInstallationType(f.itemType);
  if (!skipItemType && itemType === "products") {
    if (f.dispatchStatus === "completed") {
      sql += ` AND EXISTS (
      SELECT 1
      FROM dispatch d_it
      INNER JOIN products_list pl
        ON ${sqlTrimUtf8EqColumns("pl.item_code", "d_it.item_code")}
      WHERE ${sqlTrimUtf8EqColumns("d_it.quote_number", "no.quote_number")}
    )`;
    } else {
      sql += ` AND ${sqlQuoteHasProductOnQuotation("no.quote_number")}`;
    }
  } else if (!skipItemType && itemType === "spares") {
    sql += ` AND EXISTS (
      SELECT 1
      FROM dispatch d_it
      INNER JOIN spare_list sl
        ON ${sqlTrimUtf8EqColumns("sl.spare_number", "d_it.item_code")}
      WHERE ${sqlTrimUtf8EqColumns("d_it.quote_number", "no.quote_number")}
    )`;
  }
  if (!skipWarrantyRegistration) {
    if (f.warrantyRegistration === "registered") {
      sql += ` AND ${sqlQuoteHasAnyWarrantyRegistration("no.quote_number")}`;
    } else if (f.warrantyRegistration === "not_registered") {
      sql += ` AND NOT ${sqlQuoteHasAnyWarrantyRegistration("no.quote_number")}`;
    }
  }
  if (f.assignedBy) {
    sql += ` AND ${sqlOpenInstallationQuoteLatestRegisteredByEquals("no.quote_number")}`;
    params.push(f.assignedBy);
  }
  if (f.registeredBy) {
    sql += ` AND ${sqlOpenInstallationQuoteLatestRegisteredByEquals("no.quote_number")}`;
    params.push(f.registeredBy);
  }
  return { sql, params };
}

function openInstallationNeedsInstalledOrders(bucket) {
  const b = String(bucket || "").trim().toLowerCase();
  return (
    b === "completed" ||
    b === "feedback_collected" ||
    b === "no_feedback" ||
    b === "installation_planned"
  );
}

function buildOpenInstallationInnerQuery(
  filters,
  { forList = false, quoteKeys = null } = {},
) {
  const parsed = parseSbiFilters(filters);
  const type = resolveUpcomingInstallationType(parsed.itemType);
  const bucket = parsed.openInstallationBucket;
  // Default open list = pending only. Installed orders only for completed / no-feedback buckets
  // (and KPI breakdown always includes them via includeInstalledOrders below).
  const includeInstalledOrders = forList
    ? openInstallationNeedsInstalledOrders(bucket)
    : true;
  const shared = {
    type,
    registration: null,
    includeInstalledOrders,
    openInstallationBucket: bucket,
    // Skip order_delivery_batches correlated subquery — main win on ~1k orders.
    lite: true,
  };
  if (forList) {
    return buildUpcomingInstallationsQuery({
      ...shared,
      includeQuoteTotals: false,
      includeServiceDetails: false,
      includeInnerOrderBy: false,
      quoteKeys,
    });
  }
  if (openInstallationNeedsFullListShape(filters)) {
    return buildUpcomingInstallationsQuery({
      ...shared,
      includeQuoteTotals: false,
      includeServiceDetails: false,
      includeInnerOrderBy: false,
    });
  }
  return buildOpenInstallationKpiInnerQuery({
    ...shared,
    slim: true,
  });
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
    SUM(CASE WHEN COALESCE(u.order_installation_status, 0) = 0 THEN 1 ELSE 0 END) AS total,
    SUM(CASE WHEN ${U_DELIVERED_INSTALLATION_PENDING_SQL} THEN 1 ELSE 0 END) AS delivered_installation_pending,
    SUM(CASE WHEN ${U_DELIVERY_PENDING_AFTER_DISPATCH_SQL} THEN 1 ELSE 0 END) AS delivery_pending_after_dispatch,
    SUM(CASE WHEN ${U_INSTALLATION_PLANNED_SQL} THEN 1 ELSE 0 END) AS installation_planned,
    SUM(CASE WHEN ${U_INSTALLATION_COMPLETED_SQL} THEN 1 ELSE 0 END) AS completed_installation,
    SUM(CASE WHEN ${U_NO_FEEDBACK_COLLECTED_SQL} THEN 1 ELSE 0 END) AS no_feedback_collected
  FROM (${inner}) u WHERE 1=1 ${listFilter.sql}${extraSql}`;
}

function parseOpenInstallationBreakdownRow(row) {
  return {
    total: Number(row?.total || 0),
    delivered_installation_pending: Number(row?.delivered_installation_pending || 0),
    delivery_pending_after_dispatch: Number(row?.delivery_pending_after_dispatch || 0),
    installation_planned: Number(row?.installation_planned || 0),
    completed_installation: Number(row?.completed_installation || 0),
    no_feedback_collected: Number(row?.no_feedback_collected || 0),
    feedback_collected: Number(row?.feedback_collected || 0),
  };
}

function openInstallationKpiCacheKey(filters, overdueDelayedOnly) {
  const f = parseSbiFilters(filters);
  // Bucket is omitted — breakdown always covers all four cards.
  return JSON.stringify({
    v: OPEN_INSTALLATION_KPI_CACHE_VER,
    overdueDelayedOnly: Boolean(overdueDelayedOnly),
    search: f.search,
    model: f.model,
    state: f.state,
    serial: f.serial,
    from: f.from,
    to: f.to,
    itemType: f.itemType,
    serviceStatus: f.serviceStatus,
    warrantyRegistration: f.warrantyRegistration,
    orderDeliveryStatus: f.orderDeliveryStatus,
    dispatchStatus: f.dispatchStatus,
    salesPerson: f.salesPerson,
    serviceEngineer: f.serviceEngineer,
    thirdPartyEngineer: f.thirdPartyEngineer,
    instCompletedBy: f.instCompletedBy,
    assignedBy: f.assignedBy,
    registeredBy: f.registeredBy,
  });
}

/**
 * Fast KPI from neworder only (no products_list / heavy eligibility).
 * Delivery-pending uses the same dedicated counter as the list.
 */
async function fetchOpenInstallationBreakdownLite(
  conn,
  filters,
  { overdueDelayedOnly = false, deferInstallationPlanned = false } = {},
) {
  const kpiFilters = sbiFiltersForOpenInstallationKpi(filters);
  const f = parseSbiFilters(kpiFilters);

  let filterSql = `
    (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
    AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
  `;
  const params = [];
  if (f.instCompletedBy) {
    const quoteKeys = await resolveInstCompletedByQuoteKeys(conn, f.instCompletedBy);
    if (!quoteKeys.length) {
      return parseOpenInstallationBreakdownRow(null);
    }
    filterSql += ` AND ${sqlUtf8TrimExpr("no.quote_number")} IN (${quoteKeys.map(() => "?").join(",")})`;
    params.push(...quoteKeys);
  }

  const plan = openInstallationNeworderJoinPlan(kpiFilters);
  const merged = appendOpenInstallationNeworderExtraFilters(kpiFilters, filterSql, params, {
    overdueDelayedOnly,
    skipItemType: plan.skipItemType,
    skipWarrantyRegistration: plan.skipWarrantyRegistration,
    skipDispatchStatus: plan.skipDispatchStatus,
  });
  const baseOrderSql = `${merged.sql}${plan.extraWhere}`;

  const deliveredOnSql = DELIVERED_ON_SQL;

  const sumSql = `SELECT
       SUM(
         CASE
           WHEN COALESCE(no.installation_status, 0) = 0 AND no.delivery_date IS NOT NULL
           THEN 1 ELSE 0
         END
       ) AS total,
       SUM(
         CASE
           WHEN COALESCE(no.installation_status, 0) = 0
            AND ${deliveredOnSql}
            AND ${NO_TEMP_DISPATCH_SERIAL_SQL}
           THEN 1 ELSE 0
         END
       ) AS delivered_installation_pending,
       SUM(CASE WHEN ${NO_DELIVERY_PENDING_AFTER_DISPATCH_SQL} THEN 1 ELSE 0 END) AS delivery_pending_after_dispatch,
       0 AS installation_planned,
       SUM(CASE WHEN COALESCE(no.installation_status, 0) = 1 THEN 1 ELSE 0 END) AS completed_installation,
       0 AS no_feedback_collected,
       0 AS feedback_collected
     FROM neworder no
     ${plan.joinSql}
     WHERE ${baseOrderSql}`;

  const [sumRows] = await conn.execute(sumSql, merged.params);
  const row = sumRows?.[0] || null;

  const data = parseOpenInstallationBreakdownRow(row);
  if (!deferInstallationPlanned) {
    data.installation_planned = await countInstallationPlannedServiceRecords(conn, kpiFilters);
  }
  return data;
}

/** One lite scan for 3 neworder cards — coalesces parallel KPI HTTP requests onto one query. */
async function loadOpenInstallationLiteBreakdown(filters, { overdueDelayedOnly = false } = {}) {
  const kpiFilters = sbiFiltersForOpenInstallationKpi(
    withDefaultOpenInstallationItemType(filters),
  );
  const cacheKey = openInstallationKpiCacheKey(kpiFilters, overdueDelayedOnly);
  const cached = OPEN_INSTALLATION_KPI_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < OPEN_INSTALLATION_KPI_TTL_MS) {
    return cached.data;
  }
  const inflightKey = `${cacheKey}|lite`;
  const existing = OPEN_INSTALLATION_KPI_INFLIGHT.get(inflightKey);
  if (existing) return existing;

  const promise = (async () => {
    const conn = await getDbConnection();
    const data = await fetchOpenInstallationBreakdownLite(conn, kpiFilters, {
      overdueDelayedOnly,
      deferInstallationPlanned: true,
    });
    const allZero =
      !data.total &&
      !data.delivered_installation_pending &&
      !data.delivery_pending_after_dispatch &&
      !data.completed_installation;
    if (!allZero) {
      OPEN_INSTALLATION_KPI_CACHE.set(cacheKey, { at: Date.now(), data });
    }
    return data;
  })().finally(() => {
    OPEN_INSTALLATION_KPI_INFLIGHT.delete(inflightKey);
  });

  OPEN_INSTALLATION_KPI_INFLIGHT.set(inflightKey, promise);
  return promise;
}

export async function countOpenInstallationPlannedKpi(filters = {}) {
  const conn = await getDbConnection();
  return countInstallationPlannedServiceRecords(conn, filters);
}

export async function fetchOpenInstallationBreakdown(
  conn,
  filters,
  { overdueDelayedOnly = false, deferInstallationPlanned = false, skipCache = false } = {},
) {
  const kpiFilters = sbiFiltersForOpenInstallationKpi(filters);
  const cacheKey = openInstallationKpiCacheKey(kpiFilters, overdueDelayedOnly);
  const cached = OPEN_INSTALLATION_KPI_CACHE.get(cacheKey);
  if (!skipCache && cached && Date.now() - cached.at < OPEN_INSTALLATION_KPI_TTL_MS) {
    return cached.data;
  }

  let data;
  if (
    !openInstallationKpiNeedsFullBreakdown(kpiFilters) &&
    !parseSbiFilters(kpiFilters).serviceStatus
  ) {
    data = await fetchOpenInstallationBreakdownLite(conn, kpiFilters, {
      overdueDelayedOnly,
      deferInstallationPlanned,
    });
  } else {
    const inner = buildOpenInstallationInnerQuery(kpiFilters, { forList: false });
    const listFilter = buildUpcomingInstallationListFilterSql(kpiFilters, {
      omitOpenInstallationBucket: true,
    });
    const extraSql = overdueDelayedOnly ? upcomingOverdueDelayedExtraSql() : "";
    const [[row]] = await conn.execute(
      openInstallationBreakdownAggregateSql(inner, listFilter, extraSql),
      listFilter.params,
    );
    data = parseOpenInstallationBreakdownRow(row);
  }
  if (!deferInstallationPlanned) {
    data.installation_planned = await countInstallationPlannedServiceRecords(conn, kpiFilters);
  }
  const allZero =
    !data.total &&
    !data.delivered_installation_pending &&
    !data.delivery_pending_after_dispatch &&
    !data.installation_planned &&
    !data.completed_installation;
  // Cache even when planned is deferred — cards must hit cache on repeat loads.
  if (!skipCache && !allZero) {
    OPEN_INSTALLATION_KPI_CACHE.set(cacheKey, { at: Date.now(), data });
  }
  return data;
}

/**
 * Quotes where this user appears as installation assignee / completed-by / report engineer.
 * Start from service_records (selective) — avoids full open-installation join for table load.
 */
/** Quote numbers for orders tied to PLANNED INSTALLATION SRs (view_service_reports parity). */
async function resolveInstallationPlannedQuoteKeys(conn, filters = {}) {
  const f = parseSbiFilters(filters);
  let dateSql = "";
  const dateParams = [];
  if (f.from) {
    dateSql += ` AND DATE(COALESCE(sr.planned_date, sr.complaint_date)) >= ?`;
    dateParams.push(f.from);
  }
  if (f.to) {
    dateSql += ` AND DATE(COALESCE(sr.planned_date, sr.complaint_date)) <= ?`;
    dateParams.push(f.to);
  }

  const [rows] = await conn.execute(
    `SELECT DISTINCT quote_key
     FROM (
       SELECT ${sqlUtf8TrimExpr("d.quote_number")} AS quote_key
       FROM service_records sr
       INNER JOIN dispatch d
         ON ${sqlTrimUtf8EqColumns("d.serial_no", "sr.serial_number")}
       WHERE ${SQL_SERVICE_RECORD_INSTALLATION_PLANNED}
         AND d.quote_number IS NOT NULL
         AND ${sqlUtf8TrimExpr("d.quote_number")} <> ''
         ${dateSql}
       UNION
       SELECT ${sqlUtf8TrimExpr("d2.quote_number")} AS quote_key
       FROM service_records sr
       INNER JOIN warranty_products wp
         ON ${sqlTrimUtf8EqColumns("wp.serial_number", "sr.serial_number")}
       INNER JOIN dispatch d2
         ON ${sqlTrimUtf8EqColumns("d2.serial_no", "wp.serial_number")}
       WHERE ${SQL_SERVICE_RECORD_INSTALLATION_PLANNED}
         AND d2.quote_number IS NOT NULL
         AND ${sqlUtf8TrimExpr("d2.quote_number")} <> ''
         ${dateSql}
     ) planned_quotes
     WHERE quote_key IS NOT NULL AND quote_key <> ''
     LIMIT 5000`,
    [...dateParams, ...dateParams],
  );

  return [...new Set((rows || []).map((r) => String(r.quote_key || "").trim()).filter(Boolean))];
}

/** Row count on view_service_reports when Status = PLANNED (INSTALLATION only). */
async function countInstallationPlannedServiceRecords(conn, filters = {}) {
  const kpiFilters = sbiFiltersForOpenInstallationKpi(filters);
  const f = parseSbiFilters(kpiFilters);
  let dateSql = "";
  const dateParams = [];
  if (f.from) {
    dateSql += ` AND DATE(COALESCE(sr.planned_date, sr.complaint_date)) >= ?`;
    dateParams.push(f.from);
  }
  if (f.to) {
    dateSql += ` AND DATE(COALESCE(sr.planned_date, sr.complaint_date)) <= ?`;
    dateParams.push(f.to);
  }

  let noSql = `
    (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
    AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
  `;
  const noParams = [];
  if (f.instCompletedBy) {
    const quoteKeys = await resolveInstCompletedByQuoteKeys(conn, f.instCompletedBy);
    if (!quoteKeys.length) return 0;
    noSql += ` AND ${sqlUtf8TrimExpr("no.quote_number")} IN (${quoteKeys.map(() => "?").join(",")})`;
    noParams.push(...quoteKeys);
  }
  const itemJoin =
    f.dispatchStatus === "not_completed"
      ? ""
      : sqlOpenInstallationItemTypeJoin(f.itemType);
  const wr = sqlOpenInstallationWarrantyJoin(f.warrantyRegistration);
  const mergedNo = appendOpenInstallationNeworderExtraFilters(kpiFilters, noSql, noParams, {
    skipItemType: Boolean(itemJoin),
    skipWarrantyRegistration: Boolean(wr.joinSql),
  });

  const [[row]] = await conn.execute(
    `SELECT COUNT(DISTINCT sr.service_id) AS cnt
     FROM service_records sr
     INNER JOIN dispatch d
       ON ${sqlTrimUtf8EqColumns("d.serial_no", "sr.serial_number")}
     INNER JOIN neworder no
       ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
     ${itemJoin}
     ${wr.joinSql}
     WHERE ${SQL_SERVICE_RECORD_INSTALLATION_PLANNED}
       ${dateSql}
       AND ${mergedNo.sql}${wr.extraWhere}`,
    [...dateParams, ...mergedNo.params],
  );
  return Number(row?.cnt || 0);
}

async function resolveInstCompletedByQuoteKeys(conn, name) {
  const who = String(name || "").trim();
  if (!who) return [];

  const [rows] = await conn.execute(
    `SELECT DISTINCT ${sqlUtf8TrimExpr("d.quote_number")} AS quote_key
     FROM service_records sr
     INNER JOIN dispatch d
       ON ${sqlTrimUtf8EqColumns("d.serial_no", "sr.serial_number")}
     WHERE UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
       AND d.quote_number IS NOT NULL
       AND ${sqlUtf8TrimExpr("d.quote_number")} <> ''
       AND (
         TRIM(COALESCE(sr.assigned_to, '')) = TRIM(?)
         OR TRIM(COALESCE(sr.completed_by_service_engineer, '')) = TRIM(?)
         OR EXISTS (
           SELECT 1
           FROM installation_reports ir
           WHERE ir.service_id = sr.service_id
             AND TRIM(COALESCE(ir.authorized_person_name, '')) = TRIM(?)
         )
       )
     LIMIT 5000`,
    [who, who, who],
  );

  return [...new Set((rows || []).map((r) => String(r.quote_key || "").trim()).filter(Boolean))];
}

function appendNeworderQuoteKeyInSql(whereSql, whereParams, quoteKeys) {
  if (!quoteKeys?.length) {
    return { sql: `${whereSql} AND 1=0`, params: whereParams };
  }
  const placeholders = quoteKeys.map(() => "?").join(",");
  return {
    sql: `${whereSql} AND ${sqlUtf8TrimExpr("no.quote_number")} IN (${placeholders})`,
    params: [...whereParams, ...quoteKeys],
  };
}

async function buildOpenInstallationNeworderWhereWithQuotePrefilters(
  conn,
  filters,
  {
    overdueDelayedOnly = false,
    skipItemType = false,
    skipDispatchStatus = false,
    skipWarrantyRegistration = false,
  } = {},
) {
  const parsed = parseSbiFilters(filters);
  const base = buildOpenInstallationNeworderWhereSql(filters, {
    overdueDelayedOnly,
    skipItemType,
    skipDispatchStatus,
    skipWarrantyRegistration,
  });

  if (parsed.instCompletedBy) {
    const quoteKeys = await resolveInstCompletedByQuoteKeys(conn, parsed.instCompletedBy);
    return { ...appendNeworderQuoteKeyInSql(base.sql, base.params, quoteKeys), quoteKeys };
  }
  if (parsed.openInstallationBucket === "installation_planned") {
    const quoteKeys = await resolveInstallationPlannedQuoteKeys(conn, filters);
    return { ...appendNeworderQuoteKeyInSql(base.sql, base.params, quoteKeys), quoteKeys };
  }
  return { ...base, quoteKeys: null };
}

/** Same latest registration creator as list column u.registered_by / enrich GROUP_CONCAT. */
function sqlOpenInstallationQuoteLatestRegisteredByEquals(quoteNoColumn) {
  return `EXISTS (
    SELECT 1
    FROM dispatch d_reg
    LEFT JOIN warranty_products wp_reg
      ON ${sqlTrimUtf8EqColumns("wp_reg.serial_number", "d_reg.serial_no")}
    WHERE ${sqlTrimUtf8EqColumns("d_reg.quote_number", quoteNoColumn)}
      AND d_reg.serial_no IS NOT NULL
      AND ${sqlUtf8TrimExpr("d_reg.serial_no")} <> ''
    GROUP BY ${sqlUtf8TrimExpr("d_reg.quote_number")}
    HAVING TRIM(
      NULLIF(
        SUBSTRING_INDEX(
          SUBSTRING_INDEX(
            GROUP_CONCAT(
              CASE
                WHEN wp_reg.serial_number IS NOT NULL
                THEN CONCAT(
                  LPAD(wp_reg.id, 20, '0'),
                  '||',
                  DATE_FORMAT(COALESCE(wp_reg.created_at, wp_reg.invoice_date), '%Y-%m-%d'),
                  '||',
                  TRIM(COALESCE(wp_reg.created_by, ''))
                )
              END
              ORDER BY wp_reg.id DESC
              SEPARATOR ','
            ),
            ',',
            1
          ),
          '||',
          -1
        ),
        ''
      )
    ) = TRIM(?)
  )`;
}

/**
 * Open-installation bucket WHERE. Products join lives on the FROM clause (join plan).
 */
function buildOpenInstallationNeworderWhereSql(
  filters,
  {
    overdueDelayedOnly = false,
    skipItemType = false,
    skipDispatchStatus = false,
    skipWarrantyRegistration = false,
  } = {},
) {
  const f = parseSbiFilters(filters);
  const bucket = String(f.openInstallationBucket || "").trim().toLowerCase();

  let sql = `
    WHERE (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
      AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
  `;
  const params = [];

  if (bucket === "delivery_pending") {
    sql += ` AND ${NO_DELIVERY_PENDING_AFTER_DISPATCH_SQL}`;
  } else if (bucket === "delivered_pending") {
    sql += ` AND COALESCE(no.installation_status, 0) = 0 AND ${DELIVERED_ON_SQL} AND ${NO_TEMP_DISPATCH_SERIAL_SQL}`;
  } else if (bucket === "installation_planned") {
    // Quote keys from PLANNED INSTALLATION service_records (see buildOpenInstallationNeworderWhereWithQuotePrefilters).
  } else if (bucket === "completed") {
    sql += ` AND COALESCE(no.installation_status, 0) = 1`;
  } else {
    sql += ` AND COALESCE(no.installation_status, 0) = 0 AND no.delivery_date IS NOT NULL`;
  }

  return appendOpenInstallationNeworderExtraFilters(filters, sql, params, {
    overdueDelayedOnly,
    skipItemType,
    skipDispatchStatus,
    skipWarrantyRegistration,
  });
}

function buildDeliveryStatusPendingWhereSql(filters) {
  return buildOpenInstallationNeworderWhereSql({
    ...filters,
    openInstallationBucket: "delivery_pending",
  });
}

async function enrichOpenInstallationRowsWithDispatch(conn, rows) {
  if (!rows?.length) return rows || [];
  const quotes = [
    ...new Set(rows.map((r) => String(r.quote_number || "").trim()).filter(Boolean)),
  ];
  if (!quotes.length) return rows;

  const placeholders = quotes.map(() => "?").join(",");
  // Page quotes only (~10): dispatch + warranty_products for Registered badge.
  const [aggRows] = await conn.execute(
    `SELECT
       ${sqlUtf8TrimExpr("d.quote_number")} AS quote_key,
       GROUP_CONCAT(DISTINCT d.serial_no ORDER BY d.serial_no SEPARATOR ', ') AS serial_number,
       GROUP_CONCAT(DISTINCT d.item_code ORDER BY d.item_code SEPARATOR ', ') AS model,
       GROUP_CONCAT(DISTINCT d.item_name ORDER BY d.item_name SEPARATOR ', ') AS name,
       DATE_FORMAT(MAX(COALESCE(d.updated_at, d.created_at)), '%Y-%m-%d') AS dispatch_date,
       MAX(DATE_FORMAT(wp.installation_date, '%Y-%m-%d')) AS installed_date,
       MAX(CASE WHEN wp.serial_number IS NOT NULL THEN 1 ELSE 0 END) AS warranty_registered,
       NULLIF(
         SUBSTRING_INDEX(
           SUBSTRING_INDEX(
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
             ),
             '||',
             2
           ),
           '||',
           -1
         ),
         ''
       ) AS registered_at,
       NULLIF(
         SUBSTRING_INDEX(
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
           ),
           '||',
           -1
         ),
         ''
       ) AS registered_by
     FROM dispatch d
     INNER JOIN products_list pl_disp
       ON ${sqlTrimUtf8EqColumns("pl_disp.item_code", "d.item_code")}
     LEFT JOIN warranty_products wp
       ON ${sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no")}
     WHERE ${sqlUtf8TrimExpr("d.quote_number")} IN (${placeholders})
       AND d.serial_no IS NOT NULL
       AND ${sqlUtf8TrimExpr("d.serial_no")} <> ''
     GROUP BY ${sqlUtf8TrimExpr("d.quote_number")}`,
    quotes,
  );
  const byQuote = new Map(
    (aggRows || []).map((r) => [String(r.quote_key || "").trim().toLowerCase(), r]),
  );
  return rows.map((row) => {
    const hit = byQuote.get(String(row.quote_number || "").trim().toLowerCase());
    if (!hit) return row;
    const registered = Number(hit.warranty_registered) === 1;
    return {
      ...row,
      serial_number: hit.serial_number || row.serial_number || "",
      model: hit.model || row.model || "",
      name: hit.name || row.name || "",
      dispatch_date: hit.dispatch_date || row.dispatch_date || null,
      installed_date: hit.installed_date || row.installed_date || null,
      warranty_registered: registered ? 1 : 0,
      registered_at: registered ? hit.registered_at || null : null,
      registered_by: registered ? hit.registered_by || null : null,
    };
  });
}

const OPEN_INSTALLATION_LIST_SELECT = `
       no.id,
       no.order_id,
       no.quote_number,
       no.invoice_number,
       '' AS serial_number,
       NULL AS service_id,
       NULL AS service_details,
       '' AS model,
       '' AS name,
       no.delivery_location AS delivery_address,
       no.company_name,
       CASE
         WHEN ${sqlUtf8HasText("no.client_name")} THEN ${sqlUtf8TrimExpr("no.client_name")}
         ELSE NULL
       END AS contact_person,
       no.contact,
       no.state,
       no.created_by AS emp_name,
       no.created_by AS order_sales_person,
       NULL AS assigned_by,
       COALESCE(no.installation_status, 0) AS order_installation_status,
       COALESCE(no.dispatch_status, 0) AS order_dispatch_status,
       COALESCE(no.delivery_status, 0) AS order_delivery_status,
       DATE_FORMAT(NULLIF(no.delivery_date, '0000-00-00'), '%Y-%m-%d') AS delivery_date,
       DATE_FORMAT(NULLIF(no.delivered_on, '0000-00-00'), '%Y-%m-%d') AS delivered_on,
       0 AS pricing_total,
       0 AS total_qty,
       CASE
         WHEN no.delivery_date IS NULL OR no.delivery_date <= '1970-01-01' THEN 'scheduled'
         WHEN no.delivery_date < CURDATE() THEN 'overdue'
         WHEN no.delivery_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY) THEN 'upcoming'
         ELSE 'scheduled'
       END AS installation_status,
       CASE
         WHEN no.delivered_on IS NOT NULL AND no.delivered_on > '1970-01-01'
         THEN DATEDIFF(no.delivered_on, CURDATE())
         ELSE DATEDIFF(NULLIF(no.delivery_date, '0000-00-00'), CURDATE())
       END AS days_until_installation,
       0 AS warranty_registered,
       NULL AS registered_at,
       NULL AS registered_by,
       NULL AS dispatch_date,
       NULL AS service_engineer,
       NULL AS third_party_engineer,
       CASE WHEN COALESCE(no.installation_status, 0) = 1 THEN 1 ELSE 0 END AS installation_completed,
       0 AS no_feedback_collected`;

async function excludeOpenInstallationTempSerialRows(conn, rows) {
  if (!rows?.length) return rows || [];
  const quotes = [
    ...new Set(rows.map((r) => String(r.quote_number || "").trim()).filter(Boolean)),
  ];
  if (!quotes.length) return rows;
  const placeholders = quotes.map(() => "?").join(",");
  const [hits] = await conn.execute(
    `SELECT DISTINCT ${sqlUtf8TrimExpr("d.quote_number")} AS quote_key
     FROM dispatch d
     WHERE ${sqlUtf8TrimExpr("d.quote_number")} IN (${placeholders})
       AND d.serial_no IS NOT NULL
       AND ${sqlUtf8HasText("d.serial_no")}
       AND ${sqlDispatchSerialIsTemp("d.serial_no")}`,
    quotes,
  );
  if (!hits?.length) return rows;
  const hide = new Set(
    hits.map((r) => String(r.quote_key || "").trim().toLowerCase()).filter(Boolean),
  );
  return rows.filter(
    (r) => !hide.has(String(r.quote_number || "").trim().toLowerCase()),
  );
}

async function fetchOpenInstallationNeworderPage(
  conn,
  filters,
  limit,
  skip,
  {
    skipTotal = true,
    overdueDelayedOnly = false,
    where: prebuiltWhere = null,
    parallelEnrich = false,
    enrichConn = null,
    deferServiceEnrich = false,
    deferDispatchEnrich = false,
  } = {},
) {
  const parsed = parseSbiFilters(withDefaultOpenInstallationItemType(filters));
  const plan = prebuiltWhere
    ? {
        joinSql: "",
        extraWhere: "",
        skipItemType: false,
        skipDispatchStatus: false,
        skipWarrantyRegistration: false,
      }
    : openInstallationNeworderJoinPlan(parsed);
  const where =
    prebuiltWhere ??
    (await buildOpenInstallationNeworderWhereWithQuotePrefilters(
      conn,
      filters,
      {
        overdueDelayedOnly,
        skipItemType: plan.skipItemType,
        skipDispatchStatus: plan.skipDispatchStatus,
        skipWarrantyRegistration: plan.skipWarrantyRegistration,
      },
    ));
  if (!prebuiltWhere && plan.extraWhere) {
    where.sql += plan.extraWhere;
  }

  const [rows] = await conn.execute(
    `SELECT
       ${OPEN_INSTALLATION_LIST_SELECT}
     FROM neworder no
     ${plan.joinSql}
     ${where.sql}
     ORDER BY no.id DESC
     LIMIT ? OFFSET ?`,
    [...where.params, limit, skip],
  );

  const bucket = String(parsed.openInstallationBucket || "").trim().toLowerCase();
  const withoutTemp =
    bucket === "delivery_pending" || bucket === "delivered_pending"
      ? await excludeOpenInstallationTempSerialRows(conn, rows)
      : rows;

  let enriched = withoutTemp;
  if (!deferDispatchEnrich || !deferServiceEnrich) {
    if (parallelEnrich && withoutTemp.length && !deferDispatchEnrich && !deferServiceEnrich) {
      const c2 = enrichConn ?? (await getDbConnection());
      const [dispatchRows, serviceRows] = await Promise.all([
        enrichOpenInstallationRowsWithDispatch(conn, withoutTemp),
        enrichOpenInstallationRowsWithServices(c2, withoutTemp),
      ]);
      enriched = mergeOpenInstallationParallelEnrichment(dispatchRows, serviceRows);
    } else {
      if (!deferDispatchEnrich) {
        enriched = await enrichOpenInstallationRowsWithDispatch(conn, enriched);
      }
      if (!deferServiceEnrich) {
        enriched = await enrichOpenInstallationRowsWithServices(conn, enriched);
      }
    }
  }

  let total;
  if (!skipTotal) {
    const [[countRow]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM neworder no ${plan.joinSql} ${where.sql}`,
      where.params,
    );
    total = Number(countRow?.cnt || 0);
  }

  return {
    total,
    hasMore:
      total != null ? skip + enriched.length < total : enriched.length >= limit,
    data: enriched,
  };
}

async function countDeliveryStatusPending(conn, filters) {
  const where = buildDeliveryStatusPendingWhereSql(filters);
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS cnt FROM neworder no ${where.sql}`,
    where.params,
  );
  return Number(row?.cnt || 0);
}

function jsonSafeOpenInstallationRows(rows) {
  return (rows || []).map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = typeof value === "bigint" ? Number(value) : value;
    }
    return out;
  });
}

/** Same WHERE as KPI/count — used by per-card table APIs so rows cannot go empty while cards show totals. */
export async function fetchOpenInstallationBucketList(
  filters = {},
  limit = 10,
  skip = 0,
  { deferServiceEnrich = true } = {},
) {
  const conn = await getDbConnection();
  const page = await fetchOpenInstallationNeworderPage(
    conn,
    withDefaultOpenInstallationItemType(filters),
    Math.min(Math.max(Number(limit) || 10, 1), 200),
    Math.max(Number(skip) || 0, 0),
    {
      skipTotal: true,
      deferServiceEnrich,
      deferDispatchEnrich: deferServiceEnrich,
    },
  );
  return {
    ...page,
    data: jsonSafeOpenInstallationRows(page.data),
  };
}

async function countOpenInstallationNeworder(conn, filters, { overdueDelayedOnly = false } = {}) {
  const parsed = parseSbiFilters(withDefaultOpenInstallationItemType(filters));
  const plan = openInstallationNeworderJoinPlan(parsed);
  const where = await buildOpenInstallationNeworderWhereWithQuotePrefilters(conn, filters, {
    overdueDelayedOnly,
    skipItemType: plan.skipItemType,
    skipDispatchStatus: plan.skipDispatchStatus,
    skipWarrantyRegistration: plan.skipWarrantyRegistration,
  });
  if (plan.extraWhere) where.sql += plan.extraWhere;
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS cnt FROM neworder no ${plan.joinSql} ${where.sql}`,
    where.params,
  );
  return Number(row?.cnt || 0);
}

/**
 * KPI cards — same COUNT(*) as the table per bucket (accurate).
 * Sequential on one connection (mysql2 cannot multiplex one conn).
 * Products only (spare-only quotes excluded).
 */
async function fetchOpenInstallationBreakdownByBuckets(conn, filters) {
  const kpiFilters = sbiFiltersForOpenInstallationKpi(
    withDefaultOpenInstallationItemType(filters),
  );
  const cacheKey = openInstallationKpiCacheKey(kpiFilters, false);
  const cached = OPEN_INSTALLATION_KPI_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < OPEN_INSTALLATION_KPI_TTL_MS) {
    const plannedReady = Number(cached.data?.installation_planned) > 0;
    const othersReady =
      Number(cached.data?.delivered_installation_pending) > 0 ||
      Number(cached.data?.delivery_pending_after_dispatch) > 0 ||
      Number(cached.data?.completed_installation) > 0 ||
      Number(cached.data?.total) > 0;
    if (plannedReady || !othersReady) return cached.data;
  }

  const data = parseOpenInstallationBreakdownRow(null);
  data.feedback_collected = 0;

  data.delivered_installation_pending = await countOpenInstallationNeworder(conn, {
    ...kpiFilters,
    openInstallationBucket: "delivered_pending",
  });
  data.delivery_pending_after_dispatch = await countOpenInstallationNeworder(conn, {
    ...kpiFilters,
    openInstallationBucket: "delivery_pending",
  });
  data.completed_installation = await countOpenInstallationNeworder(conn, {
    ...kpiFilters,
    openInstallationBucket: "completed",
  });
  data.total = await countOpenInstallationNeworder(conn, {
    ...kpiFilters,
    openInstallationBucket: "",
  });
  data.installation_planned = await countInstallationPlannedServiceRecords(conn, kpiFilters);

  const allZero =
    !data.total &&
    !data.delivered_installation_pending &&
    !data.delivery_pending_after_dispatch &&
    !data.installation_planned &&
    !data.completed_installation;
  if (!allZero) {
    OPEN_INSTALLATION_KPI_CACHE.set(cacheKey, { at: Date.now(), data });
  }
  return data;
}

/** Public cards breakdown — list-accurate bucket counts (not lite SUM). */
export async function fetchOpenInstallationCardsBreakdown(filters = {}) {
  return loadOpenInstallationLiteBreakdown(filters);
}

const OPEN_INSTALLATION_KPI_CARD_SPEC = {
  "delivered-pending": {
    field: "delivered_installation_pending",
    openInstallationBucket: "delivered_pending",
  },
  delivered_pending: {
    field: "delivered_installation_pending",
    openInstallationBucket: "delivered_pending",
  },
  "delivery-pending": {
    field: "delivery_pending_after_dispatch",
    openInstallationBucket: "delivery_pending",
  },
  delivery_pending: {
    field: "delivery_pending_after_dispatch",
    openInstallationBucket: "delivery_pending",
  },
  completed: {
    field: "completed_installation",
    openInstallationBucket: "completed",
  },
  planned: {
    field: "installation_planned",
    openInstallationBucket: "installation_planned",
  },
  "installation-planned": {
    field: "installation_planned",
    openInstallationBucket: "installation_planned",
  },
};

/**
 * One KPI card. Neworder cards share a single lite scan (cache / in-flight).
 */
export async function countOpenInstallationKpiBucket(filters, bucket) {
  const key = String(bucket || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  const spec =
    OPEN_INSTALLATION_KPI_CARD_SPEC[key] ||
    OPEN_INSTALLATION_KPI_CARD_SPEC[key.replace(/-/g, "_")];
  if (!spec) {
    return { field: null, count: 0 };
  }

  const kpiFilters = sbiFiltersForOpenInstallationKpi(
    withDefaultOpenInstallationItemType(filters),
  );

  if (spec.field === "installation_planned") {
    const conn = await getDbConnection();
    const count = await countInstallationPlannedServiceRecords(conn, kpiFilters);
    return { field: spec.field, count };
  }

  const data = await loadOpenInstallationLiteBreakdown(kpiFilters);
  return { field: spec.field, count: Number(data[spec.field] || 0) };
}

/** Fast total for open-installation list (separate API from rows). */
export async function countOpenInstallationSegment(segment, filters = {}) {
  const conn = await getDbConnection();
  if (segment === "open-installation" || segment === "overdue-delayed-installation") {
    const overdueDelayedOnly = segment === "overdue-delayed-installation";
    if (openInstallationNeedsFullListShape(filters)) {
      return countUpcomingInstallations(conn, filters, { overdueDelayedOnly });
    }
    return countOpenInstallationNeworder(
      conn,
      withDefaultOpenInstallationItemType(filters),
      { overdueDelayedOnly },
    );
  }
  return 0;
}

/** Open Installation is products-only (no spare-only quotes). */
export function withDefaultOpenInstallationItemType(filters) {
  return forceOpenInstallationProductsOnly(filters);
}

/**
 * One round-trip: list + bucket total + KPI breakdown (parallel DB work, shared WHERE once).
 */
export async function fetchOpenInstallationPageBundle(
  filters,
  limit,
  skip,
  { overdueDelayedOnly = false } = {},
) {
  if (openInstallationNeedsFullListShape(filters)) {
    const conn = await getDbConnection();
    const page = await fetchUpcomingInstallationsPage(conn, filters, limit, skip, {
      overdueDelayedOnly,
      includeBreakdown: true,
      skipTotal: false,
    });
    return {
      total: page.total,
      hasMore: page.hasMore,
      data: page.data,
      openInstallationBreakdown: page.openInstallationBreakdown,
    };
  }

  const withProducts = withDefaultOpenInstallationItemType(filters);
  const connList = await getDbConnection();
  const connKpi = await getDbConnection();
  const connEnrich = await getDbConnection();

  const where = await buildOpenInstallationNeworderWhereWithQuotePrefilters(connList, withProducts, {
    overdueDelayedOnly,
  });

  const [pageResult, breakdown] = await Promise.all([
    fetchOpenInstallationNeworderPage(connList, withProducts, limit, skip, {
      skipTotal: true,
      overdueDelayedOnly,
      where,
      parallelEnrich: true,
      enrichConn: connEnrich,
    }),
    fetchOpenInstallationBreakdown(connKpi, withProducts, { overdueDelayedOnly }),
  ]);

  const bucket = String(parseSbiFilters(withProducts).openInstallationBucket || "").trim();
  let total = bucket
    ? openInstallationBucketRecordCount(bucket, breakdown)
    : Number(breakdown?.total || 0);
  if (total <= 0) {
    const [[countRow]] = await connList.execute(
      `SELECT COUNT(*) AS cnt FROM neworder no ${where.sql}`,
      where.params,
    );
    total = Number(countRow?.cnt || 0);
  }

  const data = pageResult.data || [];
  return {
    total,
    hasMore: skip + data.length < total,
    data,
    openInstallationBreakdown: breakdown,
  };
}

async function fetchOpenInstallationQuotePageKeys(
  conn,
  filters,
  limit,
  skip,
  { overdueDelayedOnly = false } = {},
) {
  const parsed = parseSbiFilters(filters);
  const type = resolveUpcomingInstallationType(parsed.itemType);
  const includeInstalledOrders = openInstallationNeedsInstalledOrders(
    parsed.openInstallationBucket,
  );
  const orderEligibility = { includeInstalledOrders, lite: true };
  const typeJoin = dispatchTypeJoin(type === "all" ? null : type);
  const quoteKey = sqlUtf8TrimExpr("d.quote_number");
  const bucketWhere = buildNeworderOpenInstallationBucketWhereSql(parsed.openInstallationBucket);
  const overdueSql = overdueDelayedOnly
    ? ` AND no.delivery_date < DATE_SUB(CURDATE(), INTERVAL ${OVERDUE_DELAYED_INSTALLATION_DAYS} DAY)`
    : "";

  const [rows] = await conn.execute(
    `SELECT no.quote_number
     FROM neworder no
     INNER JOIN (
       SELECT ${quoteKey} AS quote_key
       FROM dispatch d
       INNER JOIN neworder no_p
         ON ${sqlTrimUtf8EqColumns("no_p.quote_number", "d.quote_number")}
         AND ${pendingNeworderPredicates("no_p", orderEligibility)}
       ${typeJoin}
       WHERE 1=1
         ${dispatchSerialEligibleForInstallation("d", "no_p", { lite: true })}
       GROUP BY quote_key
     ) agg ON ${sqlTrimUtf8EqColumns("agg.quote_key", "no.quote_number")}
     WHERE ${pendingNeworderPredicates("no", orderEligibility)}
       ${bucketWhere}
       ${overdueSql}
     ORDER BY no.delivery_date ASC
     LIMIT ? OFFSET ?`,
    [limit, skip],
  );
  return rows.map((r) => String(r.quote_number || "").trim()).filter(Boolean);
}

/** Dispatch + service columns — second paint after raw list. */
export async function enrichOpenInstallationListServices(rows) {
  if (!rows?.length) return rows || [];
  const conn = await getDbConnection();
  const withDispatch = await enrichOpenInstallationRowsWithDispatch(conn, rows);
  const withServices = await enrichOpenInstallationRowsWithServices(conn, withDispatch);
  return mergeOpenInstallationParallelEnrichment(withDispatch, withServices);
}

async function fetchUpcomingInstallationsPage(
  conn,
  filters,
  limit,
  skip,
  {
    overdueDelayedOnly = false,
    includeBreakdown = false,
    skipTotal = false,
    deferServiceEnrich = false,
  } = {},
) {
  const parsed = parseSbiFilters(filters);

  // Default open-installation path: neworder page + tiny dispatch enrich (no full-table joins).
  // instCompletedBy is handled inside neworder WHERE via quote-key prefilter (still fast).
  const useNeworderFastPath =
    !parsed.serviceStatus &&
    !parsed.serviceEngineer &&
    !parsed.thirdPartyEngineer &&
    !parsed.assignedBy &&
    !parsed.registeredBy &&
    !parsed.orderDeliveryStatus &&
    !openInstallationNeedsFullListShape(filters);

  if (useNeworderFastPath) {
    const page = await fetchOpenInstallationNeworderPage(conn, filters, limit, skip, {
      skipTotal,
      overdueDelayedOnly,
      deferServiceEnrich,
      deferDispatchEnrich: deferServiceEnrich,
    });
    const breakdown = includeBreakdown
      ? await fetchOpenInstallationBreakdown(conn, filters, { overdueDelayedOnly })
      : undefined;
    return { ...page, openInstallationBreakdown: breakdown };
  }

  const listFilter = buildUpcomingInstallationListFilterSql(filters);
  const extraSql = overdueDelayedOnly ? upcomingOverdueDelayedExtraSql() : "";
  const baseParams = [...listFilter.params];
  const hasBucket = Boolean(parsed.openInstallationBucket);
  const orderBy = overdueDelayedOnly ? "u.delivery_date ASC" : "u.days_until_installation ASC";

  const useFastPage =
    !openInstallationNeedsFullListShape(filters) && !parsed.serviceStatus;

  let rows;
  if (useFastPage) {
    const quoteKeys = await fetchOpenInstallationQuotePageKeys(conn, filters, limit, skip, {
      overdueDelayedOnly,
    });
    if (!quoteKeys.length) {
      rows = [];
    } else {
      const listInner = buildOpenInstallationInnerQuery(filters, {
        forList: true,
        quoteKeys,
      });
      const keyParams = upcomingInstallationQuoteKeyParams(quoteKeys);
      const [enriched] = await conn.execute(
        `SELECT u.* FROM (${listInner}) u WHERE 1=1 ${listFilter.sql}${extraSql}
         ORDER BY ${orderBy}`,
        [...keyParams, ...baseParams],
      );
      rows = enriched;
    }
  } else {
    const listInner = buildOpenInstallationInnerQuery(filters, { forList: true });
    const [fullRows] = await conn.execute(
      `SELECT u.* FROM (${listInner}) u WHERE 1=1 ${listFilter.sql}${extraSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...baseParams, limit, skip],
    );
    rows = fullRows;
  }

  const breakdownPromise = includeBreakdown
    ? fetchOpenInstallationBreakdown(conn, filters, { overdueDelayedOnly })
    : Promise.resolve(null);

  const countPromise =
    skipTotal || (includeBreakdown && !hasBucket)
      ? Promise.resolve(null)
      : conn.execute(
          `SELECT COUNT(*) AS cnt FROM (${buildOpenInstallationInnerQuery(filters, {
            forList: false,
          })}) u WHERE 1=1 ${listFilter.sql}${extraSql}`,
          baseParams,
        );

  const [openInstallationBreakdown, countExec] = await Promise.all([
    breakdownPromise,
    countPromise,
  ]);

  let total;
  let hasMore;
  if (skipTotal) {
    total = undefined;
    hasMore = rows.length >= limit;
  } else if (includeBreakdown && !hasBucket) {
    total = Number(openInstallationBreakdown?.total || 0);
    hasMore = skip + rows.length < total;
  } else {
    total = Number(countExec?.[0]?.[0]?.cnt || 0);
    hasMore = skip + rows.length < total;
  }

  return {
    total,
    hasMore,
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

export const WARRANTY_END_DATE_SQL = `DATE_ADD(DATE(wp.installation_date), INTERVAL CAST(wp.warranty_period AS UNSIGNED) MONTH)`;

export const IN_WARRANTY_SQL = `(
  wp.installation_date IS NOT NULL
  AND wp.warranty_period IS NOT NULL
  AND TRIM(CAST(wp.warranty_period AS CHAR)) <> ''
  AND ${WARRANTY_END_DATE_SQL} >= CURDATE()
)`;

export const EXPIRED_WARRANTY_SQL = `(
  wp.installation_date IS NOT NULL
  AND wp.warranty_period IS NOT NULL
  AND TRIM(CAST(wp.warranty_period AS CHAR)) <> ''
  AND ${WARRANTY_END_DATE_SQL} < CURDATE()
)`;

export const WARRANTY_EXPIRING_30_DAYS_SQL = `(
  wp.installation_date IS NOT NULL
  AND wp.warranty_period IS NOT NULL
  AND TRIM(CAST(wp.warranty_period AS CHAR)) <> ''
  AND ${WARRANTY_END_DATE_SQL} >= CURDATE()
  AND ${WARRANTY_END_DATE_SQL} <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
)`;

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

const OPEN_COMPLAINTS_SR_JOIN = `FROM service_records sr
  LEFT JOIN warranty_products wp
    ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci`;

function parseOpenCompletionsComplaintKpiRow(row) {
  return {
    total_complaints_registered: Number(row?.total_complaints_registered || 0),
    pending_complaint: Number(row?.pending_complaint || 0),
    planned_complaint: Number(row?.planned_complaint || 0),
    completed_complaint: Number(row?.completed_complaint || 0),
    pending_by_customer: Number(row?.pending_by_customer || 0),
    pending_for_spares: Number(row?.pending_for_spares || 0),
    pending_over_48h_no_plan: Number(row?.pending_over_48h_no_plan || 0),
  };
}

/** Complaint KPI cards — all statuses; respects filters except status (pass kpi filters without serviceStatus). */
function openCompletionsListFilters(filters) {
  const f = parseSbiFilters(filters);
  const bucket = normalizeOpenCompletionsBucket(f.openCompletionsBucket) || "total_registered";
  return {
    ...f,
    openCompletionsBucket: bucket,
    serviceStatus: "",
  };
}

async function fetchOpenCompletionsComplaintsPage(conn, filters, limit, skip, { skipTotal = false } = {}) {
  await ensureServiceReportStepsTable();
  const f = openCompletionsListFilters(filters);
  const bucketSql = buildOpenCompletionsBucketWhereSql(f.openCompletionsBucket);
  const srFilter = buildServiceRecordFilterSql(f, {
    dateExpr: "COALESCE(sr.planned_date, sr.complaint_date, sr.reg_date)",
  });
  const where = `WHERE ${OPEN_COMPLAINTS_SQL} ${bucketSql.sql} ${srFilter.sql}`;
  const baseParams = [...bucketSql.params, ...srFilter.params];
  const join = `FROM service_records sr
    LEFT JOIN warranty_products wp
      ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
    LEFT JOIN service_report_steps srs ON srs.service_id = sr.service_id`;

  let total = 0;
  if (!skipTotal) {
    const [[countRow]] = await conn.execute(
      `SELECT COUNT(*) AS cnt ${join} ${where}`,
      baseParams,
    );
    total = Number(countRow?.cnt || 0);
  }

  const [rows] = await conn.execute(
    `SELECT
       sr.service_id,
       sr.serial_number,
       sr.service_type,
       sr.status,
       sr.status_description,
       sr.complaint_date,
       sr.reg_date,
       sr.planned_date,
       sr.complaint_summary,
       sr.assigned_to,
       sr.assigned_to_type,
       sr.assigned_to_id,
       sr.third_party_engineer_id,
       sr.engineer_assigned_by,
       (
         SELECT TRIM(COALESCE(wp_reg.created_by, ''))
         FROM warranty_products wp_reg
         WHERE ${sqlTrimUtf8EqColumns("wp_reg.serial_number", "sr.serial_number")}
         ORDER BY wp_reg.id DESC
         LIMIT 1
       ) AS registered_by,
       sr.completed_date,
       sr.completed_by_service_engineer,
       sr.pre_completion,
       sr.after_completion,
       sr.mail_sent,
       sr.service_rating,
       sr.final_feedback_on_call,
       sr.service_followup_at,
       wp.id AS machine_id,
       wp.customer_name,
       wp.model,
       wp.contact,
       wp.email,
       wp.state,
       wp.installed_address,
       wp.site_person,
       wp.contact_person,
       wp.product_name,
       srs.video_360,
       srs.video_problem,
       srs.video_damaged,
       srs.video_completion
     ${join}
     ${where}
     ORDER BY COALESCE(sr.complaint_date, sr.reg_date) DESC, sr.service_id DESC
     LIMIT ? OFFSET ?`,
    [...baseParams, limit, skip],
  );

  return {
    total,
    data: rows,
    hasMore: rows.length >= limit,
  };
}

/** Fast total for one open-completions KPI card table. */
export async function countOpenCompletionsComplaintSegment(filters = {}) {
  const conn = await getDbConnection();
  await ensureServiceReportStepsTable();
  const f = openCompletionsListFilters(filters);
  const bucketSql = buildOpenCompletionsBucketWhereSql(f.openCompletionsBucket);
  const srFilter = buildServiceRecordFilterSql(f, {
    dateExpr: "COALESCE(sr.planned_date, sr.complaint_date, sr.reg_date)",
  });
  const where = `WHERE ${OPEN_COMPLAINTS_SQL} ${bucketSql.sql} ${srFilter.sql}`;
  const baseParams = [...bucketSql.params, ...srFilter.params];

  const [[countRow]] = await conn.execute(
    `SELECT COUNT(*) AS cnt
     FROM service_records sr
     LEFT JOIN warranty_products wp
       ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
     ${where}`,
    baseParams,
  );
  return Number(countRow?.cnt || 0);
}

export async function fetchOpenCompletionsComplaintKpiBreakdown(conn, filters = {}) {
  const f = parseSbiFilters(filters);
  const kpiFilters = { ...f, serviceStatus: "" };
  const srFilter = buildServiceRecordFilterSql(kpiFilters, {
    dateExpr: "COALESCE(sr.planned_date, sr.complaint_date, sr.reg_date)",
  });
  const where = `WHERE ${OPEN_COMPLAINTS_SQL} ${srFilter.sql}`;

  const [[row]] = await conn.execute(
    `SELECT
       COUNT(*) AS total_complaints_registered,
       SUM(CASE WHEN UPPER(TRIM(COALESCE(sr.status, ''))) = 'PENDING' THEN 1 ELSE 0 END) AS pending_complaint,
       SUM(CASE WHEN UPPER(TRIM(COALESCE(sr.status, ''))) = 'PLANNED' THEN 1 ELSE 0 END) AS planned_complaint,
       SUM(CASE WHEN UPPER(TRIM(COALESCE(sr.status, ''))) = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_complaint,
       SUM(CASE WHEN UPPER(TRIM(COALESCE(sr.status, ''))) = 'PENDING BY CUSTOMER' THEN 1 ELSE 0 END) AS pending_by_customer,
       SUM(CASE WHEN UPPER(TRIM(COALESCE(sr.status, ''))) = 'PENDING FOR SPARES' THEN 1 ELSE 0 END) AS pending_for_spares,
       SUM(CASE
         WHEN UPPER(TRIM(COALESCE(sr.status, ''))) = 'PENDING'
           AND sr.complaint_date IS NOT NULL
           AND TIMESTAMPDIFF(HOUR, sr.complaint_date, NOW()) > 48
           AND (
             sr.planned_date IS NULL
             OR TRIM(CAST(sr.planned_date AS CHAR)) IN ('', '0000-00-00', '0000-00-00 00:00:00')
             OR DATE(sr.planned_date) <= '1970-01-01'
           )
         THEN 1 ELSE 0 END) AS pending_over_48h_no_plan
     ${OPEN_COMPLAINTS_SR_JOIN}
     ${where}`,
    [...srFilter.params],
  );

  return parseOpenCompletionsComplaintKpiRow(row);
}

/** Open Installation — pending installation jobs from Service Records (view_service_reports). */
export const OPEN_INSTALLATIONS_SQL = `(
  UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
)`;

function serviceRecordFilterNeedsWpJoin(f) {
  return Boolean(f.search || f.model || f.serial || (f.state && !f.assignedTo));
}

export async function fetchActiveAmcKpiBreakdown(conn, filters = {}) {
  const f = parseSbiFilters(filters);
  const amcFilter = buildAmcFilterSql(f);
  const [rows] = await conn.execute(
    `SELECT
       SUM(CASE WHEN ${ACTIVE_AMC_SQL} THEN 1 ELSE 0 END) AS active_amc,
       SUM(CASE WHEN ${AMC_EXPIRING_30_DAYS_SQL} THEN 1 ELSE 0 END) AS expiring_30_days,
       SUM(CASE WHEN ${EXPIRED_AMC_SQL} THEN 1 ELSE 0 END) AS expired_amc
     FROM amc_cmc
     WHERE 1=1 ${amcFilter.sql}`,
    amcFilter.params,
  );
  const row = rows?.[0] || {};
  return {
    active_amc: Number(row.active_amc || 0),
    expiring_30_days: Number(row.expiring_30_days || 0),
    expired_amc: Number(row.expired_amc || 0),
  };
}

export async function fetchActiveWarrantyKpiBreakdown(conn, filters = {}) {
  const f = parseSbiFilters(filters);
  const wpFilter = buildWpFilterSql(f);
  const [rows] = await conn.execute(
    `SELECT
       SUM(CASE WHEN ${IN_WARRANTY_SQL} THEN 1 ELSE 0 END) AS active_warranty,
       SUM(CASE WHEN ${WARRANTY_EXPIRING_30_DAYS_SQL} THEN 1 ELSE 0 END) AS expiring_30_days,
       SUM(CASE WHEN ${EXPIRED_WARRANTY_SQL} THEN 1 ELSE 0 END) AS expired_warranty
     FROM warranty_products wp
     WHERE 1=1 ${wpFilter.sql}`,
    wpFilter.params,
  );
  const row = rows?.[0] || {};
  return {
    active_warranty: Number(row.active_warranty || 0),
    expiring_30_days: Number(row.expiring_30_days || 0),
    expired_warranty: Number(row.expired_warranty || 0),
  };
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
  const [wpResult, srResult, amcResult, upcomingTotals, openInstallationBreakdown, overdueDelayedCount] =
    await Promise.all([
      pool.execute(wpSql, wpFilter.params),
      pool.execute(srSql, srFilter.params),
      pool.execute(amcSql, amcFilter.params),
      countUpcomingInstallationHubTotals(pool, f),
      fetchOpenInstallationCardsBreakdown(f),
      countOpenInstallationSegment("overdue-delayed-installation", f),
    ]);

  const wpRow = wpResult[0]?.[0];
  const srRow = srResult[0]?.[0];
  const amcRow = amcResult[0]?.[0];

  const data = {
    total_registered: Number(wpRow?.total_registered || 0),
    open_installation: upcomingTotals.open_installation,
    delivered_installation_pending: Number(
      openInstallationBreakdown?.delivered_installation_pending || 0,
    ),
    open_completions: Number(srRow?.open_completions || 0),
    overdue_delayed_installation: Number(overdueDelayedCount || 0),
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
    if (options.breakdownOnly) {
      const openInstallationBreakdown = await fetchOpenInstallationBreakdownByBuckets(
        conn,
        filters,
      );
      return {
        total: openInstallationBreakdown.total,
        data: [],
        openInstallationBreakdown,
      };
    }
    return fetchUpcomingInstallationsPage(conn, filters, safeLimit, safeSkip, {
      overdueDelayedOnly: false,
      includeBreakdown: options.includeOpenInstallationBreakdown !== false,
      skipTotal: Boolean(options.skipTotal),
      deferServiceEnrich: options.deferServiceEnrich !== false,
    });
  }

  if (segment === "open-completions") {
    return fetchOpenCompletionsComplaintsPage(conn, filters, safeLimit, safeSkip, {
      skipTotal: Boolean(options.skipTotal),
    });
  }

  if (segment === "overdue-delayed-installation") {
    return fetchUpcomingInstallationsPage(conn, filters, safeLimit, safeSkip, {
      overdueDelayedOnly: true,
      includeBreakdown: options.includeOpenInstallationBreakdown !== false,
      skipTotal: Boolean(options.skipTotal),
      deferServiceEnrich: options.deferServiceEnrich !== false,
    });
  }

  if (segment === "active-amc" || segment === "due-amc-expiring") {
    const filterSql =
      segment === "due-amc-expiring"
        ? DUE_AMC_SQL
        : activeAmcBucketBaseSql(parseSbiFilters(filters).amcBucket);
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
  else if (segment === "active-warranty") {
    filterSql = activeWarrantyBucketBaseSql(parseSbiFilters(filters).warrantyBucket);
  }
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
    if (segment === "active-warranty" && pageRows.length) {
      await enrichTotalRegisteredRows(conn, pageRows);
    }
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
  if (segment === "active-warranty") {
    filterSql = activeWarrantyBucketBaseSql(parseSbiFilters(filters).warrantyBucket);
  } else if (segment === "due-warranty-expiry") filterSql = DUE_WARRANTY_EXPIRY_SQL;
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

const WP_FILTER_OPTIONS_CACHE = new Map();
const OPEN_FILTER_OPTIONS_CACHE = new Map();
const TOTAL_REGISTERED_FILTER_OPTIONS_CACHE = new Map();
const FILTER_OPTIONS_INFLIGHT = new Map();
/** Name lists change rarely — long TTL + segment-only key keeps dropdown opens cheap. */
const FILTER_OPTIONS_TTL_MS = 10 * 60 * 1000;
const FILTER_OPTIONS_NAME_LIMIT = 250;

function mapDistinctNameRows(rows, limit = FILTER_OPTIONS_NAME_LIMIT) {
  const out = [];
  const seen = new Set();
  for (const r of rows || []) {
    const name = String(r?.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out.slice(0, limit);
}

function getCachedFilterOptions(cache, cacheKey) {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < FILTER_OPTIONS_TTL_MS) {
    return cached.data;
  }
  return null;
}

async function withFilterOptionsInflight(cacheKey, cache, loader) {
  const hit = getCachedFilterOptions(cache, cacheKey);
  if (hit) return hit;

  const existing = FILTER_OPTIONS_INFLIGHT.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const data = await loader();
    cache.set(cacheKey, { at: Date.now(), data });
    return data;
  })().finally(() => {
    FILTER_OPTIONS_INFLIGHT.delete(cacheKey);
  });

  FILTER_OPTIONS_INFLIGHT.set(cacheKey, promise);
  return promise;
}

/**
 * Total Registered dropdowns only.
 * Names come from small master tables (rep_list / third_party_service_engineers),
 * not a DISTINCT scan of warranty_products.
 *
 * GET /api/service-before-installation/total-registered/filters
 */
export async function fetchTotalRegisteredFilterOptions() {
  const cacheKey = "total-registered";
  return withFilterOptionsInflight(cacheKey, TOTAL_REGISTERED_FILTER_OPTIONS_CACHE, async () => {
    const conn = await getDbConnection();
    const limit = 1000;

    const [salesRows] = await conn.execute(
      `SELECT username AS name
       FROM rep_list
       WHERE status = 1
         AND TRIM(username) <> ''
       ORDER BY username ASC
       LIMIT ${limit}`,
    );

    const [internalRows] = await conn.execute(
      `SELECT username AS name
       FROM rep_list
       WHERE status = 1
         AND TRIM(userRole) = 'SERVICE ENGINEER'
         AND TRIM(username) <> ''
       ORDER BY username ASC
       LIMIT ${limit}`,
    );

    let thirdRows = [];
    try {
      const [rows] = await conn.execute(
        `SELECT name
         FROM third_party_service_engineers
         WHERE status = 'active'
           AND name IS NOT NULL
           AND TRIM(name) <> ''
         ORDER BY name ASC
         LIMIT ${limit}`,
      );
      thirdRows = rows || [];
    } catch {
      thirdRows = [];
    }

    return {
      salesPersons: mapDistinctNameRows(
        [{ name: "Automatic" }, ...(salesRows || [])],
        limit,
      ),
      serviceEngineers: mapDistinctNameRows(internalRows, limit),
      thirdPartyEngineers: mapDistinctNameRows(thirdRows, limit),
    };
  });
}

/**
 * Lightweight name lists for warranty segments.
 * Avoids wp⋈dispatch⋈neworder UNION and window-ranked joins (those timed out the pool).
 */
export async function fetchServiceBeforeInstallationWpFilterOptions(segment, _filters = {}) {
  const base = wpSegmentBaseFilterSql(segment);
  if (!base) return null;

  const cacheKey = `wp:${segment}`;
  return withFilterOptionsInflight(cacheKey, WP_FILTER_OPTIONS_CACHE, async () => {
    const conn = await getDbConnection();
    const limit = FILTER_OPTIONS_NAME_LIMIT;

    // Sales: one light DISTINCT on warranty_products only (no neworder / dispatch joins).
    const [salesRows] = await conn.execute(
      `SELECT DISTINCT wp.created_by AS name
       FROM warranty_products wp
       WHERE ${base}
         AND wp.created_by IS NOT NULL
         AND TRIM(wp.created_by) <> ''
       ORDER BY name ASC
       LIMIT ${limit}`,
    );

    let repSalesRows = [];
    if (segment === "active-warranty") {
      const [repRows] = await conn.execute(
        `SELECT username AS name
         FROM rep_list
         WHERE status = 1
           AND UPPER(TRIM(COALESCE(userRole, ''))) LIKE '%SALES%'
           AND TRIM(username) <> ''
         ORDER BY username ASC
         LIMIT ${limit}`,
      );
      repSalesRows = repRows || [];
    }

    // Engineers: master tables (same as assignment dropdowns) — not service_records scan.
    const [internalRows] = await conn.execute(
      `SELECT username AS name
       FROM rep_list
       WHERE status = 1 AND TRIM(userRole) = 'SERVICE ENGINEER'
       ORDER BY username ASC
       LIMIT ${limit}`,
    );

    let thirdRows = [];
    try {
      const [rows] = await conn.execute(
        `SELECT name
         FROM third_party_service_engineers
         WHERE status = 'active'
           AND name IS NOT NULL
           AND TRIM(name) <> ''
         ORDER BY name ASC
         LIMIT ${limit}`,
      );
      thirdRows = rows || [];
    } catch {
      thirdRows = [];
    }

    return {
      salesPersons: mapDistinctNameRows([...(salesRows || []), ...(repSalesRows || [])]),
      serviceEngineers: mapDistinctNameRows(internalRows),
      thirdPartyEngineers: mapDistinctNameRows(thirdRows),
    };
  });
}

/**
 * Fast open-installation dropdown names.
 * Uses small engineer master tables (same as assignment dropdowns) — no service_records /
 * neworder / warranty DISTINCT scans.
 */
async function fetchOpenInstallationFilterOptions(conn) {
  const [salesRows] = await conn.execute(
    `SELECT username AS name
     FROM rep_list
     WHERE status = 1
       AND TRIM(userRole) IN (
         'SALES', 'ADMIN', 'BACK OFFICE', 'SALES CUM BACKOFFICE', 'SALES HEAD', 'GEM PORTAL'
       )
     ORDER BY username ASC
     LIMIT ${FILTER_OPTIONS_NAME_LIMIT}`,
  );

  const [internalRows] = await conn.execute(
    `SELECT username AS name
     FROM rep_list
     WHERE status = 1 AND TRIM(userRole) = 'SERVICE ENGINEER'
     ORDER BY username ASC
     LIMIT ${FILTER_OPTIONS_NAME_LIMIT}`,
  );

  let thirdRows = [];
  try {
    const [rows] = await conn.execute(
      `SELECT name
       FROM third_party_service_engineers
       WHERE status = 'active'
         AND name IS NOT NULL
         AND TRIM(name) <> ''
       ORDER BY name ASC
       LIMIT ${FILTER_OPTIONS_NAME_LIMIT}`,
    );
    thirdRows = rows || [];
  } catch {
    thirdRows = [];
  }

  const serviceEngineers = mapDistinctNameRows(internalRows);
  const thirdPartyEngineers = mapDistinctNameRows(thirdRows);
  const instCompletedBys = mapDistinctNameRows([
    ...serviceEngineers.map((name) => ({ name })),
    ...thirdPartyEngineers.map((name) => ({ name })),
  ]);

  return {
    salesPersons: mapDistinctNameRows(salesRows),
    serviceEngineers,
    thirdPartyEngineers,
    instCompletedBys,
    assignedBys: [],
    registeredBys: [],
  };
}

/** Distinct sales / engineer names for open-installation list filters. */
export async function fetchServiceBeforeInstallationSegmentFilterOptions(segment, filters = {}) {
  if (segment === "total-registered") {
    return fetchTotalRegisteredFilterOptions();
  }
  if (segment === "active-warranty" || segment === "due-warranty-expiry") {
    return fetchServiceBeforeInstallationWpFilterOptions(segment, filters);
  }
  if (segment !== "open-installation" && segment !== "overdue-delayed-installation") {
    return null;
  }

  // Shared cache for both open + overdue — same name universe.
  const cacheKey = "open-installation";
  return withFilterOptionsInflight(cacheKey, OPEN_FILTER_OPTIONS_CACHE, async () => {
    const conn = await getDbConnection();
    return fetchOpenInstallationFilterOptions(conn);
  });
}