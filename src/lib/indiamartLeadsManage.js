import { indiamartLeadsManage } from "@/lib/crmCampaignLeadsManage";

export const INDIAMART_CAMPAIGN_SQL = `LOWER(TRIM(c.lead_campaign)) IN ('india_mart', 'indiamart', 'india-mart')`;

export const normalizeIndiamartLeadFilters = indiamartLeadsManage.normalizeLeadFilters;
export const listIndiamartLeads = indiamartLeadsManage.listLeads;
export const getIndiamartLeadsSummary = indiamartLeadsManage.getSummary;
export const getIndiamartLeadFilterOptions = indiamartLeadsManage.getFilterOptions;
export const fetchIndiamartLeadsPage = indiamartLeadsManage.fetchLeadsPage;