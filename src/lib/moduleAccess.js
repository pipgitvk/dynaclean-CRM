
export const MODULE_TREE = [
  {
    key: "dashboard",
    label: "Dashboard",
    children: [
      { key: "dashboard-home", label: "Dashboard Home" },
      { key: "daily-report", label: "Daily Report" },
      { key: "hr-daily-report", label: "HR Daily Report" },
      { key: "lead-reports", label: "Lead Reports" },
      { key: "quotations-report", label: "Quotations Report" },
      { key: "order-report", label: "Order Report" },
      { key: "demo-followups", label: "Demo Followups" },
      { key: "item-wise-sales", label: "Item Wise Sales" },
      { key: "customer-payment-behavior", label: "Customer Payment Behavior" },
      { key: "lead-distribution", label: "Lead Distribution" },
      { key: "orders-process", label: "Order Process" },
      { key: "orders-delay", label: "Delay Delivery" },
      { key: "bulk-reassign", label: "Bulk Reassign Leads" },
      { key: "my-leads", label: "My Leads" },
      { key: "dm-fresh-leads", label: "24h Fresh Leads (DM)" },
      { key: "task-manager", label: "Task Manager" },
      { key: "demo-details", label: "Demo Details" },
      { key: "attendance-details", label: "Attendance details" },
      { key: "regularization-approvals", label: "Regularization approvals" },
      { key: "fast-card", label: "Fast Card" },
    ],
  },
  {
    key: "tl-management",
    label: "TL Management",
    children: [
      { key: "tl-customers", label: "TL Customers" },
      { key: "add-customer", label: "Add Customer" },
      { key: "view-customers", label: "View Customers" },
      { key: "quotations", label: "Quotations" },
      { key: "invoices", label: "Invoices" },
    ],
  },
  {
    key: "leads-management",
    label: "Leads Management",
    children: [{ key: "leads-upload", label: "Leads Upload" }],
  },
  {
    key: "targets",
    label: "Targets",
    children: [
      { key: "prospects-view", label: "Prospect" },
      { key: "prospects-add", label: "Add Prospect (Manual)" },
      { key: "prospects-new", label: "New Prospect" },
      { key: "hr-designation-targets", label: "HR Targets" },
      { key: "sales-target", label: "Sales Target" },
    ],
  },
  {
    key: "service-after-sales",
    label: "Service & After-Sales",
    children: [
      { key: "warranty-console", label: "Register Product" },
      { key: "registered-products", label: "Registered Products" },
      { key: "warranty-map", label: "Map View" },
      { key: "service-records", label: "Service Records" },
      { key: "upcoming-installations", label: "Upcoming Installations" },
      { key: "service-map", label: "Service Map" },
    ],
  },
  {
    key: "products",
    label: "Products & inventory",
    children: [
      { key: "product-stock", label: "Product Stock" },
      { key: "product-accessories", label: "Product Accessories" },
      { key: "purchase-direct-in", label: "Purchase – Direct In" },
      { key: "purchase-request", label: "Purchase – Generate Request" },
      { key: "purchase-warehouse-in", label: "Purchase – Warehouse In" },
      { key: "purchases", label: "Purchases" },
      { key: "spare-parts", label: "Spare Parts" },
      { key: "spare-direct-in", label: "Spare – Direct In" },
      { key: "spare-request", label: "Spare – Generate Request" },
      { key: "spare-warehouse-in", label: "Spare – Warehouse In" },
      { key: "spare-purchases", label: "Spare – Purchases" },
      { key: "production-status", label: "Production Status" },
      { key: "bom-list", label: "BOM List" },
    ],
  },
  {
    key: "employee",
    label: "Employees",
    children: [
      { key: "employee-list", label: "Employee List" },
      { key: "employee-crm", label: "Employee CRM" },
      { key: "attendance-log", label: "All Attendance details" },
    ],
  },
  {
    key: "payments",
    label: "Accounting",
    children: [
      { key: "payment-pending", label: "Payment Pending" },
      { key: "manual-payments", label: "Manual Payments" },
      { key: "expenses", label: "Expense" },
      { key: "view-expenses", label: "View Expenses" },
      { key: "dd-management", label: "DD Management" },
      { key: "import-billing", label: "Billing" },
    ],
  },
  {
    key: "tally-payments",
    label: "Main Expenses",
    children: [
      { key: "client-expenses", label: "Main Expenses" },
      { key: "statements", label: "Statements" },
      { key: "salary-slips", label: "Salary Slips" },
    ],
  },
  {
    key: "documents",
    label: "Resource Center",
    children: [
      { key: "company-documents", label: "Company Documents" },
      { key: "blog", label: "Blog" },
      { key: "qa-approval", label: "Q&A Approval" },
      { key: "qa", label: "Q&A" },
      { key: "email-templates", label: "Email Templates" },
      { key: "holidays", label: "Holidays" },
      { key: "installation-videos", label: "Installation Videos" },
      { key: "installation-videos-manage", label: "Manage Video Links" },
      { key: "assets", label: "Assets" },
    ],
  },
  {
    key: "import-crm",
    label: "Import CRM",
    children: [
      { key: "import-agents", label: "Agents" },
      { key: "import-suppliers", label: "Suppliers" },
      { key: "import-shipments", label: "Shipments" },
      { key: "import-quote-submissions", label: "Quote Submissions" },
      { key: "import-award-followups", label: "Award Follow-ups" },
    ],
  },
  {
    key: "attendance-rules",
    label: "Attendance Rules",
    children: [],
  },
  {
    key: "hiring-process",
    label: "Hiring Process",
    children: [],
  },
  {
    key: "final-profile-approval",
    label: "Final Profile Approval",
    children: [],
  },
];

