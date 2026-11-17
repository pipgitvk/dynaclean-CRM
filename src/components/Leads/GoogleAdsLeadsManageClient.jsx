"use client";

import CrmCampaignLeadsManageClient from "@/components/Leads/CrmCampaignLeadsManageClient";
import { CRM_CAMPAIGN_PAGE_CONFIG } from "@/lib/crmCampaignLeadsPageConfig";

export default function GoogleAdsLeadsManageClient({ dashboardBase = "admin-dashboard" }) {
  return (
    <CrmCampaignLeadsManageClient
      dashboardBase={dashboardBase}
      pageConfig={CRM_CAMPAIGN_PAGE_CONFIG.google_ads}
    />
  );
}