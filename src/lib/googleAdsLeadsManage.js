import { googleAdsLeadsManage } from "@/lib/crmCampaignLeadsManage";

export const GOOGLE_ADS_CAMPAIGN_SQL = `LOWER(TRIM(c.lead_campaign)) IN ('google_ads', 'google', 'google adwords', 'googleads')`;

export const normalizeGoogleAdsLeadFilters = googleAdsLeadsManage.normalizeLeadFilters;
export const listGoogleAdsLeads = googleAdsLeadsManage.listLeads;
export const getGoogleAdsLeadsSummary = googleAdsLeadsManage.getSummary;
export const getGoogleAdsLeadFilterOptions = googleAdsLeadsManage.getFilterOptions;
export const fetchGoogleAdsLeadsPage = googleAdsLeadsManage.fetchLeadsPage;