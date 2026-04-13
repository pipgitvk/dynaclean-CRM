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
  "Clear",
  "order-recieved",
  "cancel order",
];

export function getTlCustomersTableTagOptions() {
  return [...TL_CUSTOMERS_TABLE_BASE_TAGS];
}

const CHIP_BASE =
  "px-2 py-1 text-xs font-medium rounded shadow-sm";

/**
 * Tailwind classes for multi-tag chips on TL customers table (matches known tag labels, case-insensitive).
 */
export function getTlMultiTagChipClass(rawTag) {
  const norm = String(rawTag)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, " ");

  if (norm.includes("payment") && norm.includes("collection")) {
    return `${CHIP_BASE} bg-purple-600 text-white`;
  }
  if (norm.includes("service") && norm.includes("issue")) {
    return `${CHIP_BASE} bg-pink-500 text-white`;
  }
  if (norm.includes("strong") && norm.includes("follow")) {
    return `${CHIP_BASE} bg-blue-600 text-white`;
  }
  if (norm.includes("running") && norm.includes("order")) {
    return `${CHIP_BASE} bg-emerald-200 text-emerald-900 border border-emerald-400/90`;
  }
  if (norm.includes("cancel") && norm.includes("order")) {
    return `${CHIP_BASE} bg-red-600 text-white`;
  }
  if (
    norm.includes("order") &&
    (norm.includes("received") || norm.includes("recieved"))
  ) {
    return `${CHIP_BASE} bg-green-600 text-white`;
  }
  if (norm === "prime") {
    return `${CHIP_BASE} bg-yellow-400 text-yellow-950`;
  }

  return `${CHIP_BASE} bg-slate-500 text-white`;
}
