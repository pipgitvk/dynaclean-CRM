import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/**
 * Default dashboard home for a role — same rules as middleware /login redirect.
 * GEM and other unmapped roles stay on /user-dashboard.
 */
export function getRoleDashboardPath(role) {
  const roleNorm = normalizeRoleKey(role);

  if (roleNorm === "SUPERADMIN") return "/admin-dashboard";
  if (roleNorm === "DIRECTOR") return "/director-dashboard";
  if (roleNorm.includes("SALES")) return "/sales-dashboard";
  if (roleNorm.includes("SERVICE") && roleNorm.includes("HEAD")) {
    return "/service-head-dashboard";
  }
  if (roleNorm.includes("HR")) return "/hr-dashboard";
  if (roleNorm.includes("DIGITAL") || roleNorm.includes("MARKETER")) {
    return "/digital-marketing-dashboard";
  }
  if (roleNorm.includes("ACCOUNTANT")) return "/accounts-dashboard";

  return "/user-dashboard";
}
