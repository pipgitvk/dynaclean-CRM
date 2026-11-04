/**
 * Meta credentials UI is shared under admin-dashboard and sales-dashboard.
 */
export function getDashboardPrefixFromPathname(pathname) {
  const first = String(pathname || "")
    .split("/")
    .filter(Boolean)[0];
  if (first === "sales-dashboard") return "/sales-dashboard";
  if (first === "director-dashboard") return "/director-dashboard";
  return "/admin-dashboard";
}

export function metaCredentialsBase(pathname) {
  return `${getDashboardPrefixFromPathname(pathname)}/meta-credentials`;
}

export function metaLeadsToolBase(pathname) {
  return getDashboardPrefixFromPathname(pathname);
}
