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

/**
 * @param {{ commitmentYear?: number|null, commitmentMonth?: number|null, commitmentDay?: number|null, createdBy?: string|null, adminSearch?: string|null }|null|undefined} adminFilters
 */
export function buildProspectsRowsApiUrl(
  customerIds,
  searchText,
  adminFilters = null,
) {
  const params = new URLSearchParams();
  if (customerIds.length > 0) {
    params.set("customers", customerIds.join(","));
  }
  const s = String(searchText ?? "").trim();
  if (s) params.set("search", s);
  if (adminFilters) {
    const y = adminFilters.commitmentYear;
    if (y != null && Number.isFinite(Number(y))) {
      params.set("commitment_year", String(Number(y)));
    }
    const m = adminFilters.commitmentMonth;
    if (m != null && Number.isFinite(Number(m))) {
      params.set("commitment_month", String(Number(m)));
    }
    const d = adminFilters.commitmentDay;
    if (d != null && Number.isFinite(Number(d))) {
      params.set("commitment_day", String(Number(d)));
    }
    const cb = String(adminFilters.createdBy ?? "").trim();
    if (cb) params.set("created_by", cb.slice(0, 128));
    const aq = String(adminFilters.adminSearch ?? "").trim();
    if (aq) params.set("admin_search", aq.slice(0, 200));
  }
  const q = params.toString();
  return q ? `/api/prospects/rows?${q}` : "/api/prospects/rows";
}

function parseYear(raw) {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return null;
  return n;
}

function parseMonth(raw) {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return n;
}

function parseDay(raw) {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n;
}

function buildAdminFiltersFromGetter(get) {
  const year = parseYear(get("commitment_year"));
  const month = parseMonth(get("commitment_month"));
  const day = parseDay(get("commitment_day"));
  const createdByRaw = String(get("created_by") ?? "").trim();
  const createdBy =
    createdByRaw.length > 0 ? createdByRaw.slice(0, 128) : null;
  const adminSearchRaw = String(get("admin_search") ?? "").trim();
  const adminSearch =
    adminSearchRaw.length > 0 ? adminSearchRaw.slice(0, 200) : null;
  if (
    year == null &&
    month == null &&
    day == null &&
    !createdBy &&
    !adminSearch
  ) {
    return null;
  }
  return {
    commitmentYear: year,
    commitmentMonth: month,
    commitmentDay: day,
    createdBy,
    adminSearch,
  };
}

/** Parse admin-only query params from Next.js `searchParams` (caller must verify role). */
export function parseProspectsAdminFiltersFromSearchParams(resolved) {
  return buildAdminFiltersFromGetter((k) => firstSearchParam(resolved?.[k]));
}

/** Parse admin-only params from `URLSearchParams` (e.g. API route). */
export function parseProspectsAdminFiltersFromUrlSearchParams(sp) {
  return buildAdminFiltersFromGetter((k) => String(sp.get(k) ?? "").trim());
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
