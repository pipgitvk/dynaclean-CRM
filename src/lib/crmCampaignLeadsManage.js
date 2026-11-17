import { getDbConnection } from "@/lib/db";
import { getCurrentMonthThroughTodayIso } from "@/lib/crmDateFormat";
import { buildCustomerListSearchClause } from "@/lib/customerListSearch";
import { buildGemCustomerScopeWhere } from "@/lib/dataScope";
import { sqlServiceSupportCustomerScope } from "@/lib/serviceSupportTeamScope";
import {
  CUSTOMER_MANUAL_ASSIGNED_TO_SQL,
  customerManualAssignedToSql,
} from "@/lib/customerManualAssignment";

export const CAMPAIGN_LEAD_SQL = {
  google_ads: `LOWER(TRIM(c.lead_campaign)) IN ('google_ads', 'google', 'google adwords', 'googleads')`,
  indiamart: `LOWER(TRIM(c.lead_campaign)) IN ('india_mart', 'indiamart', 'india-mart')`,
  website_direct: `LOWER(TRIM(c.lead_campaign)) IN ('website_visit', 'website', 'website_direct')`,
};

/** Manager manually assigned (not Automatic / empty assigned_to). */
export const MANAGER_ASSIGNED_LEAD_SQL = CUSTOMER_MANUAL_ASSIGNED_TO_SQL;

const CRM_CUSTOMER_CANCEL_SQL = `(
  LOWER(TRIM(c.status)) IN ('denied', 'invalid')
  OR LOWER(TRIM(c.status)) LIKE '%denied%'
  OR LOWER(TRIM(c.status)) LIKE '%invalid%'
)`;

const WON_ORDER_PREDICATE = `
  COALESCE(no.account_status, 0) = 1
  AND COALESCE(no.dispatch_status, 0) = 1
  AND COALESCE(no.is_cancelled, 0) = 0
`;

const LIST_SELECT = `
  c.customer_id, c.first_name, c.last_name, c.email, c.phone, c.company,
  c.lead_source, c.assigned_to, c.sales_representative, c.lead_campaign,
  c.status, c.stage, c.date_created, c.products_interest
`;

function normalizeOutcomeTag(raw) {
  const t = String(raw || "all").trim().toLowerCase();
  if (t === "won" || t === "cancel") return t;
  return "all";
}

function normalizeLeadFilters(filters = {}) {
  let { startDate, endDate } = filters;
  if (!startDate || !endDate) {
    const month = getCurrentMonthThroughTodayIso();
    startDate = startDate || month.from;
    endDate = endDate || month.to;
  }
  const q = String(filters.search || "").trim();
  const assignmentRaw = String(filters.assignmentFilter || "all").trim().toLowerCase();
  const assignmentFilter =
    assignmentRaw === "assigned" || assignmentRaw === "pending" ? assignmentRaw : "all";
  return {
    ...filters,
    startDate,
    endDate,
    search: q || undefined,
    assignmentFilter,
  };
}

function appendRoleScope(conditions, params, { username, userRole }) {
  const role = String(userRole || "").trim().toUpperCase();
  if (role === "SERVICE SUPPORT") {
    conditions.push(sqlServiceSupportCustomerScope("c"));
  } else if (role === "GEM") {
    const gemScope = buildGemCustomerScopeWhere({ username, tableAlias: "c" });
    conditions.push(gemScope.sql);
    params.push(...gemScope.params);
  } else if (
    role !== "ADMIN" &&
    role !== "SUPERADMIN" &&
    role !== "SERVICE HEAD" &&
    role !== "TEAM LEADER" &&
    role !== "EA"
  ) {
    conditions.push(
      "(c.lead_source = ? OR c.sales_representative = ? OR c.assigned_to = ?)",
    );
    params.push(username, username, username);
  }
}

