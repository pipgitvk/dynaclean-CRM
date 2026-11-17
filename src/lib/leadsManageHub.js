/**
 * Leads Manage hub cards → customer / my-leads destinations.
 */
export function getLeadsManageCards(dashboardBase) {
  const base = `/${dashboardBase}`;
  return [
    {
      id: "social_media",
      title: "Social Media Ads",
      subtitle: "Facebook & Instagram enquiries",
      countKey: "social_media",
      href: `${base}/leads-manage/social-media`,
      accent: "from-pink-500 to-rose-600",
    },
    {
      id: "google_ads",
      title: "Google Ads",
      subtitle: "Search & Google Ads campaigns",
      countKey: "google_ads",
      href: `${base}/leads-manage/google-ads`,
      accent: "from-violet-500 to-purple-600",
    },
    {
      id: "indiamart",
      title: "Indiamart",
      subtitle: "Indiamart portal inquiries",
      countKey: "indiamart",
      href: `${base}/leads-manage/indiamart`,
      accent: "from-emerald-500 to-teal-600",
    },
    {
      id: "website_direct",
      title: "Website Direct",
      subtitle: "Direct website inquiries",
      countKey: "website_direct",
      href: `${base}/leads-manage/website-direct`,
      accent: "from-cyan-500 to-sky-600",
    },
    {
      id: "manager_assigned",
      title: "Manager Assigned",
      subtitle: "Leads with assigned manager",
      countKey: "manager_assigned",
      href: `${base}/leads-manage/manager-assigned`,
      accent: "from-amber-500 to-orange-600",
    },
  ];
}