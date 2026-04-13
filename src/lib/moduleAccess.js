/**
 * Full CRM module tree (parent → children).
 * Covers ALL roles (SUPERADMIN, ADMIN, ACCOUNTANT, SALES, HR, etc.)
 *
 * key   → stored in DB (module_access JSON array)
 * label → shown in Quick Edit UI
 *
 * Backward-compat rule:
 *   If module_access is NULL in DB → ALL keys are granted automatically.
 */
export const MODULE_TREE = [
  {
    key: "dashboard",
    label: "Dashboard",
    children: [
      { key: "dashboard-home",               label: "Dashboard Home" },
      { key: "daily-report",                 label: "Daily Report" },
      { key: "lead-reports",                 label: "Lead Reports" },
      { key: "quotations-report",            label: "Quotations Report" },
      { key: "order-report",                 label: "Order Report" },
      { key: "demo-followups",               label: "Demo Followups" },
      { key: "item-wise-sales",              label: "Item Wise Sales" },
      { key: "customer-payment-behavior",    label: "Customer Payment Behavior" },
      { key: "targets-assign",               label: "Targets – Assign" },
      { key: "targets-monitor",              label: "Targets – Monitor" },
      { key: "lead-distribution",            label: "Lead Distribution" },
      { key: "orders-process",               label: "Order Process" },
      { key: "orders-delay",                 label: "Delay Delivery" },
      { key: "bulk-reassign",                label: "Bulk Reassign Leads" },
      { key: "my-leads",                     label: "My Leads" },
      { key: "leads-upload",                label: "Leads Upload" },
      { key: "blog",                       label: "Blog" },
      { key: "dm-fresh-leads",               label: "24h Fresh Leads (DM)" },
      { key: "task-manager",                 label: "Task Manager" },
      { key: "demo-details",                 label: "Demo Details" },
      { key: "attendance-details",           label: "Attendance details" },
      { key: "regularization-approvals",     label: "Regularization approvals" },
      { key: "fast-card",                    label: "Fast Card" },
    ],
  },
  {
    key: "prospects",
    label: "Prospects",
    children: [
      { key: "prospects-view",   label: "View Prospects" },
      { key: "prospects-add",    label: "Add Prospect (Manual)" },
      { key: "prospects-new",    label: "New Prospect" },
    ],
  },
  {
    key: "tl-management",
    label: "TL Management",
    children: [
      { key: "tl-customers",            label: "TL Customers" },
      { key: "add-customer",            label: "Add Customer" },
      { key: "view-customers",          label: "View Customers" },
      { key: "quotations",              label: "Quotations" },
      { key: "invoices",                label: "Invoices" },
      { key: "service-records",         label: "Service Records" },
      { key: "upcoming-installations",  label: "Upcoming Installations" },
      { key: "service-map",             label: "Service Map" },
    ],
  },
  {
    key: "products",
    label: "Products",
    children: [
      { key: "product-stock",          label: "Product Stock" },
      { key: "product-accessories",    label: "Product Accessories" },
      { key: "purchase-direct-in",     label: "Purchase – Direct In" },
      { key: "purchase-request",       label: "Purchase – Generate Request" },
      { key: "purchase-warehouse-in",  label: "Purchase – Warehouse In" },
      { key: "purchases",              label: "Purchases" },
      { key: "spare-parts",            label: "Spare Parts" },
      { key: "spare-direct-in",        label: "Spare – Direct In" },
      { key: "spare-request",          label: "Spare – Generate Request" },
      { key: "spare-warehouse-in",     label: "Spare – Warehouse In" },
      { key: "spare-purchases",        label: "Spare – Purchases" },
      { key: "production-status",      label: "Production Status" },
      { key: "bom-list",               label: "BOM List" },
      { key: "warranty-console",       label: "Warranty – Product Console" },
      { key: "registered-products",    label: "Warranty – Registered Products" },
      { key: "warranty-map",           label: "Warranty – Map View" },
    ],
  },
  {
    key: "employee",
    label: "Employee",
    children: [
      { key: "employee-list",  label: "Employee List" },
      { key: "employee-crm",   label: "Employee CRM" },
      { key: "attendance-log", label: "All Attendance details" },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    children: [
      { key: "company-documents",  label: "Company Documents" },
      { key: "dd-management",      label: "DD Management" },
      { key: "qa-approval",        label: "Q&A Approval" },
      { key: "qa",                 label: "Q&A" },
      { key: "email-templates",    label: "Email Templates" },
      { key: "holidays",           label: "Holidays" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    children: [
      { key: "payment-pending",   label: "Payment Pending" },
      { key: "manual-payments",   label: "Manual Payments" },
      { key: "expenses",          label: "Expenses" },
    ],
  },
  {
    key: "tally-payments",
    label: "Tally Payments",
    children: [
      { key: "client-expenses",  label: "Client Expenses" },
      { key: "statements",       label: "Statements" },
      { key: "salary-slips",     label: "Salary Slips" },
    ],
  },
  {
    key: "import-crm",
    label: "Import CRM",
    children: [
      { key: "import-agents",            label: "Agents" },
      { key: "import-suppliers",         label: "Suppliers" },
      { key: "import-shipments",         label: "Shipments" },
      { key: "import-quote-submissions", label: "Quote Submissions" },
      { key: "import-award-followups",   label: "Award Follow-ups" },
      { key: "import-billing",           label: "Billing" },
    ],
  },
  {
    key: "attendance-rules",
    label: "Attendance Rules",
    children: [],
  },
  {
    key: "final-profile-approval",
    label: "Final Profile Approval",
    children: [],
  },
  {
    key: "hiring-process",
    label: "Hiring Process",
    children: [],
  },
];

/** Flat list of ALL keys (parent + children) */
export const ALL_MODULE_KEYS = MODULE_TREE.flatMap((parent) => [
  parent.key,
  ...parent.children.map((c) => c.key),
]);

/** Just the top-level (section) keys */
export const TOP_LEVEL_KEYS = MODULE_TREE.map((m) => m.key);

/** Child keys that belong to a given parent section key */
export function getChildKeys(parentKey) {
  const section = MODULE_TREE.find((m) => m.key === parentKey);
  return section ? section.children.map((c) => c.key) : [];
}

/**
 * Parse the raw DB value of module_access.
 *
 * NULL / undefined / empty-string in DB  → not configured yet → return ALL keys (backward compat).
 * "[]" (empty JSON array) in DB          → user explicitly has NO access → return [].
 * "[\"dashboard\",...]" in DB            → return exactly what is stored.
 */
export function parseModuleAccess(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return [...ALL_MODULE_KEYS]; // never been set → grant all
  }
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed; // includes [] intentionally
    return [...ALL_MODULE_KEYS];
  } catch {
    return [...ALL_MODULE_KEYS];
  }
}

/**
 * SUPERADMIN-only modules that must never be granted to other roles,
 * even under backward-compat "grant all when module_access is NULL".
 */
export const SUPERADMIN_ONLY_MODULE_KEYS = new Set([
  // Admin-only features
  "attendance-rules",
  "import-crm",
  "hiring-process",
  "final-profile-approval",
]);

/**
 * Enforce SUPERADMIN-only modules at the module_access level.
 * @param {string[]|null|undefined} allowedKeys
 * @param {string} role
 */
export function applySuperadminOnlyModuleRestrictions(allowedKeys, role) {
  const r = String(role ?? "").trim().toUpperCase();
  if (r === "SUPERADMIN") return allowedKeys ?? null;
  if (!allowedKeys) return allowedKeys ?? null;
  return allowedKeys.filter((k) => !SUPERADMIN_ONLY_MODULE_KEYS.has(k));
}

/**
 * Role-specific deny lists (even if module_access contains the key).
 * Use for "this role must never see this module".
 */
const HR_DENY_MODULE_KEYS = new Set([
  // Reports / Orders should not be shown to HR
  "lead-reports",
  "quotations-report",
  "order-report",
  "demo-followups",
  "item-wise-sales",
  "customer-payment-behavior",
  "payment-pending",
  "orders-process",
  "orders-delay",
]);

export function applyRoleDenyModuleRestrictions(allowedKeys, role) {
  if (!allowedKeys) return allowedKeys ?? null;
  const r = String(role ?? "").trim().toUpperCase();
  const isHr = r === "HR" || r === "HR HEAD" || r === "HR EXECUTIVE";
  if (!isHr) return allowedKeys;
  return allowedKeys.filter((k) => !HR_DENY_MODULE_KEYS.has(k));
}

/**
 * Role-specific allow lists (hard cap). If set for a role, user can never see
 * modules outside this set (even if module_access includes them).
 *
 * This matches the requirement: "is role ko itne hi modules default me dikhne chahiye,
 * iske alawa na kam na zyada" while still allowing per-user toggles within the set.
 */
const ROLE_MAX_ALLOWED_MODULE_KEYS = {
  ACCOUNTANT: new Set([
    "dashboard-home",
    "manual-payments",
    "dd-management",
    "company-documents",
    "client-expenses",
    "statements",
    "targets-monitor",
    "invoices",
    "payment-pending",
    "customer-payment-behavior",
    "attendance-log",
    "quotations",
    "expenses",
    "service-records",
    "assets",
    "product-stock",
    "product-accessories",
    "purchase-direct-in",
    "purchase-request",
    "purchase-warehouse-in",
    "purchases",
    "spare-parts",
    "spare-direct-in",
    "spare-request",
    "spare-warehouse-in",
    "spare-purchases",
    "production-status",
    "bom-list",
    "employee-crm",
    "salary-slips",
  ]),
  "TEAM LEADER": new Set([
    "dashboard-home",
    "tl-customers",
    "view-customers",
    "add-customer",
    "customer-payment-behavior",
    "payment-pending",
    "item-wise-sales",
    "lead-reports",
    "quotations-report",
    "order-report",
    "demo-followups",
    "leads-upload",
    "my-leads",
    "employee-crm",
  ]),
  SALES: new Set([
    "dashboard-home",
    "view-customers",
    "add-customer",
    "quotations",
    "prospects-view",
    "prospects-add",
    "prospects-new",
    "customer-payment-behavior",
    "payment-pending",
    "item-wise-sales",
    "lead-reports",
    "quotations-report",
    "order-report",
    "demo-followups",
    "leads-upload",
    "my-leads",
    "employee-crm",
  ]),
  "SALES HEAD": new Set([
    "dashboard-home",
    "view-customers",
    "add-customer",
    "quotations",
    "prospects-view",
    "prospects-add",
    "prospects-new",
    "customer-payment-behavior",
    "payment-pending",
    "item-wise-sales",
    "lead-reports",
    "quotations-report",
    "order-report",
    "demo-followups",
    "leads-upload",
    "my-leads",
    "employee-crm",
  ]),
  "DIGITAL MARKETER": new Set([
    "dashboard-home",
    "leads-upload",
    "blog",
    "my-leads",
    "quotations",
    "email-templates",
    "product-stock",
    "spare-parts",
    "employee-crm",
  ]),
  ADMIN: new Set([
    "dashboard-home",
    "attendance-details",
    "regularization-approvals",
    "task-manager",
    "expenses",
    "fast-card",
    "prospects-view",
    "prospects-add",
    "prospects-new",
    "customer-payment-behavior",
    "payment-pending",
    "manual-payments",
    "company-documents",
    "dd-management",
    "attendance-rules",
    "quotations",
    "service-records",
    "warranty-console",
    "registered-products",
    "warranty-map",
    "product-stock",
    "product-accessories",
    "purchase-direct-in",
    "purchase-request",
    "purchase-warehouse-in",
    "purchases",
    "spare-parts",
    "spare-direct-in",
    "spare-request",
    "spare-warehouse-in",
    "spare-purchases",
    "production-status",
    "bom-list",
    "employee-crm",
    "qa",
  ]),
};

export function applyRoleMaxAllowedModuleRestrictions(allowedKeys, role) {
  if (!allowedKeys) return allowedKeys ?? null;
  const r = String(role ?? "").trim().toUpperCase();
  const cap = ROLE_MAX_ALLOWED_MODULE_KEYS[r];
  if (!cap) return allowedKeys;
  return allowedKeys.filter((k) => cap.has(k));
}

/**
 * Check whether a sidebar section should be visible given the allowed keys array.
 * A section is accessible if:
 *   - allowedKeys is null (= all allowed), OR
 *   - the section's own key is in allowedKeys, OR
 *   - at least one of the section's child keys is in allowedKeys.
 */
export function isSectionAllowed(sectionKey, allowedKeys) {
  if (!allowedKeys) return true;
  if (allowedKeys.includes(sectionKey)) return true;
  const childKeys = getChildKeys(sectionKey);
  return childKeys.some((k) => allowedKeys.includes(k));
}
