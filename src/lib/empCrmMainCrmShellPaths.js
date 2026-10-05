/** EMPCRM user URLs that render with the role’s main CRM sidebar (not EMPCRM mini-sidebar). */
export function isEmpCrmRouteOnMainCrmShell(pathname) {
  const p = String(pathname || "").replace(/\/+$/, "");
  if (p === "/empcrm/user-dashboard") return true;
  return p.startsWith("/empcrm/user-dashboard/");
}

/** Base path for employee self-service links (settings returnTo, etc.). */
export function getEmployeeSelfServiceBaseFromPathname(pathname) {
  const p = String(pathname || "");
  if (p.startsWith("/sales-dashboard")) return "/sales-dashboard";
  return "/empcrm/user-dashboard";
}
