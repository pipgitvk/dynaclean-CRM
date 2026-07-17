/** Stored label for postpone + declined intent (replaces legacy `"Postponing"`). */
export const TL_POSTPONDING_DECLINED_TAG = "Postponding/Declined";

export const BASE_TL_TAG_OPTIONS = [
  "Demo",
  "Prime",
  "Repeat order",
  "Mail",
  "Truck FollowUp",
  "Payment Collection",
  "Strong FollowUp",
  "Service Issue",
  "Running Orders",
  TL_POSTPONDING_DECLINED_TAG,
  "Clear",
  "order-recieved",
  "cancel order",
  "Delhi-Visiting",
  "Tamilnadu-Visiting",
  "Municipal",
];

export function getTlTagOptions() {
  return [...BASE_TL_TAG_OPTIONS];
}

/** Tag filter order on TL customers list (`TLCustomersTable`) */
export const TL_CUSTOMERS_TABLE_BASE_TAGS = [
  "Demo",
  "Payment Collection",
  "Truck FollowUp",
  "Strong FollowUp",
  "Service Issue",
  "Prime",
  "Repeat order",
  "Mail",
  "Running Orders",
  TL_POSTPONDING_DECLINED_TAG,
  "Clear",
  "order-recieved",
  "cancel order",
  "Delhi-Visiting",
  "Tamilnadu-Visiting",
  "Municipal",
];

export function getTlCustomersTableTagOptions() {
  return [...TL_CUSTOMERS_TABLE_BASE_TAGS];
}

/** Map old DB value `Postponing` → {@link TL_POSTPONDING_DECLINED_TAG}. */
export function normalizeLegacyPostponingTagLabel(tag) {
  const s = String(tag).trim();
  if (s === "Postponing") return TL_POSTPONDING_DECLINED_TAG;
  return s;
}

const CHIP_BASE_TABLE =
  "px-2 py-1 text-xs font-medium rounded shadow-sm";

/** Larger chips on TL follow-up edit form — same colours as table */
const CHIP_BASE_FORM =
  "px-4 py-2 text-sm font-medium rounded-md shadow-sm";

/**
 * Tailwind classes for multi-tag chips (matches known tag labels, case-insensitive).
 * @param {"table"|"form"} [variant="table"] — `form` uses bigger padding for TL follow-up edit checkboxes
 */
export function getTlMultiTagChipClass(rawTag, variant = "table") {
  const base = variant === "form" ? CHIP_BASE_FORM : CHIP_BASE_TABLE;

  const norm = String(rawTag)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, " ");

  if (norm.includes("payment") && norm.includes("collection")) {
    return `${base} bg-purple-600 text-white`;
  }
  if (norm.includes("service") && norm.includes("issue")) {
    return `${base} bg-pink-500 text-white`;
  }
  if (norm.includes("truck") && norm.includes("follow")) {
    return `${base} bg-orange-200 text-orange-900 border border-orange-300/90`;
  }
  if (norm.includes("strong") && norm.includes("follow")) {
    return `${base} bg-yellow-600 text-white border border-yellow-700/90 font-semibold`;
  }
  if (norm.includes("repeat") && norm.includes("order")) {
    return `${base} bg-blue-200 text-blue-900 border border-blue-400/90 shadow-md`;
  }
  if (norm.includes("running") && norm.includes("order")) {
    return `${base} bg-emerald-200 text-emerald-900 border border-emerald-400/90`;
  }
  if (norm.includes("cancel") && norm.includes("order")) {
    return `${base} bg-red-600 text-white`;
  }
  if (
    norm.includes("order") &&
    (norm.includes("received") || norm.includes("recieved"))
  ) {
    return `${base} bg-green-600 text-white`;
  }
  if (norm === "prime") {
    return `${base} bg-yellow-400 text-yellow-950`;
  }
  if (norm === "postponding/declined" || norm === "postponing") {
    return `${base} bg-orange-100 text-orange-900 border border-orange-300/90`;
  }
  if (norm.includes("delhi") && norm.includes("visiting")) {
    return `${base} bg-gradient-to-r from-rose-400 to-pink-500 text-white font-bold shadow-lg`;
  }
  if (norm.includes("tamilnadu") && norm.includes("visiting")) {
    return `${base} bg-gradient-to-r from-rose-400 to-pink-500 text-white font-bold shadow-lg`;
  }
  if (norm === "municipal") {
    return `${base} bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold shadow-lg`;
  }

  return `${base} bg-slate-500 text-white`;
}
