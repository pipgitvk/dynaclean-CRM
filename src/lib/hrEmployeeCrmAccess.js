import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import {
  ADMIN_EMPLOYEE_CRM_MODULES,
  HR_ADMIN_EMPLOYEE_CRM_MODULE_KEYS,
  HR_ONLY_MODULE_KEYS,
  isHrOperationsKeyDuplicatedInAdminEmployeeCrm,
  resolveEmpCrmAdminModuleKey,
} from "@/lib/adminEmployeeCrmModules";

export { isHrOperationsKeyDuplicatedInAdminEmployeeCrm };

const EMP_PREFIX = "/empcrm/admin-dashboard";
const HR_PREFIX = "/hr-dashboard/admin-crm";

export {
  ADMIN_EMPLOYEE_CRM_MODULES,
  HR_ADMIN_EMPLOYEE_CRM_MODULE_KEYS,
  HR_ONLY_MODULE_KEYS,
};

/** HR sidebar section title (not nested under Employee CRM). */
export const HR_ADMIN_EMPLOYEE_CRM_MENU_NAME = "Admin Employee CRM";

const HR_PATH_OVERRIDES = {
  "/empcrm/admin-dashboard/attendance-rules": "/hr-dashboard/attendance-rules",
  "/empcrm/admin-dashboard/hiring": "/hr-dashboard/hiring",
  "/empcrm/admin-dashboard/salary-slips": "/hr-dashboard/salary-slips",
  "/empcrm/admin-dashboard/salary-sheet": "/hr-dashboard/salary-sheet",
};

const HR_ADMIN_EMPLOYEE_CRM_KEY_SET = new Set(HR_ADMIN_EMPLOYEE_CRM_MODULE_KEYS);

export function isHrEmployeeCrmRole(roleKey) {
  const r = normalizeRoleKey(roleKey) || String(roleKey || "").trim().toUpperCase();
  if (!r || r === "GUEST" || r === "SUPERADMIN" || r === "DIRECTOR" || r === "EA") {
    return false;
  }
  return (
    r === "HR" ||
    r === "HR HEAD" ||
    r === "HR EXECUTIVE" ||
    r === "JUNIOR HR EXECUTIVE" ||
    r === "HR RECRUITER" ||
    r.includes("HR")
  );
}

export function stripHrOnlyModulesForNonHrRoles(allowedKeys, role) {
  if (!Array.isArray(allowedKeys)) return allowedKeys;
  if (isHrEmployeeCrmRole(role)) return allowedKeys;
  return allowedKeys.filter((k) => !HR_ONLY_MODULE_KEYS.includes(k));
}

export function mapEmpCrmAdminPathToHrDashboard(path) {
  const p = String(path || "").trim();
  if (HR_PATH_OVERRIDES[p]) return HR_PATH_OVERRIDES[p];
  if (!p.startsWith(EMP_PREFIX)) return p;
  if (p === EMP_PREFIX) return HR_PREFIX;
  return `${HR_PREFIX}${p.slice(EMP_PREFIX.length)}`;
}

export function shouldHideEmployeesGroupLeafForHrRole(moduleKey) {
  return HR_ADMIN_EMPLOYEE_CRM_KEY_SET.has(moduleKey);
}

export function toHrEmployeeCrmSidebarItem(item) {
  if (!item?.path) return null;
  const moduleKey = resolveEmpCrmAdminModuleKey(item.path, item.moduleKey);
  return {
    path: mapEmpCrmAdminPathToHrDashboard(item.path),
    name: item.name,
    icon: item.icon,
    roles: ["ALL"],
    ...(moduleKey ? { moduleKey } : {}),
    ...(item.badgeCount != null ? { badgeCount: item.badgeCount } : {}),
  };
}