/** Child keys not shown in super-admin sidebar → grouped under “Others” in bulk module UI */
export const MODULE_CHILD_KEYS_OTHERS_ONLY = new Set(["attendance-log"]);

/**
 * Super-admin sidebar mirror for Global Module Access UI.
 * - kind "single": one module key, no nested list (like Dashboard / TL Management in sidebar).
 * - kind "group": expandable; children are "leaf" rows or nested "group" (e.g. Procurement).
 */
export const SUPERADMIN_MODULE_UI_NODES = [
  {
    kind: "group",
    id: "dashboard",
    label: "Dashboard",
    children: [
      { kind: "leaf", key: "dashboard-home", label: "Dashboard" },
      { kind: "leaf", key: "task-manager", label: "Task Manager" },
      { kind: "leaf", key: "fast-card", label: "Fast Card" },
      { kind: "leaf", key: "attendance-details", label: "Attendance details" },
      { kind: "leaf", key: "regularization-approvals", label: "Regularization approvals" },
    ],
  },
  { kind: "single", id: "tl-management", label: "TL Management", key: "tl-customers" },
  {
    kind: "group",
    id: "reports",
    label: "Reports",
    children: [
      { kind: "leaf", key: "daily-report", label: "Daily Report" },
      { kind: "leaf", key: "hr-daily-report", label: "HR Daily Report" },
      { kind: "leaf", key: "lead-reports", label: "Lead Reports" },
      { kind: "leaf", key: "quotations-report", label: "Quotations Report" },
      { kind: "leaf", key: "order-report", label: "Order Report" },
      { kind: "leaf", key: "item-wise-sales", label: "Item Wise Sales" },
      { kind: "leaf", key: "customer-payment-behavior", label: "Customer Payment Behavior" },
    ],
  },
  {
    kind: "group",
    id: "leads-management",
    label: "Leads Management",
    children: [
      { kind: "leaf", key: "add-customer", label: "Add Customer" },
      { kind: "leaf", key: "view-customers", label: "View Customers" },
      { kind: "leaf", key: "my-leads", label: "My Leads" },
      { kind: "leaf", key: "dm-fresh-leads", label: "24h Fresh Leads (DM)" },
      { kind: "leaf", key: "lead-distribution", label: "Lead Distribution" },
      { kind: "leaf", key: "bulk-reassign", label: "Bulk Reassign Leads" },
      { kind: "leaf", key: "leads-upload", label: "Leads Upload" },
    ],
  },
  {
    kind: "group",
    id: "activities",
    label: "Activities",
    children: [
      { kind: "leaf", key: "demo-followups", label: "Demo Followups" },
      { kind: "leaf", key: "demo-details", label: "Demo Details" },
    ],
  },
  {
    kind: "group",
    id: "sales",
    label: "Sales",
    children: [
      { kind: "leaf", key: "quotations", label: "Quotation" },
      { kind: "leaf", key: "invoices", label: "Invoices" },
      { kind: "leaf", key: "orders-process", label: "Order Process" },
      { kind: "leaf", key: "orders-delay", label: "Delay Delivery" },
    ],
  },
  {
    kind: "group",
    id: "service-after-sales",
    label: "Service & After-Sales",
    children: [
      { kind: "leaf", key: "warranty-console", label: "Register Product" },
      { kind: "leaf", key: "registered-products", label: "Registered Products" },
      { kind: "leaf", key: "service-records", label: "Service History" },
      { kind: "leaf", key: "upcoming-installations", label: "Upcoming Installations" },
      { kind: "leaf", key: "service-map", label: "Service Map" },
      { kind: "leaf", key: "warranty-map", label: "Map View" },
    ],
  },
  {
    kind: "group",
    id: "products-inventory",
    label: "Products & Inventory",
    children: [
      { kind: "leaf", key: "product-stock", label: "Products" },
      { kind: "leaf", key: "product-accessories", label: "Product Accessories" },
      { kind: "leaf", key: "spare-parts", label: "Spare Parts" },
    ],
  },
  {
    kind: "group",
    id: "procurement",
    label: "Procurement",
    children: [
      {
        kind: "group",
        id: "purchase-products",
        label: "Purchase – Products",
        children: [
          { kind: "leaf", key: "purchase-direct-in", label: "Direct In" },
          { kind: "leaf", key: "purchase-request", label: "Generate Request" },
          { kind: "leaf", key: "purchase-warehouse-in", label: "Warehouse In" },
          { kind: "leaf", key: "purchases", label: "Purchases" },
        ],
      },
      {
        kind: "group",
        id: "purchase-spares",
        label: "Purchase – Spares",
        children: [
          { kind: "leaf", key: "spare-direct-in", label: "Direct In" },
          { kind: "leaf", key: "spare-request", label: "Generate Request" },
          { kind: "leaf", key: "spare-warehouse-in", label: "Warehouse In" },
          { kind: "leaf", key: "spare-purchases", label: "Purchases" },
        ],
      },
    ],
  },
  {
    kind: "group",
    id: "production",
    label: "Production",
    children: [
      { kind: "leaf", key: "production-status", label: "Production Status" },
      { kind: "leaf", key: "bom-list", label: "BOM List" },
    ],
  },
  {
    kind: "group",
    id: "accounting",
    label: "Accounting",
    children: [
      { kind: "leaf", key: "payment-pending", label: "Payment Pending" },
      { kind: "leaf", key: "manual-payments", label: "Manual Payments" },
      { kind: "leaf", key: "expenses", label: "Expense" },
      { kind: "leaf", key: "view-expenses", label: "View Expenses" },
      { kind: "leaf", key: "dd-management", label: "DD Management" },
      { kind: "leaf", key: "import-billing", label: "Billing" },
    ],
  },
  {
    kind: "group",
    id: "tally-payments",
    label: "Main Expenses",
    children: [
      { kind: "leaf", key: "client-expenses", label: "Main Expenses" },
      { kind: "leaf", key: "statements", label: "Statements" },
    ],
  },
  {
    kind: "group",
    id: "employees",
    label: "Employees",
    children: [
      { kind: "leaf", key: "employee-list", label: "Employee list" },
      { kind: "leaf", key: "employee-crm", label: "Employee CRM" },
    ],
  },
  {
    kind: "group",
    id: "hr-operations",
    label: "HR Operations",
    children: [
      { kind: "leaf", key: "attendance-rules", label: "Attendance Rules" },
      { kind: "leaf", key: "hiring-process", label: "Hiring Process" },
      { kind: "leaf", key: "final-profile-approval", label: "Final Profile Approval" },
      { kind: "leaf", key: "salary-slips", label: "Salary Slips" },
    ],
  },
  {
    kind: "group",
    id: "targets",
    label: "Targets",
    children: [
      { kind: "leaf", key: "prospects-view", label: "Prospect" },
      { kind: "leaf", key: "prospects-add", label: "Add Prospect (Manual)" },
      { kind: "leaf", key: "prospects-new", label: "New Prospect" },
      { kind: "leaf", key: "hr-designation-targets", label: "HR Targets" },
      { kind: "leaf", key: "sales-target", label: "Sales Target" },
    ],
  },
  {
    kind: "group",
    id: "import-crm",
    label: "Import CRM",
    children: [
      { kind: "leaf", key: "import-suppliers", label: "Suppliers" },
      { kind: "leaf", key: "import-shipments", label: "Shipments" },
      { kind: "leaf", key: "import-agents", label: "Agents" },
      { kind: "leaf", key: "import-quote-submissions", label: "Quote Submissions" },
      { kind: "leaf", key: "import-award-followups", label: "Award Follow-ups" },
    ],
  },
  {
    kind: "group",
    id: "resource-center",
    label: "Resource Center",
    children: [
      { kind: "leaf", key: "company-documents", label: "Company Documents" },
      { kind: "leaf", key: "blog", label: "Blog" },
      { kind: "leaf", key: "qa", label: "Q&A" },
      { kind: "leaf", key: "qa-approval", label: "Q&A Approval" },
      { kind: "leaf", key: "email-templates", label: "Email Templates" },
      { kind: "leaf", key: "holidays", label: "Holidays" },
      { kind: "leaf", key: "installation-videos", label: "Installation Videos" },
      { kind: "leaf", key: "installation-videos-manage", label: "Manage Video Links" },
      { kind: "leaf", key: "assets", label: "Assets" },
    ],
  },
];

