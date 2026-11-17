import { getDbConnection } from "@/lib/db";
import { getCurrentMonthThroughTodayIso } from "@/lib/crmDateFormat";
import { getMetaLeadChannelSql } from "@/lib/metaLeadChannelFilters";
import {
  customerPhoneLast10Sql,
  metaLeadPhoneLast10Sql,
  META_LEAD_CUSTOMER_JOIN,
} from "@/lib/metaLeadCustomerPhoneMatch";

const CRM_CUSTOMER_CANCEL_SQL = `(
  LOWER(TRIM(c.status)) IN ('denied', 'invalid')
  OR LOWER(TRIM(c.status)) LIKE '%denied%'
  OR LOWER(TRIM(c.status)) LIKE '%invalid%'
)`;

const WON_CUSTOMERS_DERIVED = `
  SELECT DISTINCT cid AS customer_id
  FROM (
    SELECT no.customer_id AS cid
    FROM neworder no
    WHERE no.customer_id IS NOT NULL
      AND COALESCE(no.account_status, 0) = 1
      AND COALESCE(no.dispatch_status, 0) = 1
      AND COALESCE(no.is_cancelled, 0) = 0
    UNION
    SELECT qr.customer_id AS cid
    FROM neworder no
    INNER JOIN quotations_records qr ON no.quote_number = qr.quote_number
    WHERE qr.customer_id IS NOT NULL
      AND COALESCE(no.account_status, 0) = 1
      AND COALESCE(no.dispatch_status, 0) = 1
      AND COALESCE(no.is_cancelled, 0) = 0
  ) won_union
`;

const LIST_SELECT = `
  ml.id, ml.leadgen_id, ml.assigned_to, ml.employee_name, ml.form_id, ml.page_id,
  ml.campaign_name, ml.products_interest, ml.created_at, ml.is_imported_to_crm,
  ml.crm_customer_id, ml.lead_data, ml.field_data, ml.ad_id
`;

function normalizeOutcomeTag(raw) {
  const t = String(raw || "all").trim().toLowerCase();
  if (t === "won" || t === "cancel") return t;
  return "all";
}

function needsWonJoin(filters) {
  return normalizeOutcomeTag(filters.outcomeTag) === "won";
}

/** Search only inside the dated unique-lead subquery (ml0), not the full meta_leads table. */
function buildInnerDateScopedSearch(filters) {
  const q = String(filters.search || "").trim();
  if (!q) return { sql: "", values: [] };

  const like = `%${q}%`;
  const metaParts = [
    "ml0.leadgen_id LIKE ?",
    "ml0.employee_name LIKE ?",
    "ml0.assigned_to LIKE ?",
    "ml0.campaign_name LIKE ?",
    "ml0.form_id LIKE ?",
    "ml0.products_interest LIKE ?",
    "JSON_UNQUOTE(JSON_EXTRACT(ml0.lead_data, '$.email')) LIKE ?",
    "JSON_UNQUOTE(JSON_EXTRACT(ml0.lead_data, '$.first_name')) LIKE ?",
    "JSON_UNQUOTE(JSON_EXTRACT(ml0.lead_data, '$.full_name')) LIKE ?",
  ];
  const values = metaParts.map(() => like);

  if (/^\d+$/.test(q)) {
    const id = parseInt(q, 10);
    metaParts.push("ml0.crm_customer_id = ?");
    values.push(id);
  } else {
    metaParts.push("CAST(ml0.crm_customer_id AS CHAR) LIKE ?");
    values.push(like);
  }

  const phoneDigits = q.replace(/\D/g, "");
  if (phoneDigits.length >= 4) {
    const tail = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
    const phoneLike = `%${tail}%`;
    metaParts.push("JSON_UNQUOTE(JSON_EXTRACT(ml0.lead_data, '$.phone')) LIKE ?");
    metaParts.push("JSON_UNQUOTE(JSON_EXTRACT(ml0.lead_data, '$.phone_number')) LIKE ?");
    values.push(phoneLike, phoneLike);
  }

  const ml0Phone10 = metaLeadPhoneLast10Sql("ml0");
  const c0Phone10 = customerPhoneLast10Sql("c0");
  const crmParts = [
    "c0.first_name LIKE ?",
    "c0.phone LIKE ?",
    "c0.email LIKE ?",
  ];
  const crmValues = [like, like, like];
  if (/^\d+$/.test(q)) {
    crmParts.push("c0.customer_id = ?");
    crmValues.push(parseInt(q, 10));
  } else {
    crmParts.push("CAST(c0.customer_id AS CHAR) LIKE ?");
    crmValues.push(like);
  }

  const existsSql = `
    EXISTS (
      SELECT 1 FROM customers c0
      WHERE (
        c0.customer_id = ml0.crm_customer_id
        OR (
          (ml0.crm_customer_id IS NULL OR ml0.crm_customer_id = 0)
          AND CHAR_LENGTH(${ml0Phone10}) = 10
          AND ${ml0Phone10} = ${c0Phone10}
        )
      )
      AND (${crmParts.join(" OR ")})
    )`;

  return {
    sql: ` AND ((${metaParts.join(" OR ")}) OR ${existsSql})`,
    values: [...values, ...crmValues],
  };
}

