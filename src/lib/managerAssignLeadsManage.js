import { managerAssignLeadsManage } from "@/lib/crmCampaignLeadsManage";

export const MANAGER_ASSIGN_CAMPAIGN_SQL = `LOWER(TRIM(c.lead_campaign)) IN ('manager_assigned', 'manager_assign', 'manager assign')`;

export const normalizeManagerAssignLeadFilters = managerAssignLeadsManage.normalizeLeadFilters;
export const listManagerAssignLeads = managerAssignLeadsManage.listLeads;
export const getManagerAssignLeadsSummary = managerAssignLeadsManage.getSummary;
export const getManagerAssignLeadFilterOptions = managerAssignLeadsManage.getFilterOptions;
export const fetchManagerAssignLeadsPage = managerAssignLeadsManage.fetchLeadsPage;