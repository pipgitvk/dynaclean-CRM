import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Roles that see the HR target chart and can load /api/empcrm/hr-target-chart (aligned with Superadmin HR dropdown). */
export const HR_TARGET_DASHBOARD_ROLES = ["HR", "HR HEAD", "HR Executive"];

export function isHrTargetDashboardRole(role) {
  const k = normalizeRoleKey(role || "");
  return HR_TARGET_DASHBOARD_ROLES.some((r) => normalizeRoleKey(r) === k);
}
