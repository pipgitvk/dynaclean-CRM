import { getDbConnection } from "@/lib/db";
import { buildGemCustomerScopeWhere } from "@/lib/dataScope";
import { sqlServiceSupportCustomerScope } from "@/lib/serviceSupportTeamScope";
import { CUSTOMER_MANUAL_ASSIGNED_TO_SQL } from "@/lib/customerManualAssignment";
import { metaLeadSocialChannelSql } from "@/lib/metaLeadChannelFilters";
import { getCurrentMonthRangeIso } from "@/lib/crmDateFormat";

/**
 * Inquiry counts for Leads Manage hub cards (current calendar month + role scope).
 */
export async function fetchLeadsManageCounts({ username, userRole }) {
  const conn = await getDbConnection();
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

  const month = getCurrentMonthRangeIso();
  conditions.push("c.date_created >= ?");
  params.push(`${month.from} 00:00:00`);
  conditions.push("c.date_created < DATE_ADD(?, INTERVAL 1 DAY)");
  params.push(month.to);

  const scopeWhere = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const monthParams = [month.from, month.to];
  const socialChannelSql = metaLeadSocialChannelSql("ml0").replace(/\s+/g, " ");
  const uniqueMetaLeadsCountSql = (channelSql) =>
    `SELECT COUNT(*) AS cnt FROM (
       SELECT MIN(ml0.id) AS min_id
       FROM meta_leads ml0
       WHERE ml0.leadgen_id IS NOT NULL AND ml0.leadgen_id != ''
         AND DATE(ml0.created_at) >= ?
         AND DATE(ml0.created_at) <= ?
         AND ${channelSql}
       GROUP BY ml0.leadgen_id
     ) meta_unique`;

  const [customerResult, socialMetaResult] = await Promise.all([
    conn.execute(
      `
      SELECT
        SUM(CASE WHEN LOWER(TRIM(c.lead_campaign)) IN ('google_ads', 'google', 'google adwords', 'googleads') THEN 1 ELSE 0 END) AS google_ads,
        SUM(CASE WHEN LOWER(TRIM(c.lead_campaign)) IN ('india_mart', 'indiamart', 'india-mart') THEN 1 ELSE 0 END) AS indiamart,
        SUM(CASE WHEN LOWER(TRIM(c.lead_campaign)) IN ('website_visit', 'website', 'website_direct') THEN 1 ELSE 0 END) AS website_direct,
        SUM(CASE WHEN ${CUSTOMER_MANUAL_ASSIGNED_TO_SQL.replace(/\s+/g, " ")} THEN 1 ELSE 0 END) AS manager_assigned
      FROM customers c
      ${scopeWhere}
      `,
      params,
    ),
    conn.execute(uniqueMetaLeadsCountSql(socialChannelSql), monthParams),
  ]);

  const row = customerResult[0]?.[0] || {};
  const socialMetaRow = socialMetaResult[0]?.[0];
  return {
    social_media: Number(socialMetaRow?.cnt || 0),
    google_ads: Number(row.google_ads || 0),
    indiamart: Number(row.indiamart || 0),
    website_direct: Number(row.website_direct || 0),
    manager_assigned: Number(row.manager_assigned || 0),
  };
}