/** Global Module Access + EMPCRM admin path mapping (Admin Employee CRM). */

export const ADMIN_EMPLOYEE_CRM_MODULES = [
  { key: "hr-employee-registry", label: "Employees (HR registry)" },
  { key: "admin-crm-dashboard", label: "EMPCRM Dashboard" },
  { key: "admin-crm-profile", label: "Profile Management" },
  { key: "admin-crm-profile-approvals", label: "Profile Approvals" },
  { key: "admin-crm-leave", label: "Leave Management" },
  { key: "admin-crm-attendance-summary", label: "Attendance Summary" },
  { key: "attendance-sheet", label: "Attendance Sheet" },
  { key: "attendance-details", label: "Attendance details" },
  { key: "auto-checkout-approvals", label: "Auto check-out approval" },
  { key: "machine-attendance", label: "Machine Attendance" },
  { key: "attendance-rules", label: "Attendance Rules" },
  { key: "admin-crm-documents", label: "Employee Documents" },
  { key: "salary-management", label: "Salary Management" },
  { key: "salary-sheet", label: "Salary Sheet" },
  { key: "salary-slips", label: "Salary slips" },
];

export const HR_ADMIN_EMPLOYEE_CRM_MODULE_KEYS = ADMIN_EMPLOYEE_CRM_MODULES.map(
  (m) => m.key,
);

export const HR_ONLY_MODULE_KEYS = [...HR_ADMIN_EMPLOYEE_CRM_MODULE_KEYS];

/** Shown under Admin Employee CRM for HR — hide same keys from HR Operations (GMA + sidebar). */
export const HR_OPERATIONS_KEYS_IN_ADMIN_EMPLOYEE_CRM = new Set([
  "attendance-rules",
  "salary-management",
  "salary-sheet",
  "salary-slips",
  "attendance-sheet",
]);

export function isHrOperationsKeyDuplicatedInAdminEmployeeCrm(moduleKey) {
  return HR_OPERATIONS_KEYS_IN_ADMIN_EMPLOYEE_CRM.has(
    String(moduleKey || "").trim(),
  );
}

export const EMPCRM_ADMIN_PATH_MODULE_KEY = {
  "/empcrm/admin-dashboard": "admin-crm-dashboard",
  "/empcrm/admin-dashboard/profile": "admin-crm-profile",
  "/empcrm/admin-dashboard/profile/approvals": "admin-crm-profile-approvals",
  "/empcrm/admin-dashboard/leave": "admin-crm-leave",
  "/empcrm/admin-dashboard/attendance-summary": "admin-crm-attendance-summary",
  "/empcrm/admin-dashboard/attendance-sheet": "attendance-sheet",
  "/empcrm/admin-dashboard/attendance": "attendance-details",
  "/empcrm/admin-dashboard/auto-checkout-approvals": "auto-checkout-approvals",
  "/empcrm/admin-dashboard/machine-attendance": "machine-attendance",
  "/empcrm/admin-dashboard/attendance-rules": "attendance-rules",
  "/empcrm/admin-dashboard/documents": "admin-crm-documents",
  "/empcrm/admin-dashboard/salary": "salary-management",
  "/empcrm/admin-dashboard/salary-sheet": "salary-sheet",
  "/empcrm/admin-dashboard/salary-slips": "salary-slips",
};

export function resolveEmpCrmAdminModuleKey(path, itemModuleKey) {
  const fromItem = String(itemModuleKey || "").trim();
  if (fromItem) return fromItem;
  return EMPCRM_ADMIN_PATH_MODULE_KEY[String(path || "").trim()] || "";
}

export function adminCrmModuleKeyAllowed(moduleKey, allowedModules) {
  if (!allowedModules) return true;
  const key = String(moduleKey || "").trim();
  if (!key) return false;
  if (allowedModules.includes(key)) return true;
  if (
    allowedModules.includes("hr-admin-employee-crm") &&
    HR_ADMIN_EMPLOYEE_CRM_MODULE_KEYS.includes(key)
  ) {
    return true;
  }
  return false;
}

export function filterEmpCrmAdminMenuByModuleAccess(menuItems, allowedModules) {
  if (!Array.isArray(menuItems)) return [];
  return menuItems.filter((item) => {
    const key = resolveEmpCrmAdminModuleKey(item.path, item.moduleKey);
    if (!key) return true;
    return adminCrmModuleKeyAllowed(key, allowedModules);
  });
}