function findLabelForModuleKey(key) {
  const k = String(key || "").trim();
  for (const sec of MODULE_TREE) {
    if (sec.key === k) return sec.label;
    for (const c of sec.children) {
      if (c.key === k) return c.label;
    }
  }
  return k;
}

/** All leaf module keys under a UI node (for parent checkbox toggle). */
export function collectModuleKeysFromUiNode(node) {
  if (!node) return [];
  if (node.kind === "single" || node.kind === "leaf") return [node.key];
  if (node.kind === "group" && node.children?.length) {
    return node.children.flatMap(collectModuleKeysFromUiNode);
  }
  return [];
}

function flattenModuleUiSearchIndex(nodes, ancestorLabel, out) {
  for (const node of nodes || []) {
    if (node.kind === "single") {
      out.push({
        key: node.key,
        label: node.label,
        sectionKey: node.id,
        sectionLabel: node.label,
        scrollId: `bulk-section-${node.id}`,
      });
    } else if (node.kind === "leaf") {
      out.push({
        key: node.key,
        label: node.label,
        sectionKey: ancestorLabel || "modules",
        sectionLabel: ancestorLabel || "",
        scrollId: `bulk-module-${node.key}`,
      });
    } else if (node.kind === "group") {
      flattenModuleUiSearchIndex(node.children, node.label, out);
    }
  }
}