export function normalizeSocialMediaLeadFilters(filters = {}) {
  let { startDate, endDate } = filters;
  if (!startDate || !endDate) {
    const month = getCurrentMonthThroughTodayIso();
    startDate = startDate || month.from;
    endDate = endDate || month.to;
  }
  const q = String(filters.search || "").trim();
  const metaChannel = filters.metaChannel || "social_media";
  return {
    ...filters,
    metaChannel,
    startDate,
    endDate,
    search: q || undefined,
  };
}

function isGoogleMetaChannel(filters) {
  const ch = String(filters.metaChannel || "social_media").toLowerCase();
  return ch === "google_ads" || ch === "google";
}

function canUseFastScopedSql(filters) {
  return normalizeOutcomeTag(filters.outcomeTag) === "all";
}

function appendOutcomeFilter(filters) {
  const tag = normalizeOutcomeTag(filters.outcomeTag);
  if (tag === "cancel") {
    return {
      sql: ` AND c.customer_id IS NOT NULL AND ${CRM_CUSTOMER_CANCEL_SQL}`,
      values: [],
    };
  }
  if (tag === "won") {
    return {
      sql: ` AND c.customer_id IS NOT NULL AND NOT ${CRM_CUSTOMER_CANCEL_SQL} AND won_cust.customer_id IS NOT NULL`,
      values: [],
    };
  }
  return { sql: "", values: [] };
}

/** Same DATE bounds as meta-credentials → /api/meta-leads (MetaFormLeadsTable). */
function pushDateRange(inner, values, filters, createdAtCol = "created_at") {
  if (filters.startDate) {
    inner.push(`DATE(${createdAtCol}) >= ?`);
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    inner.push(`DATE(${createdAtCol}) <= ?`);
    values.push(filters.endDate);
  }
}

function buildInnerUniqueSubquery(filters, { includeImportFilter = true } = {}) {
  const inner = ["ml0.leadgen_id IS NOT NULL", "ml0.leadgen_id != ''"];
  const values = [];

  if (filters.assignedTo) {
    inner.push("ml0.assigned_to = ?");
    values.push(filters.assignedTo);
  }
  if (filters.campaignName) {
    inner.push("ml0.campaign_name = ?");
    values.push(filters.campaignName);
  }
  if (includeImportFilter && filters.isImported !== undefined) {
    inner.push("ml0.is_imported_to_crm = ?");
    values.push(filters.isImported ? 1 : 0);
  }
  pushDateRange(inner, values, filters, "ml0.created_at");

  inner.push(getMetaLeadChannelSql(filters.metaChannel || "social_media", "ml0"));

  const search = buildInnerDateScopedSearch(filters);

  const subquerySql = `
    SELECT MIN(ml0.id) AS min_id
    FROM meta_leads ml0
    WHERE ${inner.join(" AND ")}${search.sql}
    GROUP BY ml0.leadgen_id
  `;

  return { subquerySql, values: [...values, ...search.values] };
}

function buildScopedUniqueJoin(filters, options = {}) {
  const { subquerySql, values } = buildInnerUniqueSubquery(filters, options);
  const joinSql = `
    INNER JOIN (
      ${subquerySql}
    ) unique_leads ON ml.id = unique_leads.min_id
  `;
  return { joinSql, values };
}

