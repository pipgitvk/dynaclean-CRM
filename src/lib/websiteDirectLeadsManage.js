import { websiteDirectLeadsManage } from "@/lib/crmCampaignLeadsManage";

export const WEBSITE_DIRECT_CAMPAIGN_SQL = `LOWER(TRIM(c.lead_campaign)) IN ('website_visit', 'website', 'website_direct')`;

export const normalizeWebsiteDirectLeadFilters = websiteDirectLeadsManage.normalizeLeadFilters;
export const listWebsiteDirectLeads = websiteDirectLeadsManage.listLeads;
export const getWebsiteDirectLeadsSummary = websiteDirectLeadsManage.getSummary;
export const getWebsiteDirectLeadFilterOptions = websiteDirectLeadsManage.getFilterOptions;
export const fetchWebsiteDirectLeadsPage = websiteDirectLeadsManage.fetchLeadsPage;