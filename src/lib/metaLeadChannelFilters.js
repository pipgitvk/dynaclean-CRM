/** lead_campaign stored inside meta_leads.lead_data JSON (see webhook / fetch service). */

function leadCampaignExpr(alias) {
  return `LOWER(REPLACE(REPLACE(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.lead_data, '$.lead_campaign'))), ' ', '_'), '-', '_'))`;
}

const SOCIAL_BUCKETS =
  "('social_media', 'facebook', 'instagram', 'meta', 'social')";

/** Leads Manage → Google Ads: only lead_data.lead_campaign = google_ads. */
export function metaLeadGoogleAdsCampaignSql(alias = "ml0") {
  const campaign = leadCampaignExpr(alias);
  return `${campaign} = 'google_ads'`;
}

export function metaLeadSocialChannelSql(alias = "ml0") {
  const campaign = leadCampaignExpr(alias);
  const googleAdsOnly = metaLeadGoogleAdsCampaignSql(alias);
  return `(
    ${campaign} IN ${SOCIAL_BUCKETS}
    OR (
      (
        JSON_EXTRACT(${alias}.lead_data, '$.lead_campaign') IS NULL
        OR TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${alias}.lead_data, '$.lead_campaign')), '')) = ''
      )
      AND NOT ${googleAdsOnly}
    )
  )`;
}

export function getMetaLeadChannelSql(channel, alias = "ml0") {
  const key = String(channel || "social_media").trim().toLowerCase();
  if (key === "google_ads" || key === "google") {
    return metaLeadGoogleAdsCampaignSql(alias);
  }
  return metaLeadSocialChannelSql(alias);
}