function scopedFromClause(filters, options = {}) {
  const { joinSql, values } = buildScopedUniqueJoin(filters, options);
  const outcome = appendOutcomeFilter(filters);
  const wonJoin = needsWonJoin(filters)
    ? `LEFT JOIN (${WON_CUSTOMERS_DERIVED}) won_cust ON won_cust.customer_id = c.customer_id`
    : "";

  const fromSql = `
    FROM meta_leads ml
    ${joinSql}
    ${META_LEAD_CUSTOMER_JOIN}
    ${wonJoin}
    WHERE 1=1${outcome.sql}
  `;
  return { fromSql, values: [...values, ...outcome.values] };
}

function parseJsonValue(rawValue, fallback) {
  if (rawValue === null || rawValue === undefined) return fallback;
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch {
      return fallback;
    }
  }
  if (typeof rawValue === "object") return rawValue;
  return fallback;
}

const WON_ORDER_PREDICATE = `
  COALESCE(no.account_status, 0) = 1
  AND COALESCE(no.dispatch_status, 0) = 1
  AND COALESCE(no.is_cancelled, 0) = 0
`;

async function attachWonFlags(conn, rows) {
  const ids = [
    ...new Set(
      rows
        .map((r) => r.resolved_customer_id ?? r.crm_customer_id)
        .filter((id) => id != null && id !== ""),
    ),
  ];
  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, has_dispatched_order: 0 }));
  }
  const placeholders = ids.map(() => "?").join(", ");
  const [wonRows] = await conn.execute(
    `SELECT DISTINCT cid AS customer_id
     FROM (
       SELECT no.customer_id AS cid
       FROM neworder no
       WHERE no.customer_id IN (${placeholders})
         AND ${WON_ORDER_PREDICATE}
       UNION
       SELECT qr.customer_id AS cid
       FROM neworder no
       INNER JOIN quotations_records qr ON no.quote_number = qr.quote_number
       WHERE qr.customer_id IN (${placeholders})
         AND ${WON_ORDER_PREDICATE}
     ) won_page`,
    [...ids, ...ids],
  );
  const wonSet = new Set(wonRows.map((r) => Number(r.customer_id)));
  return rows.map((r) => {
    const cid = Number(r.resolved_customer_id ?? r.crm_customer_id);
    return {
      ...r,
      has_dispatched_order: cid && wonSet.has(cid) ? 1 : 0,
    };
  });
}

async function countFastMonthScopedLeads(conn, filters, options = {}) {
  const { subquerySql, values } = buildInnerUniqueSubquery(filters, options);
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS cnt FROM (${subquerySql}) scoped_unique`,
    values,
  );
  return Number(row?.cnt || 0);
}

async function summaryFastMonthScoped(conn, filters) {
  const scoped = {
    metaChannel: filters.metaChannel || "social_media",
    startDate: filters.startDate,
    endDate: filters.endDate,
    assignedTo: filters.assignedTo,
    campaignName: filters.campaignName,
    outcomeTag: filters.outcomeTag,
    search: filters.search,
    isImported: filters.isImported,
  };
  const forCards = { ...scoped };
  delete forCards.isImported;

  const { subquerySql, values } = buildInnerUniqueSubquery(forCards, {
    includeImportFilter: false,
  });
  let importSql = "";
  const importValues = [];
  if (scoped.isImported !== undefined) {
    importSql = " AND ml.is_imported_to_crm = ?";
    importValues.push(scoped.isImported ? 1 : 0);
  }
  const [[row]] = await conn.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(ml.is_imported_to_crm = 1) AS imported,
       SUM(ml.is_imported_to_crm = 0) AS not_imported
     FROM meta_leads ml
     INNER JOIN (${subquerySql}) unique_leads ON ml.id = unique_leads.min_id
     WHERE 1=1${importSql}`,
    [...values, ...importValues],
  );
  return {
    total: Number(row?.total || 0),
    imported: Number(row?.imported || 0),
    notImported: Number(row?.not_imported || 0),
  };
}

function mapListRows(rows) {
  return rows.map((row) => {
    const { resolved_customer_id, ...rest } = row;
    const linkedCustomerId =
      resolved_customer_id != null && resolved_customer_id !== ""
        ? resolved_customer_id
        : rest.crm_customer_id;
    return {
      ...rest,
      crm_customer_id: linkedCustomerId,
      resolved_customer_id: linkedCustomerId,
      leadData: parseJsonValue(rest.lead_data, {}),
      fieldData: parseJsonValue(rest.field_data, []),
      isImportedToCRM: Boolean(rest.is_imported_to_crm),
    };
  });
}

