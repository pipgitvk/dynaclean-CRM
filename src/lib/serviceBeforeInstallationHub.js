/**
 * Service Before Installation hub — card definitions.
 */
/** Detail strip on Total Registered — not separate hub routes. */
/** Detail strip on Open Installation — KPI filters for the list. */
export const OPEN_INSTALLATION_DETAIL_KPI_STRIP = [
  {
    id: "open-installation-delivered-pending",
    title: "Delivered — Installation Pending",
    subtitle: "Product received at site, installation not done",
    countCaption: "No. of products delivered (installation pending)",
    countKey: "delivered_installation_pending",
    accent: "from-amber-500 to-orange-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-amber-200/40 shadow-[0_8px_30px_-8px_rgba(245,158,11,0.35)]",
    glow: "bg-amber-400/25",
    iconSurface: "bg-gradient-to-br from-amber-500 to-orange-600",
    chartColor: "#f59e0b",
  },
  {
    id: "open-installation-delivery-pending",
    title: "Delivery Pending",
    subtitle: "Orders with delivery status still pending",
    countCaption: "No. of orders (delivery_status = 0)",
    countKey: "delivery_pending_after_dispatch",
    accent: "from-sky-500 to-blue-600",
    surface:
      "bg-white/90 backdrop-blur-xl border-sky-200/45 shadow-[0_8px_30px_-8px_rgba(14,165,233,0.28)]",
    glow: "bg-sky-400/25",
    iconSurface: "bg-gradient-to-br from-sky-500 to-blue-600",
    chartColor: "#0ea5e9",
  },
  {
    id: "open-installation-completed",
    title: "Installation Completed",
    subtitle: "Delivered products with installation done",
    countCaption: "No. of completed installation",
    countKey: "completed_installation",
    accent: "from-emerald-500 to-teal-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-emerald-200/40 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.3)]",
    glow: "bg-emerald-400/25",
    iconSurface: "bg-gradient-to-br from-emerald-500 to-teal-600",
    chartColor: "#10b981",
  },
  {
    id: "open-installation-feedback-collected",
    title: "Feedback Collected",
    subtitle: "Installation done — Google feedback marked Yes",
    countCaption: "No. of feedback collected",
    countKey: "feedback_collected",
    accent: "from-rose-500 to-orange-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-rose-200/40 shadow-[0_8px_30px_-8px_rgba(244,63,94,0.3)]",
    glow: "bg-rose-400/25",
    iconSurface: "bg-gradient-to-br from-rose-500 to-orange-600",
    chartColor: "#f43f5e",
  },
];

export const TOTAL_REGISTERED_DETAIL_KPI_STRIP = [
  {
    id: "registered-installation-pending",
    title: "Installation Pending",
    subtitle: "After registration — not installed yet",
    countCaption: "No. of installations pending after registered products",
    countKey: "registered_installation_pending",
    accent: "from-amber-500 to-orange-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-amber-200/40 shadow-[0_8px_30px_-8px_rgba(245,158,11,0.35)]",
    glow: "bg-amber-400/25",
    iconSurface: "bg-gradient-to-br from-amber-500 to-orange-600",
    chartColor: "#f59e0b",
  },
  {
    id: "registered-installation-completed",
    title: "Installation Completed",
    subtitle: "Registered products with installation done",
    countCaption: "No. of installations completed after registered products",
    countKey: "registered_installation_completed",
    accent: "from-emerald-500 to-teal-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-emerald-200/40 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.3)]",
    glow: "bg-emerald-400/25",
    iconSurface: "bg-gradient-to-br from-emerald-500 to-teal-600",
    chartColor: "#10b981",
  },
];