function createBuildBaseWhere(campaignSql) {
  return function buildBaseWhere(filters, access) {
    const conditions = [campaignSql];
    const params = [];

    appendRoleScope(conditions, params, access);

    if (filters.startDate) {
      conditions.push("c.date_created >= ?");
      params.push(`${filters.startDate} 00:00:00`);
    }
    if (filters.endDate) {
      conditions.push("c.date_created < DATE_ADD(?, INTERVAL 1 DAY)");
      params.push(filters.endDate);
    }

    if (filters.assignedTo) {
      conditions.push("c.assigned_to = ?");
      params.push(filters.assignedTo);
    }
    if (filters.leadSource) {
      conditions.push("c.lead_source = ?");
      params.push(filters.leadSource);
    }

    if (filters.assignmentFilter === "assigned") {
      conditions.push(customerManualAssignedToSql("c"));
    } else if (filters.assignmentFilter === "pending") {
      conditions.push(`NOT (${customerManualAssignedToSql("c")})`);
    }

    const searchClause = buildCustomerListSearchClause(filters.search);
    if (searchClause) {
      conditions.push(searchClause.sql);
      params.push(...searchClause.params);
    }

    const tag = normalizeOutcomeTag(filters.outcomeTag);
    if (tag === "cancel") {
      conditions.push(CRM_CUSTOMER_CANCEL_SQL);
    } else if (tag === "won") {
      conditions.push(`NOT ${CRM_CUSTOMER_CANCEL_SQL}`);
      conditions.push(`EXISTS (
        SELECT 1 FROM neworder no
        WHERE no.customer_id = c.customer_id
          AND ${WON_ORDER_PREDICATE}
      )`);
    }

    return {
      whereSql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
      params,
    };
  };
}

