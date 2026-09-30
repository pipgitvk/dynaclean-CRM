import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { getRoleDashboardPath } from "@/lib/getRoleDashboardPath";

export function getProspectSubmissionsPagePath(role) {
  const roleNorm = normalizeRoleKey(role || "");
  if (roleNorm === "SUPERADMIN" || roleNorm === "ADMIN" || roleNorm === "EA") {
    return "/admin-dashboard/prospect-submissions";
  }
  const base = getRoleDashboardPath(role);
  return `${base}/prospect-submissions`;
}

export function isDashboardHomePath(pathname) {
  const normalized = String(pathname || "").replace(/\/$/, "") || "/";
  const homes = new Set([
    "/user-dashboard",
    "/sales-dashboard",
    "/service-head-dashboard",
    "/hr-dashboard",
    "/accounts-dashboard",
    "/digital-marketing-dashboard",
    "/director-dashboard",
    "/gem-dashboard",
    "/empcrm/user-dashboard",
  ]);
  return homes.has(normalized);
}
