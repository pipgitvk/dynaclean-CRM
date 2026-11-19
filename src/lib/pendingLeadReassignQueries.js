import { REP_LIST_IS_SALES_ROLE } from "@/lib/reassignSalesScope";

/** Sales leads whose lead_source is an inactive salesperson in rep_list (role SALES only). */
export const PENDING_REASSIGN_REP_JOIN = `
  INNER JOIN rep_list r
    ON r.username COLLATE utf8mb4_unicode_ci = TRIM(c.lead_source) COLLATE utf8mb4_unicode_ci
`;

export const PENDING_REASSIGN_WHERE_CORE = `
  c.lead_source IS NOT NULL
  AND TRIM(c.lead_source) <> ''
  AND COALESCE(r.status, 1) = 0
  AND ${REP_LIST_IS_SALES_ROLE}
`;

/** Map UI status filter → DB status values (forms vs legacy). */
export function pendingReassignStatusValues(statusParam) {
  const key = String(statusParam || "").trim();
  if (!key) return null;
  const map = {
    verygud: ["verygud", "Very Good"],
    average: ["average", "Average"],
    poor: ["poor", "Poor"],
    denied: ["denied", "Denied"],
    invalid: ["invalid", "Invalid"],
    old_reassign: ["old_reassign", "Old Reassign"],
    New: ["New"],
  };
  if (map[key]) return map[key];
  return [key];
}

/** Canonical campaign keys → SQL on `c.lead_campaign`. */
export function pendingReassignCampaignFilterSql(campaignParam) {
  const key = String(campaignParam || "").trim().toLowerCase();
  if (!key) return null;
  const map = {
    india_mart: `LOWER(TRIM(c.lead_campaign)) IN ('india_mart', 'indiamart', 'india-mart')`,
    social_media:
      `LOWER(TRIM(c.lead_campaign)) IN ('social_media', 'facebook', 'instagram', 'meta', 'social')`,
    google_ads:
      `LOWER(TRIM(c.lead_campaign)) IN ('google_ads', 'google', 'google adwords', 'googleads')`,
    website_visit:
      `LOWER(TRIM(c.lead_campaign)) IN ('website_visit', 'website', 'website_direct', 'visit')`,
    direct_call: `LOWER(TRIM(c.lead_campaign)) IN ('direct_call', 'direct call')`,
    manager_assigned:
      `REPLACE(REPLACE(LOWER(TRIM(c.lead_campaign)), '_', ''), '-', '') IN ('managerassigned', 'managerassign')`,
  };
  return map[key] || null;
}

export function pendingReassignSearchSql(search) {
  const q = String(search || "").trim();
  if (!q) return { clause: "", params: [] };
  const like = `%${q}%`;
  const clause = `
    AND (
      CAST(c.customer_id AS CHAR) LIKE ?
      OR COALESCE(c.first_name, '') LIKE ?
      OR COALESCE(c.last_name, '') LIKE ?
      OR COALESCE(c.company, '') LIKE ?
      OR COALESCE(c.phone, '') LIKE ?
      OR TRIM(c.lead_source) LIKE ?
    )`;
  return { clause, params: [like, like, like, like, like, like] };
}