async function fetchLeadsByMetaIds(conn, filters, metaIds) {
  if (metaIds.length === 0) return [];
  const placeholders = metaIds.map(() => "?").join(", ");
  const wonJoin = needsWonJoin(filters)
    ? `LEFT JOIN (${WON_CUSTOMERS_DERIVED}) won_cust ON won_cust.customer_id = c.customer_id`
    : "";
  const outcome = appendOutcomeFilter(filters);
  const [rows] = await conn.execute(
    `SELECT ${LIST_SELECT},
      COALESCE(NULLIF(ml.crm_customer_id, 0), c.customer_id) AS resolved_customer_id,
      c.assigned_to AS crm_assigned_to,
      c.lead_source AS crm_lead_source,
      c.sales_representative AS crm_sales_rep,
      c.status AS crm_status
    FROM meta_leads ml
    ${META_LEAD_CUSTOMER_JOIN}
    ${wonJoin}
    WHERE ml.id IN (${placeholders})${outcome.sql}
    ORDER BY ml.created_at DESC`,
    [...metaIds, ...outcome.values],
  );
  return rows;
}

/** Month-scoped list: paginate on meta_leads only, CRM join on the current page rows. */
async function listSocialMediaLeadsFastPaginated(filters, { withTotal = false } = {}) {
  const conn = await getDbConnection();
  const { joinSql, values } = buildScopedUniqueJoin(filters);
  const limit = filters.limit ?? 50;
  const skip = filters.skip ?? 0;

  const [idRows] = await conn.execute(
    `SELECT ml.id
     FROM meta_leads ml
     ${joinSql}
     ORDER BY ml.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, skip],
  );
  const metaIds = idRows.map((r) => r.id);
  const rows = metaIds.length ? await fetchLeadsByMetaIds(conn, filters, metaIds) : [];

  let filterTotal = null;
  if (withTotal) {
    filterTotal = await countFastMonthScopedLeads(conn, filters);
  }

  let data = mapListRows(rows);
  if (!needsWonJoin(filters)) {
    data = await attachWonFlags(conn, data);
  } else {
    data = data.map((r) => ({ ...r, has_dispatched_order: 1 }));
  }
  return { data, filterTotal };
}

export async function listSocialMediaLeads(filters = {}, { withTotal = false } = {}) {
  filters = normalizeSocialMediaLeadFilters(filters);
  if (canUseFastScopedSql(filters)) {
    return listSocialMediaLeadsFastPaginated(filters, { withTotal });
  }

  const conn = await getDbConnection();
  const { fromSql, values } = scopedFromClause(filters);
  const limit = filters.limit ?? 50;
  const skip = filters.skip ?? 0;

  const [rows] = await conn.execute(
    `SELECT ${LIST_SELECT},
      COALESCE(NULLIF(ml.crm_customer_id, 0), c.customer_id) AS resolved_customer_id,
      c.assigned_to AS crm_assigned_to,
      c.lead_source AS crm_lead_source,
      c.sales_representative AS crm_sales_rep,
      c.status AS crm_status
    ${fromSql}
    ORDER BY ml.created_at DESC
    LIMIT ? OFFSET ?`,
    [...values, limit, skip],
  );

  let filterTotal = null;
  if (withTotal) {
    filterTotal = await countSocialMediaLeadsFull(conn, filters);
  }

  let data = mapListRows(rows);
  if (!needsWonJoin(filters)) {
    data = await attachWonFlags(conn, data);
  } else {
    data = data.map((r) => ({ ...r, has_dispatched_order: 1 }));
  }

  return { data, filterTotal };
}

async function countSocialMediaLeadsFull(conn, filters) {
  const { fromSql, values } = scopedFromClause(filters);
  const [[row]] = await conn.execute(`SELECT COUNT(*) AS cnt ${fromSql}`, values);
  return Number(row?.cnt || 0);
}

export async function countSocialMediaLeadsQuick(filters = {}) {
  filters = normalizeSocialMediaLeadFilters(filters);
  const conn = await getDbConnection();
  if (canUseFastScopedSql(filters)) {
    return countFastMonthScopedLeads(conn, filters);
  }
  return countSocialMediaLeadsFull(conn, filters);
}

export async function getSocialMediaLeadsSummary(filters = {}) {
  filters = normalizeSocialMediaLeadFilters(filters);
  const conn = await getDbConnection();

  if (canUseFastScopedSql(filters)) {
    return summaryFastMonthScoped(conn, filters);
  }

  const scoped = {
    metaChannel: filters.metaChannel || "social_media",
    startDate: filters.startDate,
    endDate: filters.endDate,
    assignedTo: filters.assignedTo,
    campaignName: filters.campaignName,
    outcomeTag: filters.outcomeTag,
    isImported: filters.isImported,
    search: filters.search,
  };

  const forImportSplit = { ...scoped };
  delete forImportSplit.isImported;

  const splitFrom = scopedFromClause(forImportSplit, { includeImportFilter: false });
  const [[splitRow]] = await conn.execute(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ml.is_imported_to_crm = 1 THEN 1 ELSE 0 END) AS imported,
      SUM(CASE WHEN ml.is_imported_to_crm = 0 THEN 1 ELSE 0 END) AS not_imported
     ${splitFrom.fromSql}`,
    splitFrom.values,
  );

  return {
    total: Number(splitRow?.total || 0),
    imported: Number(splitRow?.imported || 0),
    notImported: Number(splitRow?.not_imported || 0),
  };
}

