import { managerAssignedLeadsManage } from "@/lib/crmCampaignLeadsManage";

export const normalizeManagerAssignedLeadFilters = managerAssignedLeadsManage.normalizeLeadFilters;
export const listManagerAssignedLeads = managerAssignedLeadsManage.listLeads;
export const getManagerAssignedLeadsSummary = managerAssignedLeadsManage.getSummary;
export const getManagerAssignedLeadFilterOptions = managerAssignedLeadsManage.getFilterOptions;
export const fetchManagerAssignedLeadsPage = managerAssignedLeadsManage.fetchLeadsPage;