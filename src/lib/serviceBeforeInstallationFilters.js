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
  range: SBI_RANGE_SELECT.id,
};

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
  };
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