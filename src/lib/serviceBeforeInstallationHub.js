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
    title: "On the Way Machine",
    subtitle: "Dispatched, delivery still pending",
    countCaption: "No. of product delivery pending after dispatch OR on the way machine",
    countKey: "delivery_pending_after_dispatch",
    accent: "from-sky-500 to-blue-600",
    surface:
      "bg-white/90 backdrop-blur-xl border-sky-200/45 shadow-[0_8px_30px_-8px_rgba(14,165,233,0.28)]",
    glow: "bg-sky-400/25",
    iconSurface: "bg-gradient-to-br from-sky-500 to-blue-600",
    chartColor: "#0ea5e9",
  },
  {
    id: "open-installation-planned",
    title: "Installation Planned",
    subtitle: "Installation service in PLANNED status",
    countCaption: "No. of installation planned",
    countKey: "installation_planned",
    accent: "from-violet-500 to-indigo-600",
    surface:
      "bg-white/90 backdrop-blur-xl border-violet-200/45 shadow-[0_8px_30px_-8px_rgba(139,92,246,0.28)]",
    glow: "bg-violet-400/25",
    iconSurface: "bg-gradient-to-br from-violet-500 to-indigo-600",
    chartColor: "#8b5cf6",
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
    title: "Google Feedback Collected",
    subtitle: "Installation done — Google feedback marked Yes",
    countCaption: "No. of Google feedback collected",
    countKey: "feedback_collected",
    accent: "from-rose-500 to-orange-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-rose-200/40 shadow-[0_8px_30px_-8px_rgba(244,63,94,0.3)]",
    glow: "bg-rose-400/25",
    iconSurface: "bg-gradient-to-br from-rose-500 to-orange-600",
    chartColor: "#f43f5e",
  },
];

/** Total Registered detail — no sub KPI strip (pending/completed cards removed). */
export const TOTAL_REGISTERED_DETAIL_KPI_STRIP = [];

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
    detailTitle: "Google Feedback Collected",
    subtitle: "Open installations — delivery, completion & Google feedback",
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
    title: "Warranty Records",
    subtitle: "Active, expiring in 30 days & expired warranty",
    countKey: "active_warranty",
    accent: "from-emerald-500 to-teal-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-emerald-200/40 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.3)]",
    glow: "bg-emerald-400/25",
    iconSurface: "bg-gradient-to-br from-emerald-500 to-teal-600",
    chartColor: "#10b981",
  },
  {
    id: "active-amc",
    title: "AMC Records",
    subtitle: "Active, expiring in 30 days & expired AMC",
    countKey: "active_amc",
    accent: "from-blue-500 to-indigo-600",
    surface:
      "bg-white/80 backdrop-blur-xl border-blue-200/40 shadow-[0_8px_30px_-8px_rgba(59,130,246,0.35)]",
    glow: "bg-blue-400/25",
    iconSurface: "bg-gradient-to-br from-blue-500 to-indigo-600",
    chartColor: "#3b82f6",
  },
];

const SEGMENT_SET = new Set(
  SERVICE_BEFORE_INSTALLATION_SEGMENTS.map((s) => s.id),
);

const LEGACY_SBI_SEGMENT_IDS = new Set(["due-amc-expiring", "due-warranty-expiry"]);