/** Fast dropdown options — meta_leads only (no CRM / won joins). */
export async function getSocialMediaLeadFilterOptions(filters = {}) {
  filters = normalizeSocialMediaLeadFilters(filters);
  const conn = await getDbConnection();
  const where = ["leadgen_id IS NOT NULL", "leadgen_id != ''"];
  const values = [];
  pushDateRange(where, values, filters);
  where.push(getMetaLeadChannelSql(filters.metaChannel || "social_media", "meta_leads"));

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [assigneeResult, campaignResult] = await Promise.all([
    conn.execute(
      `SELECT DISTINCT assigned_to, employee_name
       FROM meta_leads
       ${whereSql}
         AND TRIM(COALESCE(assigned_to, '')) != ''
       ORDER BY employee_name ASC, assigned_to ASC
       LIMIT 300`,
      values,
    ),
    conn.execute(
      `SELECT DISTINCT campaign_name
       FROM meta_leads
       ${whereSql}
         AND TRIM(COALESCE(campaign_name, '')) != ''
       ORDER BY campaign_name ASC
       LIMIT 300`,
      values,
    ),
  ]);

  return {
    assignees: assigneeResult[0].map((r) => ({
      assignedTo: r.assigned_to,
      employeeName: r.employee_name,
    })),
    campaigns: campaignResult[0]
      .map((r) => String(r.campaign_name || "").trim())
      .filter(Boolean),
  };
}

export async function fetchSocialMediaLeadsPage(
  filters,
  { includeOptions = true, includeSummary = true, optionsOnly = false } = {},
) {
  filters = normalizeSocialMediaLeadFilters(filters);
  const skip = filters.skip ?? 0;

  if (optionsOnly && skip === 0) {
    const filterOptions = includeOptions
      ? await getSocialMediaLeadFilterOptions(filters)
      : null;
    return {
      summary: null,
      filterOptions,
      data: [],
      pagination: {
        total: 0,
        limit: filters.limit ?? 50,
        skip: 0,
        hasMore: false,
      },
    };
  }

  if (skip > 0) {
    const listResult = await listSocialMediaLeads(filters, { withTotal: false });
    return {
      summary: null,
      filterOptions: null,
      data: listResult.data,
      pagination: {
        total: 0,
        limit: filters.limit ?? 50,
        skip,
        hasMore: listResult.data.length >= (filters.limit ?? 50),
      },
    };
  }

  const [listResult, filterOptions, summary] = await Promise.all([
    listSocialMediaLeads(filters, { withTotal: false }),
    includeOptions ? getSocialMediaLeadFilterOptions(filters) : Promise.resolve(null),
    includeSummary ? getSocialMediaLeadsSummary(filters) : Promise.resolve(null),
  ]);

  const listTotal = summary?.total ?? listResult.filterTotal ?? 0;

  return {
    summary: summary ? { ...summary, total: listTotal } : null,
    filterOptions,
    data: listResult.data,
    pagination: {
      total: listTotal,
      limit: filters.limit ?? 50,
      skip: 0,
      hasMore: listResult.data.length < listTotal,
    },
  };
}