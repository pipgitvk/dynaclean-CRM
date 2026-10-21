import { getRoleDefaultModuleKeys } from "@/lib/roleDefaultModuleAccess";

/**
 * Canonical built-in employee roles (Add Employee, Global Module Access, Quick Edit).
 * Built-in list seeds table `crm_employee_roles`; custom roles live in the same table (is_builtin = 0).
 */
export const BASE_EMPLOYEE_ROLES = [
  "DIRECTOR",
  "ACCOUNTANT",
  "TEAM LEADER",
  "SALES",
  "SALES CUM BACKOFFICE",
  "SALES HEAD",
  "DIGITAL MARKETER",
  "ADMIN",
  "HR",
  "HR HEAD",
  "JUNIOR HR EXECUTIVE",
  "HR EXECUTIVE",
  "HR RECRUITER",
  "GEM",
  "GRAPHIC DESIGNER",
  "DESIGN ENGINEER",
  "DEVELOPER",
  "SERVICE ENGINEER",
  "SERVICE TECHNICIAN",
  "SERVICE HEAD",
  "SERVICE SUPPORT",
  "WELDER",
  "WELDER HELPER",
  "WAREHOUSE INCHARGE",
  "FACTORY INCHARGE",
  "EA",
  "MACHINE OPERATOR",
  "PRODUCTION ENGINEER",
  "BUSINESS DEVELOPMENT OFFICER",
  "THIRD PARTY ENGINEER",
];

/** Dashboard homes selectable when creating a custom role (middleware + login redirect). */
export const ROLE_DASHBOARD_HOME_OPTIONS = [
  { value: "/admin-dashboard", label: "Admin dashboard" },
  { value: "/director-dashboard", label: "Director dashboard" },
  { value: "/sales-dashboard", label: "Sales dashboard" },
  { value: "/service-head-dashboard", label: "Service head dashboard" },
  { value: "/hr-dashboard", label: "HR dashboard" },
  { value: "/digital-marketing-dashboard", label: "Digital marketing dashboard" },
  { value: "/accounts-dashboard", label: "Accounts dashboard" },
  { value: "/accountant-dashboard", label: "Accountant dashboard" },
  { value: "/third-party-engineer-dashboard", label: "Third party engineer dashboard" },
  { value: "/user-dashboard", label: "User dashboard (default)" },
];

/** Template role for module presets when a custom role picks a dashboard home. */
export const DASHBOARD_PATH_DEFAULT_TEMPLATE_ROLE = {
  "/admin-dashboard": "ADMIN",
  "/director-dashboard": "DIRECTOR",
  "/sales-dashboard": "SALES",
  "/service-head-dashboard": "SERVICE HEAD",
  "/hr-dashboard": "HR",
  "/digital-marketing-dashboard": "DIGITAL MARKETER",
  "/accounts-dashboard": "ACCOUNTANT",
  "/accountant-dashboard": "ACCOUNTANT",
  "/third-party-engineer-dashboard": "THIRD PARTY ENGINEER",
  "/user-dashboard": "SERVICE ENGINEER",
};

/** Not included in default module presets for newly created custom roles. */
export const CUSTOM_ROLE_DEFAULT_EXCLUDED_MODULE_KEYS = new Set(["manual-payments"]);

/** Custom role defaults: drop manual-payments; use payment-pending instead when applicable. */
export function stripCustomRoleDefaultModules(keys) {
  const list = [...(keys || [])];
  const hadManualPayments = list.includes("manual-payments");
  const out = list.filter((k) => !CUSTOM_ROLE_DEFAULT_EXCLUDED_MODULE_KEYS.has(k));
  if (hadManualPayments && !out.includes("payment-pending")) {
    out.push("payment-pending");
  }
  return out;
}

/** Module keys seeded for new custom roles from the dashboard chosen at role create. */
export function getDefaultModuleKeysForDashboardPath(
  dashboardPath,
  { forNewCustomRole = false } = {},
) {
  const path = String(dashboardPath || "").trim() || "/user-dashboard";
  const templateRole = DASHBOARD_PATH_DEFAULT_TEMPLATE_ROLE[path];
  let keys = templateRole
    ? getRoleDefaultModuleKeys(templateRole)
    : getRoleDefaultModuleKeys("SERVICE ENGINEER");
  if (forNewCustomRole) {
    keys = stripCustomRoleDefaultModules(keys);
  }
  return keys;
}

export function normalizeEmployeeRoleName(role) {
  return String(role || "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function mergeEmployeeRoleLists(baseRoles, customRoles) {
  const seen = new Set();
  const out = [];
  for (const r of [...(baseRoles || []), ...(customRoles || [])]) {
    const key = normalizeEmployeeRoleName(r);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function isBuiltinEmployeeRole(role) {
  const key = normalizeEmployeeRoleName(role);
  return BASE_EMPLOYEE_ROLES.some((r) => normalizeEmployeeRoleName(r) === key);
}