async function attachWonFlags(conn, rows) {
  const ids = [
    ...new Set(rows.map((r) => r.customer_id).filter((id) => id != null && id !== "")),
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
  return rows.map((r) => ({
    ...r,
    has_dispatched_order:
      r.customer_id && wonSet.has(Number(r.customer_id)) ? 1 : 0,
  }));
}

export function createCrmCampaignLeadsManage(campaignSql) {
  const buildBaseWhere = createBuildBaseWhere(campaignSql);

  async function listLeads(filters, access) {
    filters = normalizeLeadFilters(filters);
    const conn = await getDbConnection();
    const { whereSql, params } = buildBaseWhere(filters, access);
    const limit = filters.limit ?? 50;
    const skip = filters.skip ?? 0;

    const [rows] = await conn.execute(
      `SELECT ${LIST_SELECT}
       FROM customers c
       ${whereSql}
       ORDER BY c.date_created DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, skip],
    );

    const tag = normalizeOutcomeTag(filters.outcomeTag);
    const data =
      tag === "won"
        ? rows.map((r) => ({ ...r, has_dispatched_order: 1 }))
        : await attachWonFlags(conn, rows);

    return { data };
  }

  async function countLeads(conn, filters, access) {
    const { whereSql, params } = buildBaseWhere(filters, access);
    const [[row]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM customers c ${whereSql}`,
      params,
    );
    return Number(row?.cnt || 0);
  }

  async function getSummary(filters, access) {
    filters = normalizeLeadFilters(filters);
    const conn = await getDbConnection();
    const { whereSql, params } = buildBaseWhere(filters, access);
    const manualSql = customerManualAssignedToSql("c");
    const [[row]] = await conn.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN ${manualSql} THEN 1 ELSE 0 END) AS assigned
       FROM customers c
       ${whereSql}`,
      params,
    );
    const total = Number(row?.total || 0);
    const assigned = Number(row?.assigned || 0);
    return {
      total,
      assigned,
      pending: Math.max(0, total - assigned),
    };
  }

  async function getFilterOptions(filters, access) {
    filters = normalizeLeadFilters(filters);
    const conn = await getDbConnection();

    const scopeConditions = [campaignSql];
    const scopeParams = [];
    appendRoleScope(scopeConditions, scopeParams, access);
    const scopeWhere = scopeConditions.length ? `WHERE ${scopeConditions.join(" AND ")}` : "";

    const dateConditions = [...scopeConditions];
    const dateParams = [...scopeParams];
    if (filters.startDate) {
      dateConditions.push("c.date_created >= ?");
      dateParams.push(`${filters.startDate} 00:00:00`);
    }
    if (filters.endDate) {
      dateConditions.push("c.date_created < DATE_ADD(?, INTERVAL 1 DAY)");
      dateParams.push(filters.endDate);
    }
    const dateWhere = dateConditions.length ? `WHERE ${dateConditions.join(" AND ")}` : "";

    const [assigneeResult, sourceResult] = await Promise.all([
      conn.execute(
        `SELECT
           all_a.assigned_to,
           COALESCE(scoped.lead_count, 0) AS lead_count
         FROM (
           SELECT DISTINCT c.assigned_to
           FROM customers c
           ${scopeWhere}
             AND TRIM(COALESCE(c.assigned_to, '')) != ''
         ) all_a
         LEFT JOIN (
           SELECT c.assigned_to, COUNT(*) AS lead_count
           FROM customers c
           ${dateWhere}
             AND TRIM(COALESCE(c.assigned_to, '')) != ''
           GROUP BY c.assigned_to
         ) scoped ON scoped.assigned_to = all_a.assigned_to
         ORDER BY all_a.assigned_to ASC
         LIMIT 500`,
        [...scopeParams, ...dateParams],
      ),
      conn.execute(
        `SELECT
           all_s.lead_source,
           COALESCE(scoped.lead_count, 0) AS lead_count
         FROM (
           SELECT DISTINCT c.lead_source
           FROM customers c
           ${scopeWhere}
             AND TRIM(COALESCE(c.lead_source, '')) != ''
         ) all_s
         LEFT JOIN (
           SELECT c.lead_source, COUNT(*) AS lead_count
           FROM customers c
           ${dateWhere}
             AND TRIM(COALESCE(c.lead_source, '')) != ''
           GROUP BY c.lead_source
         ) scoped ON scoped.lead_source = all_s.lead_source
         ORDER BY all_s.lead_source ASC
         LIMIT 500`,
        [...scopeParams, ...dateParams],
      ),
    ]);

    return {
      assignees: assigneeResult[0].map((r) => ({
        assignedTo: r.assigned_to,
        employeeName: r.assigned_to,
        leadCount: Number(r.lead_count || 0),
      })),
      leadSources: sourceResult[0].map((r) => ({
        source: String(r.lead_source || "").trim(),
        leadCount: Number(r.lead_count || 0),
      })),
    };
  }

  async function fetchLeadsPage(
    filters,
    access,
    { includeOptions = true, includeSummary = true, optionsOnly = false } = {},
  ) {
    filters = normalizeLeadFilters(filters);
    const skip = filters.skip ?? 0;

    if (optionsOnly && skip === 0) {
      const filterOptions = includeOptions
        ? await getFilterOptions(filters, access)
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
      const listResult = await listLeads(filters, access);
      const limit = filters.limit ?? 50;
      return {
        summary: null,
        filterOptions: null,
        data: listResult.data,
        pagination: {
          total: 0,
          limit,
          skip,
          hasMore: listResult.data.length >= limit,
        },
      };
    }

    const [listResult, summary, filterOptions] = await Promise.all([
      listLeads(filters, access),
      includeSummary ? getSummary(filters, access) : Promise.resolve(null),
      includeOptions ? getFilterOptions(filters, access) : Promise.resolve(null),
    ]);

    const listTotal = summary?.total ?? 0;

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

  return {
    normalizeLeadFilters,
    listLeads,
    getSummary,
    getFilterOptions,
    fetchLeadsPage,
  };
}

const googleAdsApi = createCrmCampaignLeadsManage(CAMPAIGN_LEAD_SQL.google_ads);
const indiamartApi = createCrmCampaignLeadsManage(CAMPAIGN_LEAD_SQL.indiamart);
const websiteDirectApi = createCrmCampaignLeadsManage(CAMPAIGN_LEAD_SQL.website_direct);
const managerAssignedApi = createCrmCampaignLeadsManage(MANAGER_ASSIGNED_LEAD_SQL);

export const googleAdsLeadsManage = googleAdsApi;
export const indiamartLeadsManage = indiamartApi;
export const websiteDirectLeadsManage = websiteDirectApi;
export const managerAssignedLeadsManage = managerAssignedApi;