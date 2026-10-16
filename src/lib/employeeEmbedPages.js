/** Pages with fewer than this many primary inputs open in a compact iframe popup. */
export const EMPLOYEE_POPUP_MAX_FIELDS = 10;

export const EMPLOYEE_PAGE_FIELD_COUNT = {
  password: 1,
  "ip-restrictions": 2,
  "global-ip-restrictions": 4,
  "quick-edit": 12,
};

/** Always open in popup from employees list (even when field count ≥ threshold). */
export const EMPLOYEE_PAGES_IN_POPUP = new Set([
  "password",
  "ip-restrictions",
  "global-ip-restrictions",
  "quick-edit",
]);

export function shouldUseEmployeeIframePopup(pageKey) {
  if (EMPLOYEE_PAGES_IN_POPUP.has(pageKey)) return true;
  const count = EMPLOYEE_PAGE_FIELD_COUNT[pageKey];
  if (count == null) return false;
  return count < EMPLOYEE_POPUP_MAX_FIELDS;
}

export function buildEmployeeSubPagePath(dashboardPrefix, pageKey, username) {
  const prefix = String(dashboardPrefix || "admin-dashboard").replace(/^\/|\/$/g, "");
  if (pageKey === "global-ip-restrictions") {
    return `/${prefix}/ip-restrictions`;
  }
  const user = encodeURIComponent(String(username || "").trim());
  return `/${prefix}/${pageKey}/${user}`;
}

export function withEmbedQuery(path) {
  if (!path) return path;
  return path.includes("?") ? `${path}&embed=1` : `${path}?embed=1`;
}

/** Fixed iframe height (px) — avoids huge empty area inside the modal. */
export function iframeHeightForPage(pageKey) {
  switch (pageKey) {
    case "password":
      return 260;
    case "ip-restrictions":
      return 400;
    case "global-ip-restrictions":
      return 720;
    case "quick-edit":
      return 720;
    default:
      return 480;
  }
}

export function modalWidthClassForPage(pageKey) {
  if (pageKey === "password") return "max-w-md";
  if (pageKey === "ip-restrictions") return "max-w-lg";
  if (pageKey === "global-ip-restrictions" || pageKey === "quick-edit") return "max-w-4xl";
  return "max-w-xl";
}

/** Optional max height for tall modals (viewport-based). */
export function modalMaxHeightClassForPage(pageKey) {
  if (pageKey === "global-ip-restrictions" || pageKey === "quick-edit") return "max-h-[92vh]";
  return "max-h-[90vh]";
}

export function usesViewportIframeHeight(pageKey) {
  return pageKey === "global-ip-restrictions" || pageKey === "quick-edit";
}

/** Shrink iframe to page content (password, per-user IP). */
export function usesAutoIframeHeight(pageKey) {
  return pageKey === "password" || pageKey === "ip-restrictions";
}

export function maxAutoIframeHeight(pageKey) {
  if (pageKey === "ip-restrictions") return 520;
  if (pageKey === "password") return 280;
  return 600;
}
