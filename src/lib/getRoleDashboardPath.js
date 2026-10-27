import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { normalizeEmployeeRoleName } from "@/lib/employeeRoles";
import roleDashboardOverrides from "@/data/role-dashboard-overrides.json";

/**
 * Default dashboard home for a role — same rules as middleware /login redirect.
 * Custom roles use `src/data/role-dashboard-overrides.json` (synced from DB).
 */
export function getRoleDashboardPath(role) {
  const roleNorm = normalizeRoleKey(role);
  const overrideKey = normalizeEmployeeRoleName(role);
  const overridePath = roleDashboardOverrides?.[overrideKey];
  if (overridePath && String(overridePath).startsWith("/")) {
    return overridePath;
  }

  if (roleNorm === "SUPERADMIN") return "/admin-dashboard";
  if (roleNorm === "DIRECTOR") return "/director-dashboard";
  if (roleNorm === "THIRD PARTY ENGINEER") {
    return "/third-party-engineer-dashboard";
  }
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
