import { LEADS_HUB_RANGE_OPTIONS, resolveLeadsHubRange } from "@/lib/leadsManageHubRange";

export const SBI_RANGE_SELECT = { id: "select", label: "Select" };

export const EMPTY_SBI_FILTERS = {
  search: "",
  model: "",
  state: "",
  serial: "",
  from: "",
  to: "",
  itemType: "",
  assignedTo: "",
  serviceStatus: "",
  salesPerson: "",
  serviceEngineer: "",
  thirdPartyEngineer: "",
  /** open-installation: order booking / dispatch coordinator */
  assignedBy: "",
  /** open-installation: warranty registration creator */
  registeredBy: "",
  /** total-registered KPI: "" | "pending" | "completed" */
  registeredInstallation: "",
  /** open-installation KPI: "" | "delivered_pending" | "delivery_pending" | "completed" | "feedback_collected" */
  openInstallationBucket: "",
  /** open-installation list: "" | "registered" | "not_registered" */
  warrantyRegistration: "",
  /** open-installation list: "" | "delivered" | "not_delivered" */
  orderDeliveryStatus: "",
  range: SBI_RANGE_SELECT.id,
};

function normalizeRegisteredInstallation(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "pending" || v === "completed") return v;
  return "";
}

/** Hub header period dropdown */
export const SBI_HUB_PERIOD_OPTIONS = [SBI_RANGE_SELECT, ...LEADS_HUB_RANGE_OPTIONS];

/** Detail list filters — period + optional all-time */
export const SBI_PERIOD_OPTIONS = [
  SBI_RANGE_SELECT,
  { id: "all", label: "All time" },
  ...LEADS_HUB_RANGE_OPTIONS,
];

/** Apply hub period preset to filter draft (sets from/to for API). */
export function sbiFiltersWithRange(rangeKey, base = EMPTY_SBI_FILTERS, custom = {}) {
  const range = String(rangeKey || SBI_RANGE_SELECT.id).trim().toLowerCase();
  if (range === SBI_RANGE_SELECT.id) {
    return { ...base, range: SBI_RANGE_SELECT.id, from: "", to: "" };
  }
  if (!range || range === "all") {
    return { ...base, range: "all", from: "", to: "" };
  }
  if (range === "custom") {
    const from = String(custom.from ?? base.from ?? "").trim();
    const to = String(custom.to ?? base.to ?? "").trim();
    return { ...base, range: "custom", from, to };
  }
  const resolved = resolveLeadsHubRange(range, custom);
  return { ...base, range, from: resolved.from, to: resolved.to };
}

export function defaultSbiSelectFilters() {
  return sbiFiltersWithRange(SBI_RANGE_SELECT.id);
}

/** Preset: Current Month (till today). */
export function defaultSbiMonthFilters() {
  return sbiFiltersWithRange("month");
}

export function parseSbiFilters(input) {
  const src = input || {};
  return {
    search: String(src.search ?? src.q ?? "").trim(),
    model: String(src.model ?? "").trim(),
    state: String(src.state ?? "").trim(),
    serial: String(src.serial ?? "").trim(),
    from: String(src.from ?? "").trim(),
    to: String(src.to ?? "").trim(),
    itemType: normalizeOrderItemType(src.itemType ?? src.item_type),
    assignedTo: String(src.assignedTo ?? src.assigned_to ?? "").trim(),
    serviceStatus: String(src.serviceStatus ?? src.service_status ?? src.status ?? "").trim(),
    salesPerson: String(src.salesPerson ?? src.sales_person ?? "").trim(),
    serviceEngineer: String(src.serviceEngineer ?? src.service_engineer ?? "").trim(),
    thirdPartyEngineer: String(src.thirdPartyEngineer ?? src.third_party_engineer ?? "").trim(),
    assignedBy: String(src.assignedBy ?? src.assigned_by ?? "").trim(),
    registeredBy: String(src.registeredBy ?? src.registered_by ?? "").trim(),
    registeredInstallation: normalizeRegisteredInstallation(
      src.registeredInstallation ?? src.registered_installation,
    ),
    openInstallationBucket: normalizeOpenInstallationBucket(
      src.openInstallationBucket ?? src.open_installation_bucket,
    ),
    warrantyRegistration: normalizeWarrantyRegistration(
      src.warrantyRegistration ?? src.warranty_registration ?? src.registration,
    ),
    orderDeliveryStatus: normalizeOrderDeliveryStatus(
      src.orderDeliveryStatus ?? src.order_delivery_status,
    ),
  };
}

/** Parse SBI filters from URLSearchParams (API routes). */
export function parseSbiFiltersFromSearchParams(searchParams) {
  return parseSbiFilters({
    search: searchParams.get("search"),
    q: searchParams.get("q"),
    model: searchParams.get("model"),
    state: searchParams.get("state"),
    serial: searchParams.get("serial"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    itemType: searchParams.get("itemType") ?? searchParams.get("item_type"),
    assignedTo: searchParams.get("assignedTo") ?? searchParams.get("assigned_to"),
    serviceStatus: searchParams.get("serviceStatus") ?? searchParams.get("service_status"),
    salesPerson: searchParams.get("salesPerson") ?? searchParams.get("sales_person"),
    serviceEngineer: searchParams.get("serviceEngineer") ?? searchParams.get("service_engineer"),
    thirdPartyEngineer:
      searchParams.get("thirdPartyEngineer") ?? searchParams.get("third_party_engineer"),
    registeredInstallation:
      searchParams.get("registeredInstallation") ?? searchParams.get("registered_installation"),
    openInstallationBucket:
      searchParams.get("openInstallationBucket") ?? searchParams.get("open_installation_bucket"),
    warrantyRegistration:
      searchParams.get("warrantyRegistration") ??
      searchParams.get("warranty_registration") ??
      searchParams.get("registration"),
    orderDeliveryStatus:
      searchParams.get("orderDeliveryStatus") ?? searchParams.get("order_delivery_status"),
    assignedBy: searchParams.get("assignedBy") ?? searchParams.get("assigned_by"),
    registeredBy: searchParams.get("registeredBy") ?? searchParams.get("registered_by"),
  });
}

function normalizeOrderDeliveryStatus(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "delivered") return "delivered";
  if (v === "not_delivered" || v === "not-delivered" || v === "pending") {
    return "not_delivered";
  }
  return "";
}

function normalizeWarrantyRegistration(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "registered" || v === "yes" || v === "1") return "registered";
  if (v === "not_registered" || v === "unregistered" || v === "no" || v === "0") {
    return "not_registered";
  }
  return "";
}

function normalizeOpenInstallationBucket(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    v === "delivered_pending" ||
    v === "delivery_pending" ||
    v === "completed" ||
    v === "feedback_collected" ||
    v === "no_feedback"
  ) {
    if (v === "no_feedback") return "feedback_collected";
    return v;
  }
  return "";
}

function normalizeOrderItemType(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "products" || v === "product") return "products";
  if (v === "spares" || v === "spare") return "spares";
  return "";
}

export function hasActiveSbiFilters(filters) {
  const f = parseSbiFilters(filters);
  return Object.values(f).some(Boolean);
}

export function sbiFiltersToQueryString(filters) {
  const f = parseSbiFilters(filters);
  const p = new URLSearchParams();
  for (const [key, val] of Object.entries(f)) {
    if (val) p.set(key, val);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}