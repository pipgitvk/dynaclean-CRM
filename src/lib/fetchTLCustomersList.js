import { SQL_EFFECTIVE_NEXT_FOLLOWUP } from "@/lib/tlEffectiveNextFollowupSql";
import {
  mysqlBoundsForIstDateRange,
  mysqlLowerBoundIstDayStart,
  mysqlUpperBoundIstDayEnd,
} from "@/lib/timezone";
import { notesLanguageExistsSql } from "@/constants/notesLanguageOptions";
import {
  appendExactMultiTagFilter,
  appendStatusVisibilityFilter,
  normalizeSearchParam,
  shouldHideDeniedInvalidLeads,
} from "@/lib/tlCustomersListSql";
import { ensureTLFollowupsModelColumn } from "@/lib/ensureTLFollowupsModelColumn";

export function parseTLCustomersListParams(searchParamsResolved) {
  let {
    search,
    employee,
    status,
    stage,
    nextFromDate,
    nextToDate,
    lead_campaign,
    notes_language,
    page = "1",
    tlOnly,
    preBookingOnly = "false",
  } = searchParamsResolved || {};

  if (tlOnly === undefined || tlOnly === null) {
    tlOnly = "true";
  }

  return {
    search: normalizeSearchParam(search),
    employee: normalizeSearchParam(employee),
    status: normalizeSearchParam(status),
    stage: normalizeSearchParam(stage),
    nextFromDate: normalizeSearchParam(nextFromDate),
    nextToDate: normalizeSearchParam(nextToDate),
    lead_campaign: normalizeSearchParam(lead_campaign),
    notes_language: normalizeSearchParam(notes_language),
    tag: normalizeSearchParam(searchParamsResolved?.tag),
    model: normalizeSearchParam(searchParamsResolved?.model),
    page: Math.max(1, parseInt(page, 10) || 1),
    showTLOnly: tlOnly === "true",
    showPreBookingOnly: preBookingOnly === "true",
  };
}

function buildSelectClause({
  mode,
  showTLOnly,
  tlModelSelect,
  sqlMultiTag,
  tlModelSubqueryCol,
}) {
  if (mode === "kpi") {
    return `
    SELECT
      c.customer_id,
      c.status,
      c.stage,
      ${sqlMultiTag} as multi_tag,
      ${tlModelSelect},
      tlf.next_followup_date as tl_next_followup,
      tlf.followed_date as tl_followed_date,
      tlf.customer_id as tl_customer_id,
      cf.next_followup_date as latest_next_followup,
      cf.followed_date as latest_followed_date,
      pb.customer_id as has_pre_booking
    `;
  }

  return `
    SELECT
      c.*,
      cf.next_followup_date as latest_next_followup,
      cf.followed_date as latest_followed_date,
      cf.notes as latest_notes,
      cf.followed_by as latest_followed_by,
      cf.multi_tag as cf_multi_tag,
      tlf.id as tl_followup_id,
      tlf.estimated_order_date,
      tlf.lead_quality_score,
      ${tlModelSelect},
      ${sqlMultiTag} as multi_tag,
      tlf.notes as tl_notes,
      tlf.next_followup_date as tl_next_followup,
      tlf.followed_date as tl_followed_date,
      tlf.followed_by as tl_followed_by,
      ${showTLOnly ? "fu.followup_start_at" : "NULL AS followup_start_at"},
      pb.customer_id as has_pre_booking
  `;
}

