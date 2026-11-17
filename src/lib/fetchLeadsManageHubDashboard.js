import { getDbConnection } from "@/lib/db";
import { buildGemCustomerScopeWhere } from "@/lib/dataScope";
import { sqlServiceSupportCustomerScope } from "@/lib/serviceSupportTeamScope";
import { CUSTOMER_MANUAL_ASSIGNED_TO_SQL } from "@/lib/customerManualAssignment";
import { metaLeadSocialChannelSql } from "@/lib/metaLeadChannelFilters";
import {
  fillDailySeries,
  LEADS_HUB_RANGE_OPTIONS,
  resolveLeadsHubRange,
} from "@/lib/leadsManageHubRange";
const SQL_GOOGLE = `LOWER(TRIM(c.lead_campaign)) IN ('google_ads', 'google', 'google adwords', 'googleads')`;
const SQL_INDIA = `LOWER(TRIM(c.lead_campaign)) IN ('india_mart', 'indiamart', 'india-mart')`;
const SQL_WEB = `LOWER(TRIM(c.lead_campaign)) IN ('website_visit', 'website', 'website_direct')`;
const SQL_MANUAL = CUSTOMER_MANUAL_ASSIGNED_TO_SQL.replace(/\s+/g, " ");
const SQL_ANY_CRM_HUB = `(${SQL_GOOGLE} OR ${SQL_INDIA} OR ${SQL_WEB} OR ${SQL_MANUAL})`;

function buildCustomerScope({ username, userRole }) {
  const conditions = [];
  const params = [];
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

  return { conditions, params };
}

function appendCrmDateRange(conditions, params, from, to) {
  conditions.push("c.date_created >= ?");
  params.push(`${from} 00:00:00`);
  conditions.push("c.date_created < DATE_ADD(?, INTERVAL 1 DAY)");
  params.push(to);
}

function pctChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function ratePart(numerator, denominator) {
  const d = Number(denominator) || 0;
  if (!d) return 0;
  return Math.round((Number(numerator) / d) * 1000) / 10;
}

