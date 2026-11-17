export const CRM_CAMPAIGN_PAGE_CONFIG = {
  google_ads: {
    apiPath: "/api/leads-manage/google-ads",
    title: "Google Ads Leads",
    subtitle:
      "CRM customers — lead_campaign Google Ads (google_ads / google / googleads) — selected month ke hisaab se.",
    emptyMessage: "No Google Ads leads match these filters",
    accent: {
      summary: "text-violet-700",
      link: "text-violet-700 hover:underline",
      button: "bg-violet-600 hover:bg-violet-700",
      focus: "focus:ring-violet-500",
      spinner: "text-violet-600",
    },
  },
  indiamart: {
    apiPath: "/api/leads-manage/indiamart",
    title: "Indiamart Leads",
    subtitle:
      "Indiamart portal se aaye CRM enquiries (india_mart / indiamart) — selected month ke hisaab se.",
    emptyMessage: "No Indiamart leads match these filters",
    accent: {
      summary: "text-emerald-700",
      link: "text-emerald-700 hover:underline",
      button: "bg-emerald-600 hover:bg-emerald-700",
      focus: "focus:ring-emerald-500",
      spinner: "text-emerald-600",
    },
  },
  website_direct: {
    apiPath: "/api/leads-manage/website-direct",
    title: "Website Direct Leads",
    subtitle:
      "Website se direct aaye CRM enquiries (website_visit / website / website_direct) — selected month ke hisaab se.",
    emptyMessage: "No website direct leads match these filters",
    accent: {
      summary: "text-sky-700",
      link: "text-sky-700 hover:underline",
      button: "bg-sky-600 hover:bg-sky-700",
      focus: "focus:ring-sky-500",
      spinner: "text-sky-600",
    },
  },
  manager_assigned: {
    apiPath: "/api/leads-manage/manager-assigned",
    title: "Manager Assigned Leads",
    subtitle:
      "Sirf manual manager assignment — assigned_to me member ka naam (Automatic / auto nahi) — selected month.",
    emptyMessage: "No manager-assigned leads match these filters",
    accent: {
      summary: "text-amber-700",
      link: "text-amber-700 hover:underline",
      button: "bg-amber-600 hover:bg-amber-700",
      focus: "focus:ring-amber-500",
      spinner: "text-amber-600",
    },
  },
};