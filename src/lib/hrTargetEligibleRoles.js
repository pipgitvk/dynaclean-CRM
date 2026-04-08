import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Roles that see their own HR target chart row (not Superadmin). */
export const HR_TARGET_DASHBOARD_ROLES = ["HR", "HR HEAD", "HR Executive"];

export function isHrTargetDashboardRole(role) {
  const k = normalizeRoleKey(role || "");
  return HR_TARGET_DASHBOARD_ROLES.some((r) => normalizeRoleKey(r) === k);
}

/** HR roles + Superadmin (Superadmin gets all-HR data from /api/empcrm/hr-target-chart). */
export function canViewHrTargetChart(role) {
  if (isHrTargetDashboardRole(role)) return true;
  return normalizeRoleKey(role || "") === "SUPERADMIN";
}

/** Hiring page + /api/empcrm/hiring (HR roles only; not Superadmin). */
export function canAccessHiringModule(role) {
  return isHrTargetDashboardRole(role);
}