function buildFromClause({
  mode,
  showTLOnly,
  tlModelSubqueryCol,
  tlModelKpiSubqueryCol,
}) {
  const tlSubCol =
    mode === "kpi" ? tlModelKpiSubqueryCol : tlModelSubqueryCol;

  return `
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, next_followup_date, followed_date, notes, followed_by, multi_tag,
      ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY time_stamp DESC) as rn
      FROM customers_followup
    ) cf ON c.customer_id = cf.customer_id AND cf.rn = 1
    LEFT JOIN (
      SELECT customer_id, id, estimated_order_date, lead_quality_score, multi_tag, ${tlSubCol}notes, next_followup_date, followed_date, followed_by,
      ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY created_at DESC) as rn
      FROM TL_followups
    ) tlf ON c.customer_id = tlf.customer_id AND tlf.rn = 1
    LEFT JOIN (
      SELECT DISTINCT customer_id FROM pre_booking
    ) pb ON c.customer_id = pb.customer_id
    ${
      showTLOnly
        ? `LEFT JOIN (
      SELECT customer_id, MIN(dt) AS followup_start_at
      FROM (
        SELECT customer_id, created_at AS dt FROM TL_followups
        UNION ALL
        SELECT customer_id, time_stamp AS dt FROM customers_followup
      ) earliest_fu
      GROUP BY customer_id
    ) fu ON fu.customer_id = c.customer_id`
        : ""
    }
    WHERE 1=1
  `;
}

