/** Append `embed=1` for iframe popups (navbar / modals). */
export function withEmbedQuery(path) {
  if (!path) return path;
  return path.includes("?") ? `${path}&embed=1` : `${path}?embed=1`;
}

export const DASHBOARD_EMBED_COOKIE = "dashboard_embed";

export function isDashboardEmbedFromSearchParams(searchParams) {
  const raw = searchParams?.embed ?? searchParams?.get?.("embed");
  return raw === "1" || raw === 1;
}

/** Server pages: `?embed=1` or middleware `x-dashboard-embed` (iframe child navigations). */
export function isDashboardEmbedPage(searchParams, requestHeaders) {
  if (isDashboardEmbedFromSearchParams(searchParams)) return true;
  const hdr =
    typeof requestHeaders?.get === "function"
      ? requestHeaders.get("x-dashboard-embed")
      : requestHeaders?.["x-dashboard-embed"];
  return hdr === "1";
}