export function buildModuleUiSearchIndex(uiNodes) {
  const out = [];
  flattenModuleUiSearchIndex(uiNodes, "", out);
  return out.filter((x) => x.key && x.label);
}

/**
 * Full UI tree for Global Module Access: super-admin sidebar layout + “Others” at the end.
 */
export function getModuleTreeForEmployeeBulkUi() {
  const othersLeaves = [];
  for (const k of MODULE_CHILD_KEYS_OTHERS_ONLY) {
    othersLeaves.push({
      kind: "leaf",
      key: k,
      label: findLabelForModuleKey(k),
    });
  }
  othersLeaves.sort((a, b) => a.label.localeCompare(b.label));
  const othersGroup =
    othersLeaves.length > 0
      ? [
          {
            kind: "group",
            id: "others",
            label: "Others",
            children: othersLeaves,
          },
        ]
      : [];
  return [...SUPERADMIN_MODULE_UI_NODES, ...othersGroup];
}

/** Flat list of ALL keys (parent + children) */
export const ALL_MODULE_KEYS = MODULE_TREE.flatMap((parent) => [
  parent.key,
  ...parent.children.map((c) => c.key),
]);

/** Just the top-level (section) keys */
export const TOP_LEVEL_KEYS = MODULE_TREE.map((m) => m.key);

