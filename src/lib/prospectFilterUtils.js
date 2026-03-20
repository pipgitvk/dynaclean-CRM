/** Parse comma-separated customer IDs from URL; cap count for safety. */
export function parseCustomerIdsParam(raw) {
  if (raw == null || typeof raw !== "string") return [];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)].slice(0, 50);
}

export function buildProspectsRowsApiUrl(customerIds, searchText) {
  const params = new URLSearchParams();
  if (customerIds.length > 0) {
    params.set("customers", customerIds.join(","));
  }
  const s = String(searchText ?? "").trim();
  if (s) params.set("search", s);
  const q = params.toString();
  return q ? `/api/prospects/rows?${q}` : "/api/prospects/rows";
}

export function buildProspectsPageUrl(customerIds, searchText) {
  const params = new URLSearchParams();
  if (customerIds.length > 0) {
    params.set("customers", customerIds.join(","));
  }
  const s = String(searchText ?? "").trim();
  if (s) params.set("search", s);
  const q = params.toString();
  return q ? `/admin-dashboard/prospects?${q}` : "/admin-dashboard/prospects";
}
