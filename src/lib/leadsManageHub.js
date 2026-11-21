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
      surface:
        "bg-white/80 backdrop-blur-xl border-pink-200/40 shadow-[0_8px_30px_-8px_rgba(236,72,153,0.35)]",
      glow: "bg-pink-400/25",
      iconSurface: "bg-gradient-to-br from-pink-500 to-rose-600",
      chartColor: "#ec4899",
    },
    {
      id: "google_ads",
      title: "Google Ads",
      subtitle: "Search & Google Ads campaigns",
      countKey: "google_ads",
      href: `${base}/leads-manage/google-ads`,
      accent: "from-violet-500 to-purple-600",
      surface:
        "bg-white/80 backdrop-blur-xl border-violet-200/40 shadow-[0_8px_30px_-8px_rgba(139,92,246,0.35)]",
      glow: "bg-violet-400/25",
      iconSurface: "bg-gradient-to-br from-violet-500 to-purple-600",
      chartColor: "#8b5cf6",
    },
    {
      id: "indiamart",
      title: "Indiamart",
      subtitle: "Indiamart portal inquiries",
      countKey: "indiamart",
      href: `${base}/leads-manage/indiamart`,
      accent: "from-emerald-500 to-teal-600",
      surface:
        "bg-white/80 backdrop-blur-xl border-emerald-200/40 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.3)]",
      glow: "bg-emerald-400/25",
      iconSurface: "bg-gradient-to-br from-emerald-500 to-teal-600",
      chartColor: "#10b981",
    },
    {
      id: "website_direct",
      title: "Website Direct",
      subtitle: "Direct website inquiries",
      countKey: "website_direct",
      href: `${base}/leads-manage/website-direct`,
      accent: "from-cyan-500 to-sky-600",
      surface:
        "bg-white/80 backdrop-blur-xl border-sky-200/40 shadow-[0_8px_30px_-8px_rgba(6,182,212,0.3)]",
      glow: "bg-sky-400/25",
      iconSurface: "bg-gradient-to-br from-cyan-500 to-sky-600",
      chartColor: "#06b6d4",
    },
    {
      id: "meta_leads",
      title: "meta_leads",
      subtitle: "Lead forms by Meta credential",
      countKey: null,
      href: `${base}/leads-manage/meta-leads`,
      noTrend: true,
      staticMetric: "Forms",
      accent: "from-indigo-500 to-violet-600",
      surface:
        "bg-white/80 backdrop-blur-xl border-violet-200/50 shadow-[0_8px_30px_-8px_rgba(99,102,241,0.35)]",
      glow: "bg-indigo-400/25",
      iconSurface: "bg-gradient-to-br from-indigo-500 to-violet-600",
      chartColor: "#6366f1",
    },
    {
      id: "bulk_reassign",
      title: "Bulk Reassign",
      subtitle: "Transfer leads between salespeople",
      countKey: null,
      href: `${base}/leads-manage/quick-bulk-reassign`,
      noTrend: true,
      staticMetric: "Quick",
      accent: "from-emerald-500 to-green-600",
      surface:
        "bg-white/80 backdrop-blur-xl border-emerald-200/50 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.35)]",
      glow: "bg-emerald-400/25",
      iconSurface: "bg-gradient-to-br from-emerald-500 to-green-600",
      chartColor: "#10b981",
    },
    {
      id: "manager_assigned",
      title: "Manually Assigned",
      subtitle: "Manual CRM assignment (excl. Google, Indiamart, Manager Assign)",
      countKey: "manager_assigned",
      href: `${base}/leads-manage/manually-assigned`,
      accent: "from-amber-500 to-orange-600",
      surface:
        "bg-white/80 backdrop-blur-xl border-amber-200/40 shadow-[0_8px_30px_-8px_rgba(245,158,11,0.35)]",
      glow: "bg-amber-400/25",
      iconSurface: "bg-gradient-to-br from-amber-500 to-orange-600",
      chartColor: "#f59e0b",
    },
    {
      id: "manager_assign",
      title: "Manager Assigned",
      subtitle: "Manager Assign campaign uploads",
      countKey: "manager_assign",
      href: `${base}/leads-manage/manager-assign`,
      accent: "from-rose-500 to-red-600",
      surface:
        "bg-white/80 backdrop-blur-xl border-rose-200/40 shadow-[0_8px_30px_-8px_rgba(244,63,94,0.35)]",
      glow: "bg-rose-400/25",
      iconSurface: "bg-gradient-to-br from-rose-500 to-red-600",
      chartColor: "#e11d48",
    },
  ];
}