/** Child keys that belong to a given parent section key */
export function getChildKeys(parentKey) {
  if (parentKey === "others") {
    return [...MODULE_CHILD_KEYS_OTHERS_ONLY];
  }
  const section = MODULE_TREE.find((m) => m.key === parentKey);
  return section ? section.children.map((c) => c.key) : [];
}

/**
 * Map legacy DB keys → current keys (after renames / merges).
 */
export function normalizeModuleAccessKeys(keys) {
  if (!Array.isArray(keys)) return keys;
  const known = new Set(ALL_MODULE_KEYS);
  const out = new Set();
  for (const k of keys) {
    const key = String(k ?? "").trim();
    if (!key) continue;
    if (key === "targets-monitor") {
      out.add("sales-target");
      continue;
    }
    if (key === "targets-assign") {
      continue;
    }
    if (key === "prospects") {
      out.add("targets");
      continue;
    }
    // Legacy: one "expenses" toggle used to gate both submit + view-all screens
    if (key === "expenses") {
      out.add("expenses");
      out.add("view-expenses");
      continue;
    }
    // Legacy: installation-videos previously gated both list + manage pages
    if (key === "installation-videos") {
      out.add("installation-videos");
      out.add("installation-videos-manage");
      continue;
    }
    out.add(key);
  }
  return [...out].filter((k) => known.has(k));
}

/**
 * Parse the raw DB value of module_access.
 *
 * NULL / undefined / empty-string in DB  → not configured yet → return ALL keys (backward compat).
 * "[]" (empty JSON array) in DB          → user explicitly has NO access → return [].
 * "[\"dashboard\",...]" in DB            → return normalized keys.
 */
export function parseModuleAccess(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return [...ALL_MODULE_KEYS]; // never been set → grant all
  }
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [];
      return normalizeModuleAccessKeys(parsed);
    }
    return [...ALL_MODULE_KEYS];
  } catch {
    return [...ALL_MODULE_KEYS];
  }
}

/**
 * Keys removed here are stripped from non-SUPERADMIN module_access (legacy guard).
 * Attendance rules & final profile approval are grantable via Global module access to HR/admin;
 * route-level auth remains on each page.
 */
export const SUPERADMIN_ONLY_MODULE_KEYS = new Set([]);

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
 * Back-compat export: historically this applied a per-role "max allowed" cap.
 * Requirement changed: admins must be able to grant more OR fewer modules than presets,
 * so this is now a no-op.
 */
export function applyRoleMaxAllowedModuleRestrictions(allowedKeys) {
  return allowedKeys ?? null;
}

/**
 * Back-compat export: returns null (no hard cap).
 * @returns {null}
 */
export function getRoleMaxAllowedModuleKeys() {
  return null;
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
