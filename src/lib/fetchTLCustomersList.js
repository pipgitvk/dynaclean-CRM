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

  if (showTLOnly) {
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
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM customers c/,
      "SELECT COUNT(*) as total FROM customers c",
    );
    const [[countRow]] = await conn.execute(countQuery, params);
    totalRecords = countRow?.total ?? 0;
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
