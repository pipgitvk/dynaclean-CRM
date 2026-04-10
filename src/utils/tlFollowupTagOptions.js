/** TL follow-up tag chips — shared by form and API sanitization */

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
];

/** Only superadmin may set these in TL management (admin TL follow-up + API). */
export const SUPERADMIN_ONLY_TL_TAGS = ["order-recieved", "cancel order"];

export function getTlTagOptions(showSuperAdminTlTags) {
  return showSuperAdminTlTags
    ? [...BASE_TL_TAG_OPTIONS, ...SUPERADMIN_ONLY_TL_TAGS]
    : [...BASE_TL_TAG_OPTIONS];
}

/** Tag filter dropdown order on TL customers list (`TLCustomersTable`) */
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
];

export function getTlCustomersTableTagOptions(showSuperAdminTlTags) {
  return showSuperAdminTlTags
    ? [...TL_CUSTOMERS_TABLE_BASE_TAGS, ...SUPERADMIN_ONLY_TL_TAGS]
    : [...TL_CUSTOMERS_TABLE_BASE_TAGS];
}

/**
 * Strips superadmin-only tags from stored value when the caller is not superadmin.
 * Accepts comma-separated tags (with or without spaces after commas).
 */
export function sanitizeMultiTagForRole(multiTag, role) {
  const r = String(role ?? "").trim().toLowerCase();
  if (r === "superadmin") {
    return multiTag == null || multiTag === "" ? null : String(multiTag);
  }
  if (multiTag == null || multiTag === "") return null;
  const parts = String(multiTag)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const filtered = parts.filter((t) => !SUPERADMIN_ONLY_TL_TAGS.includes(t));
  return filtered.length ? filtered.join(", ") : null;
}
