/** TL follow-up tag chips — shared by form and TL customers filter */

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
  "Postponing",
  "Declined",
  "Clear",
  "order-recieved",
  "cancel order",
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
  "Postponing",
  "Declined",
  "Clear",
  "order-recieved",
  "cancel order",
];

/** Only one of these may be selected at a time in TL follow-up (mutually exclusive). */
export const TL_MUTEX_TAG_PAIR = ["Postponing", "Declined"];

/**
 * If both Postponing and Declined appear, keeps the last one (edit/load safety).
 */
export function dedupeMutuallyExclusiveTlTags(tags) {
  const mutex = TL_MUTEX_TAG_PAIR;
  const other = tags.filter((t) => !mutex.includes(t));
  const mutexHits = tags.filter((t) => mutex.includes(t));
  if (mutexHits.length === 0) return [...tags];
  return [...other, mutexHits[mutexHits.length - 1]];
}

export function getTlCustomersTableTagOptions() {
  return [...TL_CUSTOMERS_TABLE_BASE_TAGS];
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
  if (norm.includes("strong") && norm.includes("follow")) {
    return `${base} bg-yellow-100 text-yellow-900 border border-yellow-300/90`;
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
  if (norm === "postponing" || norm === "declined") {
    return `${base} bg-orange-100 text-orange-900 border border-orange-300/90`;
  }

  return `${base} bg-slate-500 text-white`;
}
