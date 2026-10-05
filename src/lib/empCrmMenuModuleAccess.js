import { isModuleKeyAllowed } from "@/lib/moduleAccess";

/** EMPCRM admin sidebar paths gated by Global Module Access keys. */
export const EMPCRM_ADMIN_PATH_MODULE_KEY = {
  "/empcrm/admin-dashboard/attendance-sheet": "attendance-sheet",
  "/empcrm/admin-dashboard/attendance-rules": "attendance-rules",
  "/empcrm/admin-dashboard/salary": "salary-management",
  "/empcrm/admin-dashboard/salary-sheet": "salary-sheet",
  "/empcrm/admin-dashboard/salary-slips": "salary-slips",
};

/**
 * Drop EMPCRM links the user has not been granted (non-SUPERADMIN).
 * Paths without a mapping stay visible if role already allowed them.
 */
export function filterEmpCrmAdminMenuByModuleAccess(menuItems, allowedModules) {
  if (!Array.isArray(menuItems)) return [];
  const allowed = allowedModules ?? [];
  return menuItems.filter((item) => {
    const key = EMPCRM_ADMIN_PATH_MODULE_KEY[item.path];
    if (!key) return true;
    return isModuleKeyAllowed(key, allowed);
  });
}