export const SERVICE_BEFORE_INSTALLATION_SEGMENTS = [
  {
    id: "total-registered",
    title: "Total Registered",
    subtitle: "All registered products",
    countCaption: "No. of registered products",
    countKey: "total_registered",
    accent: "from-violet-600 to-purple-600",
    surface:
      "bg-white/90 backdrop-blur-xl border-violet-200/45 shadow-[0_8px_30px_-8px_rgba(124,58,237,0.28)]",
    glow: "bg-violet-400/25",
    iconSurface: "bg-gradient-to-br from-violet-600 to-purple-600",
    chartColor: "#7c3aed",
  },
  {
    id: "open-installation",
    title: "Open Installation",
    subtitle: "All upcoming installations",
    countKey: "open_installation",
    accent: "from-amber-500 to-orange-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-amber-200/40 shadow-[0_8px_30px_-8px_rgba(245,158,11,0.35)]",
    glow: "bg-amber-400/25",
    iconSurface: "bg-gradient-to-br from-amber-500 to-orange-600",
    chartColor: "#f59e0b",
  },
  {
    id: "open-completions",
    title: "Open Complaints",
    subtitle: "Pending complaints only",
    countKey: "open_completions",
    accent: "from-sky-500 to-blue-600",
    surface:
      "bg-white/90 backdrop-blur-xl border-sky-200/45 shadow-[0_8px_30px_-8px_rgba(14,165,233,0.28)]",
    glow: "bg-sky-400/25",
    iconSurface: "bg-gradient-to-br from-sky-500 to-blue-600",
    chartColor: "#0ea5e9",
  },
  {
    id: "overdue-delayed-installation",
    title: "Overdue Delayed Installation",
    subtitle: "Pending from more than 2 days",
    countKey: "overdue_delayed_installation",
    accent: "from-rose-500 to-red-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-rose-200/40 shadow-[0_8px_30px_-8px_rgba(244,63,94,0.35)]",
    glow: "bg-rose-400/25",
    iconSurface: "bg-gradient-to-br from-rose-500 to-red-600",
    chartColor: "#e11d48",
  },
  {
    id: "active-warranty",
    title: "Active Warranty",
    subtitle: "Under warranty",
    countKey: "active_warranty",
    accent: "from-emerald-500 to-teal-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-emerald-200/40 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.3)]",
    glow: "bg-emerald-400/25",
    iconSurface: "bg-gradient-to-br from-emerald-500 to-teal-600",
    chartColor: "#10b981",
  },
  {
    id: "due-warranty-expiry",
    title: "Due Warranty Expiry",
    subtitle: "Expires in 30 days or already expired",
    countKey: "due_warranty_expiry",
    accent: "from-cyan-500 to-sky-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-sky-200/40 shadow-[0_8px_30px_-8px_rgba(6,182,212,0.3)]",
    glow: "bg-sky-400/25",
    iconSurface: "bg-gradient-to-br from-cyan-500 to-sky-600",
    chartColor: "#06b6d4",
  },
  {
    id: "active-amc",
    title: "Active AMC",
    subtitle: "AMC coverage",
    countKey: "active_amc",
    accent: "from-blue-500 to-indigo-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-blue-200/40 shadow-[0_8px_30px_-8px_rgba(59,130,246,0.35)]",
    glow: "bg-blue-400/25",
    iconSurface: "bg-gradient-to-br from-blue-500 to-indigo-600",
    chartColor: "#3b82f6",
  },
  {
    id: "due-amc-expiring",
    title: "Due AMC Expiring",
    subtitle: "Within 30 days or expired",
    countKey: "due_amc_expiring",
    accent: "from-fuchsia-500 to-pink-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-fuchsia-200/40 shadow-[0_8px_30px_-8px_rgba(217,70,239,0.35)]",
    glow: "bg-fuchsia-400/25",
    iconSurface: "bg-gradient-to-br from-fuchsia-500 to-pink-600",
    chartColor: "#d946ef",
  },
];

const SEGMENT_SET = new Set(
  SERVICE_BEFORE_INSTALLATION_SEGMENTS.map((s) => s.id),
);

export function isServiceBeforeInstallationSegment(id) {
  return SEGMENT_SET.has(String(id || "").trim());
}

export function getTotalRegisteredDetailKpiCards(dashboardBase) {
  const totalRegistered = getSegmentMeta("total-registered");
  return [{ ...totalRegistered, href: null }, ...TOTAL_REGISTERED_DETAIL_KPI_STRIP.map((c) => ({ ...c, href: null }))];
}

export function registeredInstallationFromKpiCardId(cardId) {
  if (cardId === "registered-installation-pending") return "pending";
  if (cardId === "registered-installation-completed") return "completed";
  return "";
}

export function totalRegisteredKpiCardIdFromFilter(registeredInstallation) {
  const v = String(registeredInstallation || "").trim().toLowerCase();
  if (v === "pending") return "registered-installation-pending";
  if (v === "completed") return "registered-installation-completed";
  return "total-registered";
}

export function getOpenInstallationDetailKpiCards() {
  return OPEN_INSTALLATION_DETAIL_KPI_STRIP.map((c) => ({ ...c, href: null }));
}

export function openInstallationBucketFromKpiCardId(cardId) {
  if (cardId === "open-installation-delivered-pending") return "delivered_pending";
  if (cardId === "open-installation-delivery-pending") return "delivery_pending";
  if (cardId === "open-installation-completed") return "completed";
  if (cardId === "open-installation-feedback-collected") return "feedback_collected";
  if (cardId === "open-installation-no-feedback") return "feedback_collected";
  return "";
}

export function openInstallationKpiCardIdFromFilter(openInstallationBucket) {
  const v = String(openInstallationBucket || "").trim().toLowerCase();
  if (v === "delivered_pending") return "open-installation-delivered-pending";
  if (v === "delivery_pending") return "open-installation-delivery-pending";
  if (v === "completed") return "open-installation-completed";
  if (v === "feedback_collected" || v === "no_feedback")
    return "open-installation-feedback-collected";
  return "";
}

export function getServiceBeforeInstallationCards(dashboardBase) {
  const base = `/${dashboardBase}`;
  return SERVICE_BEFORE_INSTALLATION_SEGMENTS.map((c) => ({
    ...c,
    href: `${base}/service-before-installation/${c.id}`,
  }));
}

export function getSegmentMeta(segmentId) {
  return SERVICE_BEFORE_INSTALLATION_SEGMENTS.find((s) => s.id === segmentId) || null;
}