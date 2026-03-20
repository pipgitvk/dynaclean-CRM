/**
 * If the user typed a quotation id in the prospects search box (e.g. QUOTE20260320011),
 * return it so Add Prospects can pass quote_number and load all quotation_items lines.
 */
export function extractQuoteNumberFromProspectSearch(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const m = t.match(/\b(QUOTE[^\s,]+)\b/i);
  return m ? m[1].trim() : null;
}

/** Next.js searchParams value may be string | string[]. */
export function firstSearchParam(value) {
  if (value == null) return "";
  return String(Array.isArray(value) ? value[0] : value).trim();
}

/** Parse comma-separated customer IDs from URL; cap count for safety. */
export function parseCustomerIdsParam(raw) {
  if (raw == null || typeof raw !== "string") return [];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)].slice(0, 50);
}

/** Parse comma-separated quote numbers; parallel to customer IDs. */
export function parseQuoteNumbersParam(raw) {
  if (raw == null || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
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

export function buildProspectsPageUrl(customerIds, searchText, quoteNumbers = []) {
  const params = new URLSearchParams();
  if (customerIds.length > 0) {
    params.set("customers", customerIds.join(","));
  }
  const s = String(searchText ?? "").trim();
  if (s) params.set("search", s);
  if (
    Array.isArray(quoteNumbers) &&
    quoteNumbers.length === customerIds.length &&
    quoteNumbers.some(Boolean)
  ) {
    params.set("quote_numbers", quoteNumbers.join(","));
  }
  const q = params.toString();
  return q ? `/admin-dashboard/prospects?${q}` : "/admin-dashboard/prospects";
}
