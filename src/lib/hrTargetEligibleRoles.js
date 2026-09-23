import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Roles that see their own HR target chart row (not Superadmin). */
export const HR_TARGET_DASHBOARD_ROLES = ["HR", "HR HEAD", "HR Executive", "JUNIOR HR EXECUTIVE", "HR RECRUITER"];

export function isHrTargetDashboardRole(role) {
  const k = normalizeRoleKey(role || "");
  return HR_TARGET_DASHBOARD_ROLES.some((r) => normalizeRoleKey(r) === k);
}

/** HR roles + Superadmin (Superadmin gets all-HR data from /api/empcrm/hr-target-chart). */
export function canViewHrTargetChart(role) {
  if (isHrTargetDashboardRole(role)) return true;
  return normalizeRoleKey(role || "") === "SUPERADMIN";
}

export function isEmpCrmHrAdmin(role) {
  const k = normalizeRoleKey(role || "");
  return k === "SUPERADMIN" || k === "DIRECTOR";
}

/** Hiring page + /api/empcrm/hiring (HR roles + Superadmin/Director). */
export function canAccessHiringModule(role) {
  if (isEmpCrmHrAdmin(role)) return true;
  if (isHrTargetDashboardRole(role)) return true;
  return false;
}