async function countSocialMeta(conn, from, to) {
  const socialChannelSql = metaLeadSocialChannelSql("ml0").replace(/\s+/g, " ");
  const [[row]] = await conn.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN TRIM(COALESCE(ml.assigned_to, '')) != '' THEN 1 ELSE 0 END) AS assigned
     FROM meta_leads ml
     INNER JOIN (
       SELECT MIN(ml0.id) AS min_id
       FROM meta_leads ml0
       WHERE ml0.leadgen_id IS NOT NULL AND ml0.leadgen_id != ''
         AND DATE(ml0.created_at) >= ?
         AND DATE(ml0.created_at) <= ?
         AND ${socialChannelSql}
       GROUP BY ml0.leadgen_id
     ) unique_leads ON ml.id = unique_leads.min_id`,
    [from, to],
  );
  const total = Number(row?.total || 0);
  const assigned = Number(row?.assigned || 0);
  return { total, assigned, pending: Math.max(0, total - assigned) };
}

async function queryCrmBreakdown(conn, scope, from, to) {
  const conditions = [...scope.conditions];
  const params = [...scope.params];
  appendCrmDateRange(conditions, params, from, to);
  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [[row]] = await conn.execute(
    `SELECT
       SUM(CASE WHEN ${SQL_GOOGLE} THEN 1 ELSE 0 END) AS google_total,
       SUM(CASE WHEN ${SQL_GOOGLE} AND ${SQL_MANUAL} THEN 1 ELSE 0 END) AS google_assigned,
       SUM(CASE WHEN ${SQL_INDIA} THEN 1 ELSE 0 END) AS indiamart_total,
       SUM(CASE WHEN ${SQL_INDIA} AND ${SQL_MANUAL} THEN 1 ELSE 0 END) AS indiamart_assigned,
       SUM(CASE WHEN ${SQL_WEB} THEN 1 ELSE 0 END) AS website_total,
       SUM(CASE WHEN ${SQL_WEB} AND ${SQL_MANUAL} THEN 1 ELSE 0 END) AS website_assigned,
       SUM(CASE WHEN ${SQL_MANUAL} THEN 1 ELSE 0 END) AS manager_total,
       SUM(CASE WHEN ${SQL_MANUAL} THEN 1 ELSE 0 END) AS manager_assigned
     FROM customers c
     ${whereSql}`,
    params,
  );

  const pack = (totalKey, assignedKey) => {
    const total = Number(row?.[totalKey] || 0);
    const assigned = Number(row?.[assignedKey] || 0);
    return { total, assigned, pending: Math.max(0, total - assigned) };
  };

  return {
    google_ads: pack("google_total", "google_assigned"),
    indiamart: pack("indiamart_total", "indiamart_assigned"),
    website_direct: pack("website_total", "website_assigned"),
    manager_assigned: pack("manager_total", "manager_assigned"),
  };
}

async function queryCrmTrend(conn, scope, from, to) {
  const conditions = [...scope.conditions, SQL_ANY_CRM_HUB];
  const params = [...scope.params];
  appendCrmDateRange(conditions, params, from, to);
  const [rows] = await conn.execute(
    `SELECT DATE(c.date_created) AS d, COUNT(*) AS total
     FROM customers c
     WHERE ${conditions.join(" AND ")}
     GROUP BY DATE(c.date_created)
     ORDER BY d ASC`,
    params,
  );
  return rows.map((r) => ({ date: String(r.d).slice(0, 10), total: Number(r.total || 0) }));
}

async function querySocialTrend(conn, from, to) {
  const socialChannelSql = metaLeadSocialChannelSql("ml0").replace(/\s+/g, " ");
  const [rows] = await conn.execute(
    `SELECT DATE(ml0.created_at) AS d, COUNT(DISTINCT ml0.leadgen_id) AS total
     FROM meta_leads ml0
     WHERE ml0.leadgen_id IS NOT NULL AND ml0.leadgen_id != ''
       AND DATE(ml0.created_at) >= ?
       AND DATE(ml0.created_at) <= ?
       AND ${socialChannelSql}
     GROUP BY DATE(ml0.created_at)
     ORDER BY d ASC`,
    [from, to],
  );
  return rows.map((r) => ({ date: String(r.d).slice(0, 10), total: Number(r.total || 0) }));
}

function mergeTrendDays(crmPoints, socialPoints) {
  const map = new Map();
  for (const p of [...crmPoints, ...socialPoints]) {
    map.set(p.date, (map.get(p.date) || 0) + p.total);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}

function buildSourceRow(id, title, stats, changePct, href) {
  const { total, assigned, pending } = stats;
  return {
    id,
    title,
    href,
    total,
    assigned,
    pending,
    conversion: ratePart(assigned, total),
    changePct,
  };
}

export async function fetchLeadsManageHubDashboard({
  username,
  userRole,
  range = "month",
  from: customFrom,
  to: customTo,
}) {
  const conn = await getDbConnection();
  const scope = buildCustomerScope({ username, userRole });
  const { from, to, prevFrom, prevTo, rangeKey, rangeLabel: resolvedLabel } =
    resolveLeadsHubRange(range, { from: customFrom, to: customTo });

  const [
    socialNow,
    socialPrev,
    crmNow,
    crmPrev,
    crmTrendNow,
    socialTrendNow,
    crmTrendPrev,
    socialTrendPrev,
  ] = await Promise.all([
    countSocialMeta(conn, from, to),
    countSocialMeta(conn, prevFrom, prevTo),
    queryCrmBreakdown(conn, scope, from, to),
    queryCrmBreakdown(conn, scope, prevFrom, prevTo),
    queryCrmTrend(conn, scope, from, to),
    querySocialTrend(conn, from, to),
    queryCrmTrend(conn, scope, prevFrom, prevTo),
    querySocialTrend(conn, prevFrom, prevTo),
  ]);

  const counts = {
    social_media: socialNow.total,
    google_ads: crmNow.google_ads.total,
    indiamart: crmNow.indiamart.total,
    website_direct: crmNow.website_direct.total,
    manager_assigned: crmNow.manager_assigned.total,
  };

  const prevCounts = {
    social_media: socialPrev.total,
    google_ads: crmPrev.google_ads.total,
    indiamart: crmPrev.indiamart.total,
    website_direct: crmPrev.website_direct.total,
    manager_assigned: crmPrev.manager_assigned.total,
  };

  const trend = fillDailySeries(from, to, mergeTrendDays(crmTrendNow, socialTrendNow));
  const trendTotal = trend.reduce((sum, d) => sum + d.total, 0);
  const prevTrendTotal =
    mergeTrendDays(crmTrendPrev, socialTrendPrev).reduce((sum, d) => sum + d.total, 0) || 0;

  const rangeLabel =
    resolvedLabel ||
    LEADS_HUB_RANGE_OPTIONS.find((o) => o.id === rangeKey)?.label ||
    "Current Month";

  return {
    range: rangeKey,
    rangeLabel,
    from,
    to,
    counts,
    changes: {
      social_media: pctChange(counts.social_media, prevCounts.social_media),
      google_ads: pctChange(counts.google_ads, prevCounts.google_ads),
      indiamart: pctChange(counts.indiamart, prevCounts.indiamart),
      website_direct: pctChange(counts.website_direct, prevCounts.website_direct),
      manager_assigned: pctChange(counts.manager_assigned, prevCounts.manager_assigned),
      trend: pctChange(trendTotal, prevTrendTotal),
    },
    trend,
    trendTotal,
    sources: null,
    socialStats: socialNow,
    crmStats: crmNow,
    prevCounts,
  };
}

export function attachHubSourceRows(dashboard, dashboardBase) {
  const base = `/${dashboardBase}`;
  const defs = [
    { id: "social_media", title: "Social Media Ads", href: `${base}/leads-manage/social-media` },
    { id: "google_ads", title: "Google Ads", href: `${base}/leads-manage/google-ads` },
    { id: "indiamart", title: "Indiamart", href: `${base}/leads-manage/indiamart` },
    { id: "website_direct", title: "Website Direct", href: `${base}/leads-manage/website-direct` },
    {
      id: "manager_assigned",
      title: "Manager Assigned",
      href: `${base}/leads-manage/manager-assigned`,
    },
  ];

  dashboard.sources = defs.map((d) => {
    const stats =
      d.id === "social_media"
        ? dashboard.socialStats
        : dashboard.crmStats[d.id] || { total: 0, assigned: 0, pending: 0 };
    return buildSourceRow(
      d.id,
      d.title,
      stats,
      dashboard.changes[d.id] ?? 0,
      d.href,
    );
  });

  return dashboard;
}

/** Back-compat: hub card counts only (current month). */
export async function fetchLeadsManageCounts({ username, userRole }) {
  const dashboard = await fetchLeadsManageHubDashboard({
    username,
    userRole,
    range: "month",
  });
  return dashboard.counts;
}