function appendTLCustomersFilters(
  query,
  params,
  filters,
  payload,
  {
    showTLOnly,
    sqlMultiTag,
    sqlNextForDateFilter,
    statusVisibility,
    hasModelColumn,
  },
) {
  const {
    search,
    employee,
    status,
    stage,
    tag,
    nextFromDate,
    nextToDate,
    lead_campaign,
    model,
    notes_language,
    showPreBookingOnly,
  } = filters;

  if (search) {
    query += ` AND (c.customer_id = ? OR c.phone LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(search, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const isEA = String(payload?.role || "").toUpperCase() === "EA";
  if (isEA && showTLOnly) {
    query += ` AND (c.assigned_to = ? OR c.lead_source = ?)`;
    params.push(payload?.username || "", payload?.username || "");
  }

  if (employee) {
    query += ` AND (c.lead_source = ? OR c.assigned_to = ?)`;
    params.push(employee, employee);
  }

  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  } else {
    query = appendStatusVisibilityFilter(query, statusVisibility);
  }

  if (stage) {
    query += ` AND c.stage = ?`;
    params.push(stage);
  }

  query = appendExactMultiTagFilter(query, params, tag, sqlMultiTag);

  if (showTLOnly && !search) {
    query += ` AND tlf.customer_id IS NOT NULL`;
  }

  if (showPreBookingOnly) {
    query += ` AND pb.customer_id IS NOT NULL`;
  }

  if (nextFromDate && nextToDate) {
    if (showTLOnly) {
      const ist = mysqlBoundsForIstDateRange(nextFromDate, nextToDate);
      query += ` AND tlf.next_followup_date IS NOT NULL AND tlf.next_followup_date BETWEEN ? AND ?`;
      if (ist) {
        params.push(ist.start, ist.end);
      } else {
        params.push(`${nextFromDate} 00:00:00`, `${nextToDate} 23:59:59`);
      }
    } else {
      query += ` AND ${sqlNextForDateFilter} BETWEEN ? AND ?`;
      params.push(`${nextFromDate} 00:00:00`, `${nextToDate} 23:59:59`);
    }
  } else if (nextFromDate) {
    if (showTLOnly) {
      const lo = mysqlLowerBoundIstDayStart(nextFromDate);
      query += ` AND tlf.next_followup_date IS NOT NULL AND tlf.next_followup_date >= ?`;
      params.push(lo ?? `${nextFromDate} 00:00:00`);
    } else {
      query += ` AND ${sqlNextForDateFilter} >= ?`;
      params.push(`${nextFromDate} 00:00:00`);
    }
  } else if (nextToDate) {
    if (showTLOnly) {
      const hi = mysqlUpperBoundIstDayEnd(nextToDate);
      query += ` AND tlf.next_followup_date IS NOT NULL AND tlf.next_followup_date <= ?`;
      params.push(hi ?? `${nextToDate} 23:59:59`);
    } else {
      query += ` AND ${sqlNextForDateFilter} <= ?`;
      params.push(`${nextToDate} 23:59:59`);
    }
  }

  if (lead_campaign) {
    query += ` AND c.lead_campaign = ?`;
    params.push(lead_campaign);
  }

  if (model && hasModelColumn) {
    query += ` AND tlf.model LIKE ?`;
    params.push(`%${model}%`);
  }

  if (notes_language) {
    query += ` AND ${notesLanguageExistsSql("?")}`;
    params.push(notes_language);
  }

  return query;
}

const KPI_EXCLUDED_STAGES_SQL = `('Won (Order Received)', 'Lost', 'Disqualified / Invalid Lead')`;

/** COUNT / KPI can use `customers` only when join-heavy filters are off. */
export function canUseCustomerOnlyCount(filters, showTLOnly) {
  if (showTLOnly && !filters.search) return false;
  return !(
    filters.tag ||
    filters.model ||
    filters.nextFromDate ||
    filters.nextToDate ||
    filters.notes_language ||
    filters.showPreBookingOnly
  );
}

function appendCustomerOnlyFilters(
  query,
  params,
  filters,
  payload,
  statusVisibility,
  showTLOnly,
) {
  const { search, employee, status, stage, lead_campaign } = filters;

  if (search) {
    query += ` AND (c.customer_id = ? OR c.phone LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(search, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const isEA = String(payload?.role || "").toUpperCase() === "EA";
  if (isEA && showTLOnly) {
    query += ` AND (c.assigned_to = ? OR c.lead_source = ?)`;
    params.push(payload?.username || "", payload?.username || "");
  }

  if (employee) {
    query += ` AND (c.lead_source = ? OR c.assigned_to = ?)`;
    params.push(employee, employee);
  }

  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  } else {
    query = appendStatusVisibilityFilter(query, statusVisibility);
  }

  if (stage) {
    query += ` AND c.stage = ?`;
    params.push(stage);
  }

  if (lead_campaign) {
    query += ` AND c.lead_campaign = ?`;
    params.push(lead_campaign);
  }

  return query;
}

function buildKpiEligibleSql(statusVisibility) {
  return shouldHideDeniedInvalidLeads(statusVisibility)
    ? `(c.status NOT IN ('Denied', 'Invalid'))`
    : "1=1";
}

/**
 * SQL aggregates for KPI chips + status/stage counts (TL toggle OFF — avoids loading all rows).
 */
export async function fetchTLCustomersKpiStats(
  conn,
  payload,
  searchParamsResolved,
) {
  const filters = parseTLCustomersListParams(searchParamsResolved);
  const { showTLOnly, showPreBookingOnly } = filters;

  const isSuperAdmin =
    String(payload.role ?? payload.userRole ?? "").trim().toUpperCase() ===
    "SUPERADMIN";
  const statusVisibility = {
    showTLOnly,
    isSuperAdmin,
    statusFilter: filters.status,
    search: filters.search,
  };

  await ensureTLFollowupsModelColumn(conn);
  const sqlMultiTag = showTLOnly ? "tlf.multi_tag" : "cf.multi_tag";
  const sqlNextForDateFilter = SQL_EFFECTIVE_NEXT_FOLLOWUP;
  const eligible = buildKpiEligibleSql(statusVisibility);
  const tagExpr = `LOWER(COALESCE(${sqlMultiTag}, ''))`;

  const fromClause = buildFromClause({
    mode: "kpi",
    showTLOnly,
    tlModelSubqueryCol: "",
    tlModelKpiSubqueryCol: "",
  });

  let chipQuery = `
    SELECT
      SUM(CASE WHEN ${eligible} THEN 1 ELSE 0 END) AS total,
      SUM(CASE WHEN ${eligible} AND ${tagExpr} LIKE '%strong followup%' THEN 1 ELSE 0 END) AS upcoming,
      SUM(CASE WHEN ${eligible} AND c.stage NOT IN ${KPI_EXCLUDED_STAGES_SQL}
        AND ${sqlNextForDateFilter} IS NOT NULL AND ${sqlNextForDateFilter} < NOW() THEN 1 ELSE 0 END) AS due,
      SUM(CASE WHEN ${eligible} AND ${tagExpr} LIKE '%prime%' THEN 1 ELSE 0 END) AS prime
    ${fromClause}
  `;

  const chipParams = [];
  chipQuery = appendTLCustomersFilters(chipQuery, chipParams, filters, payload, {
    showTLOnly,
    sqlMultiTag,
    sqlNextForDateFilter,
    statusVisibility,
    hasModelColumn: false,
  });

  const lightKpi = canUseCustomerOnlyCount(filters, showTLOnly);

  let statusQuery = lightKpi
    ? `SELECT c.status, COUNT(*) AS cnt FROM customers c WHERE 1=1`
    : `SELECT c.status, COUNT(*) AS cnt ${fromClause}`;
  const statusParams = [];
  if (lightKpi) {
    statusQuery = appendCustomerOnlyFilters(
      statusQuery,
      statusParams,
      filters,
      payload,
      statusVisibility,
      showTLOnly,
    );
  } else {
    statusQuery = appendTLCustomersFilters(
      statusQuery,
      statusParams,
      filters,
      payload,
      {
        showTLOnly,
        sqlMultiTag,
        sqlNextForDateFilter,
        statusVisibility,
        hasModelColumn: false,
      },
    );
  }
  statusQuery += ` GROUP BY c.status`;

  let stageQuery = lightKpi
    ? `SELECT c.stage, COUNT(*) AS cnt FROM customers c WHERE 1=1`
    : `SELECT c.stage, COUNT(*) AS cnt ${fromClause}`;
  const stageParams = [];
  if (lightKpi) {
    stageQuery = appendCustomerOnlyFilters(
      stageQuery,
      stageParams,
      filters,
      payload,
      statusVisibility,
      showTLOnly,
    );
  } else {
    stageQuery = appendTLCustomersFilters(
      stageQuery,
      stageParams,
      filters,
      payload,
      {
        showTLOnly,
        sqlMultiTag,
        sqlNextForDateFilter,
        statusVisibility,
        hasModelColumn: false,
      },
    );
  }
  stageQuery += ` GROUP BY c.stage`;

  const [[chipRow], [statusRows], [stageRows]] = await Promise.all([
    conn.execute(chipQuery, chipParams),
    conn.execute(statusQuery, statusParams),
    conn.execute(stageQuery, stageParams),
  ]);

  const statusCounts = {};
  for (const row of statusRows) {
    if (row.status != null) {
      statusCounts[row.status] = Number(row.cnt) || 0;
    }
  }

  const stageCounts = {};
  for (const row of stageRows) {
    if (row.stage != null) {
      stageCounts[row.stage] = Number(row.cnt) || 0;
    }
  }

  return {
    filterCounts: {
      total: Number(chipRow?.total) || 0,
      upcoming: Number(chipRow?.upcoming) || 0,
      due: Number(chipRow?.due) || 0,
      prime: Number(chipRow?.prime) || 0,
    },
    statusCounts,
    stageCounts,
  };
}

async function attachLatestFollowups(
  conn,
  customers,
  hasModelColumn,
  showTLOnly,
) {
  if (!customers.length) return customers;
  const ids = customers.map((c) => c.customer_id);
  const ph = ids.map(() => "?").join(",");

  const [cfRows] = await conn.execute(
    `SELECT f.customer_id, f.next_followup_date, f.followed_date, f.notes, f.followed_by, f.multi_tag
     FROM customers_followup f
     INNER JOIN (
       SELECT customer_id, MAX(time_stamp) AS max_ts
       FROM customers_followup
       WHERE customer_id IN (${ph})
       GROUP BY customer_id
     ) m ON f.customer_id = m.customer_id AND f.time_stamp = m.max_ts
     WHERE f.customer_id IN (${ph})`,
    [...ids, ...ids],
  );

  const modelSel = hasModelColumn ? "f.model AS tl_model," : "NULL AS tl_model,";
  const [tlfRows] = await conn.execute(
    `SELECT f.customer_id, f.id AS tl_followup_id, f.estimated_order_date, f.lead_quality_score,
      ${modelSel} f.multi_tag, f.notes AS tl_notes, f.next_followup_date AS tl_next_followup,
      f.followed_date AS tl_followed_date, f.followed_by AS tl_followed_by
     FROM TL_followups f
     INNER JOIN (
       SELECT customer_id, MAX(created_at) AS max_ca
       FROM TL_followups
       WHERE customer_id IN (${ph})
       GROUP BY customer_id
     ) m ON f.customer_id = m.customer_id AND f.created_at = m.max_ca
     WHERE f.customer_id IN (${ph})`,
    [...ids, ...ids],
  );

  const [pbRows] = await conn.execute(
    `SELECT DISTINCT customer_id FROM pre_booking WHERE customer_id IN (${ph})`,
    ids,
  );

  const cfBy = new Map(cfRows.map((r) => [r.customer_id, r]));
  const tlfBy = new Map(tlfRows.map((r) => [r.customer_id, r]));
  const pbSet = new Set(pbRows.map((r) => r.customer_id));

  return customers.map((c) => {
    const cf = cfBy.get(c.customer_id);
    const tlf = tlfBy.get(c.customer_id);
    const multiTag = showTLOnly
      ? tlf?.multi_tag ?? null
      : cf?.multi_tag ?? tlf?.multi_tag ?? null;
    return {
      ...c,
      latest_next_followup: cf?.next_followup_date ?? null,
      latest_followed_date: cf?.followed_date ?? null,
      latest_notes: cf?.notes ?? null,
      latest_followed_by: cf?.followed_by ?? null,
      cf_multi_tag: cf?.multi_tag ?? null,
      multi_tag: multiTag,
      followup_start_at: null,
      tl_followup_id: tlf?.tl_followup_id ?? null,
      estimated_order_date: tlf?.estimated_order_date ?? null,
      lead_quality_score: tlf?.lead_quality_score ?? null,
      tl_model: tlf?.tl_model ?? null,
      tl_notes: tlf?.tl_notes ?? null,
      tl_next_followup: tlf?.tl_next_followup ?? null,
      tl_followed_date: tlf?.tl_followed_date ?? null,
      tl_followed_by: tlf?.tl_followed_by ?? null,
      has_pre_booking: pbSet.has(c.customer_id) ? c.customer_id : null,
    };
  });
}

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {object} payload session
 * @param {object} searchParamsResolved
 * @param {{ mode?: 'full'|'kpi', pageSize?: number, paginate?: boolean }} options
 */
export async function fetchTLCustomersList(
  conn,
  payload,
  searchParamsResolved,
  options = {},
) {
  const { mode = "full", pageSize = 50, paginate = true } = options;
  const filters = parseTLCustomersListParams(searchParamsResolved);
  const { showTLOnly, showPreBookingOnly, page } = filters;

  const isSuperAdmin =
    String(payload.role ?? payload.userRole ?? "").trim().toUpperCase() ===
    "SUPERADMIN";
  const statusVisibility = {
    showTLOnly,
    isSuperAdmin,
    statusFilter: filters.status,
  };

  const hasModelColumn = await ensureTLFollowupsModelColumn(conn);
  const tlModelSelect = hasModelColumn ? "tlf.model as tl_model" : "NULL AS tl_model";

  const useFastListPath =
    mode === "full" &&
    paginate &&
    canUseCustomerOnlyCount(filters, showTLOnly);

  if (useFastListPath) {
    const countParams = [];
    let countQuery = `SELECT COUNT(*) as total FROM customers c WHERE 1=1`;
    countQuery = appendCustomerOnlyFilters(
      countQuery,
      countParams,
      filters,
      payload,
      statusVisibility,
      showTLOnly,
    );
    const [[countRow]] = await conn.execute(countQuery, countParams);
    const totalRecords = countRow?.total ?? 0;
    const totalPages = Math.ceil(totalRecords / pageSize);

    const listParams = [];
    const offset = (page - 1) * pageSize;
    let listQuery = `SELECT c.* FROM customers c WHERE 1=1`;
    listQuery = appendCustomerOnlyFilters(
      listQuery,
      listParams,
      filters,
      payload,
      statusVisibility,
      showTLOnly,
    );
    listQuery += ` ORDER BY c.date_created DESC LIMIT ? OFFSET ?`;
    listParams.push(Number(pageSize), Number(offset));

    const [customerRows] = await conn.execute(listQuery, listParams);
    const rows = await attachLatestFollowups(
      conn,
      customerRows,
      hasModelColumn,
      showTLOnly,
    );

    return {
      rows,
      totalRecords,
      totalPages,
      page,
      pageSize,
      filters,
      showTLOnly,
      showPreBookingOnly,
      isSuperAdmin,
    };
  }

  const tlModelSubqueryCol = hasModelColumn ? "model, " : "";
  const tlModelKpiSubqueryCol = hasModelColumn ? "model, " : "";
  const sqlNextForDateFilter = SQL_EFFECTIVE_NEXT_FOLLOWUP;
  const sqlMultiTag = showTLOnly ? "tlf.multi_tag" : "cf.multi_tag";

  let query =
    buildSelectClause({
      mode,
      showTLOnly,
      tlModelSelect,
      sqlMultiTag,
      tlModelSubqueryCol,
    }) +
    buildFromClause({
      mode,
      showTLOnly,
      tlModelSubqueryCol,
      tlModelKpiSubqueryCol,
    });

  const params = [];
  query = appendTLCustomersFilters(query, params, filters, payload, {
    showTLOnly,
    sqlMultiTag,
    sqlNextForDateFilter,
    statusVisibility,
    hasModelColumn,
  });

  let totalRecords = null;
  let totalPages = null;

  if (paginate && mode === "full") {
    if (canUseCustomerOnlyCount(filters, showTLOnly)) {
      const countParams = [];
      let countQuery = `SELECT COUNT(*) as total FROM customers c WHERE 1=1`;
      countQuery = appendCustomerOnlyFilters(
        countQuery,
        countParams,
        filters,
        payload,
        statusVisibility,
        showTLOnly,
      );
      const [[countRow]] = await conn.execute(countQuery, countParams);
      totalRecords = countRow?.total ?? 0;
    } else {
      const countQuery = query.replace(
        /SELECT[\s\S]*?FROM customers c/,
        "SELECT COUNT(*) as total FROM customers c",
      );
      const [[countRow]] = await conn.execute(countQuery, params);
      totalRecords = countRow?.total ?? 0;
    }
    totalPages = Math.ceil(totalRecords / pageSize);
  }

  if (showPreBookingOnly && mode === "full" && paginate) {
    query += ` ORDER BY c.date_created DESC`;
  } else if (paginate && mode === "full") {
    const offset = (page - 1) * pageSize;
    query += ` ORDER BY c.date_created DESC LIMIT ? OFFSET ?`;
    params.push(Number(pageSize), Number(offset));
  } else {
    query += ` ORDER BY c.date_created DESC`;
  }

  const [rows] = await conn.execute(query, params);

  return {
    rows,
    totalRecords,
    totalPages,
    page,
    pageSize,
    filters,
    showTLOnly,
    showPreBookingOnly,
    isSuperAdmin,
  };
}