export function isServiceBeforeInstallationSegment(id) {
  const v = String(id || "").trim();
  return SEGMENT_SET.has(v) || LEGACY_SBI_SEGMENT_IDS.has(v);
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

/** Open Complaints detail — KPI strip (complaint service records). */
export const OPEN_COMPLETIONS_COMPLAINT_KPI_CARDS = [
  {
    id: "oc-total-registered",
    field: "total_complaints_registered",
    title: "Total Complaints",
    subtitle: "Total complaints registered",
    countCaption: "Total complaints registered",
    chartColor: "#6366f1",
    surface: "border-indigo-200/60 bg-indigo-50/30",
    iconSurface: "bg-gradient-to-br from-indigo-500 to-violet-600",
    glow: "bg-indigo-400/20",
  },
  {
    id: "oc-pending",
    field: "pending_complaint",
    title: "Pending Complaint",
    subtitle: "Status: PENDING",
    chartColor: "#eab308",
    surface: "border-amber-200/60 bg-amber-50/30",
    iconSurface: "bg-gradient-to-br from-amber-500 to-orange-600",
    glow: "bg-amber-400/20",
  },
  {
    id: "oc-planned",
    field: "planned_complaint",
    title: "Planned Complaint",
    subtitle: "Status: PLANNED",
    chartColor: "#8b5cf6",
    surface: "border-violet-200/60 bg-violet-50/30",
    iconSurface: "bg-gradient-to-br from-violet-500 to-purple-600",
    glow: "bg-violet-400/20",
  },
  {
    id: "oc-completed",
    field: "completed_complaint",
    title: "Completed Cases",
    subtitle: "Total completed cases",
    countCaption: "Total completed cases",
    chartColor: "#10b981",
    surface: "border-emerald-200/60 bg-emerald-50/30",
    iconSurface: "bg-gradient-to-br from-emerald-500 to-teal-600",
    glow: "bg-emerald-400/20",
  },
  {
    id: "oc-pending-customer",
    field: "pending_by_customer",
    title: "Pending by Customer",
    subtitle: "Awaiting customer",
    chartColor: "#f43f5e",
    surface: "border-rose-200/60 bg-rose-50/30",
    iconSurface: "bg-gradient-to-br from-rose-500 to-red-600",
    glow: "bg-rose-400/20",
  },
  {
    id: "oc-pending-spares",
    field: "pending_for_spares",
    title: "Pending by Us",
    subtitle: "Unavailability of spares",
    countCaption: "Unavailability of spares",
    chartColor: "#f97316",
    surface: "border-orange-200/60 bg-orange-50/30",
    iconSurface: "bg-gradient-to-br from-orange-500 to-amber-600",
    glow: "bg-orange-400/20",
  },
  {
    id: "oc-pending-48h",
    field: "pending_over_48h_no_plan",
    title: "Pending > 48 hrs",
    subtitle: "No plan made yet",
    chartColor: "#dc2626",
    surface: "border-red-200/60 bg-red-50/30",
    iconSurface: "bg-gradient-to-br from-red-500 to-rose-600",
    glow: "bg-red-400/20",
  },
];

export function getOpenCompletionsComplaintKpiCards() {
  return OPEN_COMPLETIONS_COMPLAINT_KPI_CARDS.map((c) => ({ ...c, href: null }));
}

/** Active Warranty detail — KPI strip (warranty_products). */
export const ACTIVE_WARRANTY_DETAIL_KPI_CARDS = [
  {
    id: "aw-active",
    field: "active_warranty",
    title: "Active Warranty",
    subtitle: "Currently under warranty",
    countCaption: "Currently under warranty",
    chartColor: "#10b981",
    surface: "border-emerald-200/60 bg-emerald-50/30",
    iconSurface: "bg-gradient-to-br from-emerald-500 to-teal-600",
    glow: "bg-emerald-400/20",
  },
  {
    id: "aw-expiring-30",
    field: "expiring_30_days",
    title: "Expiring in 30 Days",
    subtitle: "Warranty ends within 30 days",
    countCaption: "Warranty ends within 30 days",
    chartColor: "#f59e0b",
    surface: "border-amber-200/60 bg-amber-50/30",
    iconSurface: "bg-gradient-to-br from-amber-500 to-orange-600",
    glow: "bg-amber-400/20",
  },
  {
    id: "aw-expired",
    field: "expired_warranty",
    title: "Expired Warranty",
    subtitle: "Warranty period ended",
    countCaption: "Warranty period ended",
    chartColor: "#64748b",
    surface: "border-slate-200/80 bg-slate-50/50",
    iconSurface: "bg-gradient-to-br from-slate-500 to-slate-600",
    glow: "bg-slate-400/20",
  },
];

const ACTIVE_WARRANTY_CARD_ID_TO_BUCKET = {
  "aw-active": "active",
  "aw-expiring-30": "expiring_30",
  "aw-expired": "expired",
};

const ACTIVE_WARRANTY_BUCKET_TO_CARD_ID = Object.fromEntries(
  Object.entries(ACTIVE_WARRANTY_CARD_ID_TO_BUCKET).map(([id, bucket]) => [bucket, id]),
);

export function getActiveWarrantyDetailKpiCards() {
  return ACTIVE_WARRANTY_DETAIL_KPI_CARDS.map((c) => ({ ...c, href: null }));
}

/** Active AMC detail — KPI strip (amc_cmc). */
export const ACTIVE_AMC_DETAIL_KPI_CARDS = [
  {
    id: "aa-active",
    field: "active_amc",
    title: "Active AMC",
    subtitle: "Currently under AMC",
    countCaption: "Currently under AMC",
    chartColor: "#3b82f6",
    surface: "border-blue-200/60 bg-blue-50/30",
    iconSurface: "bg-gradient-to-br from-blue-500 to-indigo-600",
    glow: "bg-blue-400/20",
  },
  {
    id: "aa-expiring-30",
    field: "expiring_30_days",
    title: "Expiring in 30 Days",
    subtitle: "AMC ends within 30 days",
    countCaption: "AMC ends within 30 days",
    chartColor: "#f59e0b",
    surface: "border-amber-200/60 bg-amber-50/30",
    iconSurface: "bg-gradient-to-br from-amber-500 to-orange-600",
    glow: "bg-amber-400/20",
  },
  {
    id: "aa-expired",
    field: "expired_amc",
    title: "Expired AMC",
    subtitle: "AMC period ended",
    countCaption: "AMC period ended",
    chartColor: "#64748b",
    surface: "border-slate-200/80 bg-slate-50/50",
    iconSurface: "bg-gradient-to-br from-slate-500 to-slate-600",
    glow: "bg-slate-400/20",
  },
];

const ACTIVE_AMC_CARD_ID_TO_BUCKET = {
  "aa-active": "active",
  "aa-expiring-30": "expiring_30",
  "aa-expired": "expired",
};

const ACTIVE_AMC_BUCKET_TO_CARD_ID = Object.fromEntries(
  Object.entries(ACTIVE_AMC_CARD_ID_TO_BUCKET).map(([id, bucket]) => [bucket, id]),
);

export function getActiveAmcDetailKpiCards() {
  return ACTIVE_AMC_DETAIL_KPI_CARDS.map((c) => ({ ...c, href: null }));
}

export function amcBucketFromKpiCardId(cardId) {
  return ACTIVE_AMC_CARD_ID_TO_BUCKET[String(cardId || "").trim()] || "active";
}

export function activeAmcKpiCardIdFromFilter(amcBucket) {
  const v = String(amcBucket || "active").trim().toLowerCase();
  return ACTIVE_AMC_BUCKET_TO_CARD_ID[v] || "aa-active";
}

export function getActiveAmcKpiMeta(amcBucket) {
  const cardId = activeAmcKpiCardIdFromFilter(amcBucket);
  return ACTIVE_AMC_DETAIL_KPI_CARDS.find((c) => c.id === cardId) || ACTIVE_AMC_DETAIL_KPI_CARDS[0];
}

export function warrantyBucketFromKpiCardId(cardId) {
  return ACTIVE_WARRANTY_CARD_ID_TO_BUCKET[String(cardId || "").trim()] || "active";
}

export function activeWarrantyKpiCardIdFromFilter(warrantyBucket) {
  const v = String(warrantyBucket || "active").trim().toLowerCase();
  return ACTIVE_WARRANTY_BUCKET_TO_CARD_ID[v] || "aw-active";
}

export function getActiveWarrantyKpiMeta(warrantyBucket) {
  const cardId = activeWarrantyKpiCardIdFromFilter(warrantyBucket);
  return (
    ACTIVE_WARRANTY_DETAIL_KPI_CARDS.find((c) => c.id === cardId) ||
    ACTIVE_WARRANTY_DETAIL_KPI_CARDS[0]
  );
}

const OPEN_COMPLETIONS_CARD_ID_TO_BUCKET = {
  "oc-total-registered": "total_registered",
  "oc-pending": "pending",
  "oc-planned": "planned",
  "oc-completed": "completed",
  "oc-pending-customer": "pending_by_customer",
  "oc-pending-spares": "pending_for_spares",
  "oc-pending-48h": "pending_over_48h_no_plan",
};

export function openCompletionsBucketFromKpiCardId(cardId) {
  return OPEN_COMPLETIONS_CARD_ID_TO_BUCKET[String(cardId || "").trim()] || "";
}

export function openCompletionsKpiCardIdFromFilter(openCompletionsBucket) {
  const v = String(openCompletionsBucket || "").trim().toLowerCase();
  if (!v || v === "total_registered") return "oc-total-registered";
  for (const [cardId, bucket] of Object.entries(OPEN_COMPLETIONS_CARD_ID_TO_BUCKET)) {
    if (bucket === v) return cardId;
  }
  return "";
}

export const OPEN_COMPLETIONS_TABLE_API_SLUGS = [
  "total-registered",
  "pending",
  "planned",
  "completed",
  "pending-by-customer",
  "pending-for-spares",
  "pending-over-48h",
];

export function openCompletionsApiSlugFromBucket(openCompletionsBucket) {
  const v = String(openCompletionsBucket || "").trim().toLowerCase();
  if (v === "pending_by_customer") return "pending-by-customer";
  if (v === "pending_for_spares") return "pending-for-spares";
  if (v === "pending_over_48h_no_plan") return "pending-over-48h";
  if (v === "total_registered") return "total-registered";
  if (v === "pending" || v === "planned" || v === "completed") return v;
  return "total-registered";
}

export function openCompletionsBucketFromApiSlug(slug) {
  const v = String(slug || "")
    .trim()
    .toLowerCase();
  if (v === "pending-by-customer") return "pending_by_customer";
  if (v === "pending-for-spares") return "pending_for_spares";
  if (v === "pending-over-48h" || v === "pending-over-48h-no-plan") {
    return "pending_over_48h_no_plan";
  }
  if (v === "total-registered") return "total_registered";
  if (v === "pending" || v === "planned" || v === "completed") return v;
  return "";
}

export function openCompletionsTableListApi(openCompletionsBucket) {
  const slug = openCompletionsApiSlugFromBucket(openCompletionsBucket);
  return `/api/service-before-installation/open-completions/list/${slug}`;
}

export function openCompletionsTableCountApi(openCompletionsBucket) {
  const slug = openCompletionsApiSlugFromBucket(openCompletionsBucket);
  return `/api/service-before-installation/open-completions/count/${slug}`;
}

export function openInstallationBucketFromKpiCardId(cardId) {
  if (cardId === "open-installation-delivered-pending") return "delivered_pending";
  if (cardId === "open-installation-delivery-pending") return "delivery_pending";
  if (cardId === "open-installation-planned") return "installation_planned";
  if (cardId === "open-installation-completed") return "completed";
  if (cardId === "open-installation-feedback-collected") return "feedback_collected";
  if (cardId === "open-installation-no-feedback") return "feedback_collected";
  return "";
}

export function openInstallationKpiCardIdFromFilter(openInstallationBucket) {
  const v = String(openInstallationBucket || "").trim().toLowerCase();
  if (v === "delivered_pending") return "open-installation-delivered-pending";
  if (v === "delivery_pending") return "open-installation-delivery-pending";
  if (v === "installation_planned") return "open-installation-planned";
  if (v === "completed") return "open-installation-completed";
  if (v === "feedback_collected" || v === "no_feedback")
    return "open-installation-feedback-collected";
  return "";
}

/** Path slug for per-card table APIs: /open-installation/list/{slug} */
export const OPEN_INSTALLATION_TABLE_API_SLUGS = [
  "delivered-pending",
  "delivery-pending",
  "planned",
  "completed",
  "feedback-collected",
];

export function openInstallationApiSlugFromBucket(openInstallationBucket) {
  const v = String(openInstallationBucket || "").trim().toLowerCase();
  if (v === "delivery_pending") return "delivery-pending";
  if (v === "installation_planned") return "planned";
  if (v === "completed") return "completed";
  if (v === "feedback_collected" || v === "no_feedback") return "feedback-collected";
  return "delivered-pending";
}

export function openInstallationBucketFromApiSlug(slug) {
  const v = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (v === "delivery-pending") return "delivery_pending";
  if (v === "planned" || v === "installation-planned") return "installation_planned";
  if (v === "completed") return "completed";
  if (v === "feedback-collected" || v === "no-feedback") return "feedback_collected";
  if (v === "delivered-pending") return "delivered_pending";
  return "";
}

export const OPEN_INSTALLATION_GOOGLE_FEEDBACK_API =
  "/api/service-before-installation/open-installation/google-feedback";

export function openInstallationTableListApi(openInstallationBucket) {
  const bucket = String(openInstallationBucket || "").trim().toLowerCase();
  if (bucket === "feedback_collected") return OPEN_INSTALLATION_GOOGLE_FEEDBACK_API;
  const slug = openInstallationApiSlugFromBucket(openInstallationBucket);
  return `/api/service-before-installation/open-installation/list/${slug}`;
}

export function openInstallationTableCountApi(openInstallationBucket) {
  const bucket = String(openInstallationBucket || "").trim().toLowerCase();
  if (bucket === "feedback_collected") return OPEN_INSTALLATION_GOOGLE_FEEDBACK_API;
  const slug = openInstallationApiSlugFromBucket(openInstallationBucket);
  return `/api/service-before-installation/open-installation/count/${slug}`;
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