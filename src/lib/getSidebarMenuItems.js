// lib/getSidebarMenuItems.js users
import { getSessionPayload } from "./auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";
import {
  parseModuleAccess,
  isSectionAllowed,
  applySuperadminOnlyModuleRestrictions,
  applyRoleDenyModuleRestrictions,
  SUPERADMIN_ONLY_MODULE_KEYS,
} from "@/lib/moduleAccess";
import { getDbConnection } from "@/lib/db";

function stripSuperadminOnlyMenuItems(items, roleKey) {
  if (roleKey === "SUPERADMIN") return items;
  return (items || [])
    .map((item) => {
      if (item?.moduleKey && SUPERADMIN_ONLY_MODULE_KEYS.has(item.moduleKey)) {
        return null;
      }
      if (item?.children?.length) {
        return { ...item, children: stripSuperadminOnlyMenuItems(item.children, roleKey) };
      }
      return item;
    })
    .filter(Boolean);
}

function roleMatches(itemRoles, roleKey) {
  const roles = Array.isArray(itemRoles) && itemRoles.length > 0 ? itemRoles : ["ALL"];
  const norm = (r) => normalizeRoleKey(r) || String(r || "").trim().toUpperCase();
  const wanted = norm(roleKey);
  return roles.some((r) => {
    const rr = norm(r);
    return rr === "ALL" || rr === wanted;
  });
}

function filterByRole(list, roleKey) {
  return (list || [])
    .map((item) => {
      const children = item?.children?.length ? filterByRole(item.children, roleKey) : [];
      const keepSelf = roleMatches(item?.roles, roleKey);
      if (children.length > 0) return { ...item, children };
      return keepSelf ? item : null;
    })
    .filter(Boolean);
}

/**
 * Top-level order mirrors super-admin (`getAdminSidebarMenuItems.js`): Dashboard → TL → Reports →
 * Leads Management → Activities → Sales → Service → Products → Procurement → Production →
 * Accounting → Main Expenses → Employees → HR Operations → Targets → Resource Center.
 * Paths stay under user CRM (`/user-dashboard`, `/empcrm/...`) except where only an admin route exists.
 */
const allMenuItems = [
  {
    path: "/user-dashboard",
    name: "Dashboard",
    moduleKey: "dashboard-home",
    roles: ["ALL"],
    icon: "Home",
  },
  {
    path: "/user-dashboard/tl-customers",
    name: "TL Management",
    moduleKey: "tl-customers",
    /* module_access grants tl-customers; do not limit to TEAM LEADER role only */
    roles: ["ALL"],
    icon: "Users",
  },
  {
    name: "Reports",
    moduleKey: "dashboard",
    /* Who may see each report is enforced by module_access (Quick Edit); keep role list open so granted keys are not stripped before module filtering. */
    roles: ["ALL"],
    icon: "ScrollText",
    children: [
      {
        path: "/user-dashboard/today-reports",
        name: "Daily Report",
        moduleKey: "daily-report",
        roles: ["ALL"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/lead-reports",
        name: "Lead Reports",
        moduleKey: "lead-reports",
        roles: ["ALL"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/quot-report",
        name: "Quotations Report",
        moduleKey: "quotations-report",
        roles: ["ALL"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/order-followups",
        name: "Order Report",
        moduleKey: "order-report",
        roles: ["ALL"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/reports/item-wise-sales",
        name: "Item Wise Sales",
        moduleKey: "item-wise-sales",
        roles: ["ALL"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/reports/customer-payment-behavior",
        name: "Customer Payment Behavior",
        moduleKey: "customer-payment-behavior",
        roles: ["ALL"],
        icon: "FileText",
      },
    ],
  },
  {
    name: "Leads Management",
    moduleKey: "tl-management",
    /* Visibility driven by module_access; avoid role filter hiding granted keys (same pattern as Reports). */
    roles: ["ALL"],
    icon: "Users",
    children: [
      {
        path: "/user-dashboard/add-customer",
        name: "Add Customer",
        moduleKey: "add-customer",
        roles: ["ALL"],
        icon: "FilePlus2",
      },
      {
        path: "/user-dashboard/customers",
        name: "View Customers",
        moduleKey: "view-customers",
        roles: ["ALL"],
        icon: "ScrollText",
      },
      {
        path: "/user-dashboard/my-leads",
        name: "My Leads",
        moduleKey: "my-leads",
        roles: ["ALL"],
        icon: "Upload",
      },
      {
        path: "/user-dashboard/digital-marketer-leads",
        name: "24h Fresh Leads (DM)",
        moduleKey: "dm-fresh-leads",
        roles: ["ALL"],
        icon: "Clock",
      },
      {
        path: "/admin-dashboard/lead-distribution",
        name: "Lead Distribution",
        moduleKey: "lead-distribution",
        roles: ["ALL"],
        icon: "ScrollText",
      },
      {
        path: "/admin-dashboard/bulk-reassign",
        name: "Bulk Reassign Leads",
        moduleKey: "bulk-reassign",
        roles: ["ALL"],
        icon: "Upload",
      },
      {
        path: "/user-dashboard/new_upload",
        name: "Leads Upload",
        moduleKey: "leads-upload",
        roles: ["ALL"],
        icon: "Upload",
      },
    ],
  },
  {
    name: "Activities",
    moduleKey: "dashboard",
    roles: ["ALL"],
    icon: "ClipboardList",
    children: [
      {
        path: "/user-dashboard/task-manager",
        name: "Task Manager",
        moduleKey: "task-manager",
        roles: ["ALL"],
        icon: "ClipboardList",
      },
      {
        path: "/user-dashboard/report-data",
        name: "Fast Card",
        moduleKey: "fast-card",
        roles: ["ALL"],
        icon: "ShieldCheck",
      },
      {
        path: "/user-dashboard/demo-registrations",
        name: "Demo Followups",
        moduleKey: "demo-followups",
        roles: ["ALL"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/demo_details",
        name: "Demo Details",
        moduleKey: "demo-details",
        roles: [
          "SALES",
          "SALES HEAD",
          "SALES_HEAD",
          "ADMIN",
          "SUPERADMIN",
          "TEAM LEADER",
          "SERVICE HEAD",
          "BACK OFFICE",
          "DIGITAL MARKETER",
          "GEM PORTAL",
          "ACCOUNTANT",
          "WAREHOUSE INCHARGE",
          "HR",
        ],
        icon: "PlayCircle",
      },
    ],
  },
  {
    name: "Sales",
    moduleKey: "tl-management",
    roles: [
      "SALES",
      "SALES HEAD",
      "SALES_HEAD",
      "ADMIN",
      "SERVICE HEAD",
      "BACK OFFICE",
      "DIGITAL MARKETER",
      "GEM PORTAL",
      "ACCOUNTANT",
      "TEAM LEADER",
    ],
    icon: "FileSignature",
    children: [
      {
        path: "/user-dashboard/quotations",
        name: "Quotation",
        moduleKey: "quotations",
        roles: [
          "SALES",
          "SALES HEAD",
          "SALES_HEAD",
          "ADMIN",
          "SERVICE HEAD",
          "BACK OFFICE",
          "DIGITAL MARKETER",
          "GEM PORTAL",
          "ACCOUNTANT",
          "TEAM LEADER",
        ],
        icon: "FileSignature",
      },
      {
        path: "/user-dashboard/invoices",
        name: "Invoices",
        moduleKey: "invoices",
        roles: ["ACCOUNTANT"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/order",
        name: "Order Process",
        moduleKey: "orders-process",
        roles: [
          "SALES",
          "SALES HEAD",
          "SALES_HEAD",
          "ADMIN",
          "SUPERADMIN",
          "TEAM LEADER",
          "SERVICE HEAD",
          "BACK OFFICE",
          "DIGITAL MARKETER",
          "GEM PORTAL",
          "ACCOUNTANT",
          "WAREHOUSE INCHARGE",
          "HR",
        ],
        icon: "ListOrdered",
      },
      {
        path: "/user-dashboard/order/delivery-status",
        name: "Delay Delivery",
        moduleKey: "orders-delay",
        roles: ["ALL"],
        icon: "ListOrdered",
      },
    ],
  },
  {
    name: "Service & After-Sales",
    moduleKey: "service-after-sales",
    roles: ["ALL"],
    icon: "ShieldCheck",
    children: [
      {
        path: "/user-dashboard/warranty",
        name: "Register Product",
        moduleKey: "warranty-console",
        roles: ["ALL"],
        icon: "ShieldCheck",
      },
      {
        path: "/user-dashboard/warranty/products",
        name: "Registered Products",
        moduleKey: "registered-products",
        roles: ["ALL"],
        icon: "ShieldCheck",
      },
      {
        path: "/user-dashboard/view_service_reports",
        name: "Service Records",
        moduleKey: "service-records",
        roles: ["ALL"],
        icon: "BookOpen",
      },
      {
        path: "/user-dashboard/view_service_reports/upcoming-installation",
        name: "Upcoming Installations",
        moduleKey: "upcoming-installations",
        roles: ["ALL"],
        icon: "BookOpen",
      },
      {
        path: "/user-dashboard/view_service_reports/map",
        name: "Service Map",
        moduleKey: "service-map",
        roles: ["ALL"],
        icon: "MapPin",
      },
      {
        path: "/user-dashboard/warranty/map",
        name: "Map View",
        moduleKey: "warranty-map",
        roles: ["ALL"],
        icon: "MapPin",
      },
    ],
  },
  {
    name: "Products & Inventory",
    moduleKey: "products",
    roles: [
      "ADMIN",
      "ACCOUNTANT",
      "WAREHOUSE INCHARGE",
      "DIGITAL MARKETER",
      "TEAM LEADER",
      "SALES HEAD",
      "SALES_HEAD",
    ],
    icon: "Grid3x3",
    children: [
      {
        path: "/user-dashboard/product-stock",
        name: "Price List",
        moduleKey: "product-stock",
        roles: [
          "ADMIN",
          "ACCOUNTANT",
          "WAREHOUSE INCHARGE",
          "DIGITAL MARKETER",
          "TEAM LEADER",
          "SALES",
          "SALES HEAD",
          "SALES_HEAD",
        ],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/product-accessories",
        name: "Product Accessories",
        moduleKey: "product-accessories",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "ClipboardList",
      },
      {
        path: "/user-dashboard/spare",
        name: "Spare Parts",
        moduleKey: "spare-parts",
        roles: [
          "ADMIN",
          "ACCOUNTANT",
          "WAREHOUSE INCHARGE",
          "DIGITAL MARKETER",
          "TEAM LEADER",
          "SALES HEAD",
          "SALES_HEAD",
        ],
        icon: "FileText",
      },
    ],
  },
  {
    name: "Procurement",
    moduleKey: "products",
    roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
    icon: "ShoppingCart",
    children: [
      {
        name: "Purchase – Products",
        moduleKey: "products",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "ShoppingCart",
        children: [
          {
            path: "/user-dashboard/purchase/direct-in",
            name: "Direct In",
            moduleKey: "purchase-direct-in",
            roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
            icon: "PackageCheck",
          },
          {
            path: "/user-dashboard/purchase/generate-request",
            name: "Generate Request",
            moduleKey: "purchase-request",
            roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
            icon: "FilePlus",
          },
          {
            path: "/user-dashboard/purchase/warehouse-in",
            name: "Warehouse In",
            moduleKey: "purchase-warehouse-in",
            roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
            icon: "PackageCheck",
          },
          {
            path: "/user-dashboard/purchase/purchases",
            name: "Purchases",
            moduleKey: "purchases",
            roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
            icon: "ShoppingBag",
          },
        ],
      },
      {
        name: "Purchase – Spares",
        moduleKey: "products",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "ShoppingCart",
        children: [
          {
            path: "/user-dashboard/spare/purchase/direct-in",
            name: "Direct In",
            moduleKey: "spare-direct-in",
            roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
            icon: "PackageCheck",
          },
          {
            path: "/user-dashboard/spare/purchase/generate-request",
            name: "Generate Request",
            moduleKey: "spare-request",
            roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
            icon: "FilePlus",
          },
          {
            path: "/user-dashboard/spare/purchase/warehouse-in",
            name: "Warehouse In",
            moduleKey: "spare-warehouse-in",
            roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
            icon: "PackageCheck",
          },
          {
            path: "/user-dashboard/spare/purchase/purchases",
            name: "Purchases",
            moduleKey: "spare-purchases",
            roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
            icon: "ShoppingBag",
          },
        ],
      },
    ],
  },
  {
    name: "Production",
    moduleKey: "products",
    roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE", "DESIGN ENGINEER"],
    icon: "PackageCheck",
    children: [
      {
        path: "/user-dashboard/productions/status",
        name: "Production Status",
        moduleKey: "production-status",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE", "DESIGN ENGINEER"],
        icon: "ListOrdered",
      },
      {
        path: "/user-dashboard/productions/bom-list",
        name: "BOM List",
        moduleKey: "bom-list",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE", "DESIGN ENGINEER"],
        icon: "ClipboardList",
      },
    ],
  },
  {
    name: "Accounting",
    moduleKey: "payments",
    /* module_access + isSectionAllowed gate visibility (same pattern as Reports / Leads). */
    roles: ["ALL"],
    icon: "DollarSign",
    children: [
      {
        path: "/user-dashboard/reports/payment-pending",
        name: "Payment Pending",
        moduleKey: "payment-pending",
        roles: ["ALL"],
        icon: "DollarSign",
      },
      {
        path: "/user-dashboard/expenses",
        name: "Expense",
        moduleKey: "expenses",
        roles: ["ALL"],
        icon: "DollarSign",
      },
      {
        path: "/user-dashboard/all-expenses",
        name: "View Expenses",
        moduleKey: "view-expenses",
        roles: ["ALL"],
        icon: "DollarSign",
      },
      {
        path: "/user-dashboard/manual-payments",
        name: "Manual Payments",
        moduleKey: "manual-payments",
        roles: ["ALL"],
        icon: "Receipt",
      },
      {
        path: "/user-dashboard/dd-management",
        name: "DD Management",
        moduleKey: "dd-management",
        roles: ["ALL"],
        icon: "DollarSign",
      },
      {
        path: "/admin-dashboard/import-crm/billing",
        name: "Billing",
        moduleKey: "import-billing",
        roles: ["ALL"],
        icon: "Receipt",
      },
    ],
  },
  {
    name: "Main Expenses",
    moduleKey: "tally-payments",
    roles: ["SUPERADMIN", "ACCOUNTANT"],
    icon: "Receipt",
    children: [
      {
        path: "/admin-dashboard/client-expenses/cards",
        name: "Main Expenses",
        moduleKey: "client-expenses",
        roles: ["SUPERADMIN", "ACCOUNTANT"],
        icon: "FileText",
      },
      {
        path: "/admin-dashboard/statements",
        name: "Statement",
        moduleKey: "statements",
        roles: ["SUPERADMIN", "ACCOUNTANT"],
        icon: "Receipt",
      },
    ],
  },
  {
    name: "Employees",
    moduleKey: "employee",
    roles: ["ALL", "HR", "HR HEAD", "HR Executive", "SUPERADMIN"],
    icon: "User",
    children: [
      {
        path: "/user-dashboard/employees",
        name: "Employees",
        moduleKey: "employee-list",
        roles: ["ALL"],
        icon: "UserPlus",
      },
      {
        path: "/empcrm/user-dashboard",
        name: "Employee CRM",
        moduleKey: "employee-crm",
        roles: ["ALL"],
        icon: "User",
      },
    ],
  },
  {
    name: "HR Operations",
    moduleKey: "employee",
    roles: ["ALL"],
    icon: "Briefcase",
    children: [
      {
        path: "/admin-dashboard/attendance-rules",
        name: "Attendance rules",
        moduleKey: "attendance-rules",
        roles: ["ALL"],
        icon: "Clock",
      },
      {
        path: "/empcrm/admin-dashboard/hiring",
        name: "Hiring",
        moduleKey: "hiring-process",
        roles: ["ALL"],
        icon: "Users",
      },
      {
        path: "/empcrm/admin-dashboard/profile/approvals-admin",
        name: "Final Profile Approval",
        moduleKey: "final-profile-approval",
        roles: ["ALL"],
        icon: "UserCircle",
      },
      {
        path: "/empcrm/admin-dashboard/salary-slips",
        name: "Salary slips",
        moduleKey: "salary-slips",
        roles: ["ALL"],
        icon: "Receipt",
      },
    ],
  },
  {
    name: "Targets",
    moduleKey: "targets",
    roles: ["ALL"],
    icon: "Target",
    children: [
      {
        path: "/admin-dashboard/prospects",
        name: "Prospects",
        moduleKey: "prospects-view",
        roles: ["ALL"],
        icon: "UserPlus",
      },
      {
        path: "/admin-dashboard/prospects/add-manual",
        name: "Add Prospect (Manual)",
        moduleKey: "prospects-add",
        roles: ["ALL"],
        icon: "FilePlus2",
      },
      {
        path: "/admin-dashboard/prospects/new",
        name: "New Prospect",
        moduleKey: "prospects-new",
        roles: ["ALL"],
        icon: "UserPlus",
      },
      {
        path: "/admin-dashboard/hr-designation-targets",
        name: "HR Targets",
        moduleKey: "hr-designation-targets",
        roles: ["ALL"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/monitor-targets",
        name: "Sales Target",
        moduleKey: "sales-target",
        roles: ["ALL"],
        icon: "Target",
      },
    ],
  },
  {
    name: "Import CRM",
    moduleKey: "import-crm",
    roles: ["ALL"],
    icon: "Import",
    children: [
      {
        path: "/admin-dashboard/import-crm/suppliers",
        name: "Suppliers",
        moduleKey: "import-suppliers",
        roles: ["ALL"],
        icon: "Users",
      },
      {
        path: "/admin-dashboard/import-crm/shipments",
        name: "Shipments",
        moduleKey: "import-shipments",
        roles: ["ALL"],
        icon: "Ship",
      },
      {
        path: "/admin-dashboard/import-crm/agents",
        name: "Agents",
        moduleKey: "import-agents",
        roles: ["ALL"],
        icon: "UserPlus",
      },
      {
        path: "/admin-dashboard/import-crm/quote-submissions",
        name: "Quote Submissions",
        moduleKey: "import-quote-submissions",
        roles: ["ALL"],
        icon: "ScrollText",
      },
      {
        path: "/admin-dashboard/import-crm/award-followups",
        name: "Award Follow-ups",
        moduleKey: "import-award-followups",
        roles: ["ALL"],
        icon: "PackageCheck",
      },
    ],
  },
  {
    name: "Resource Center",
    moduleKey: "documents",
    roles: ["ALL"],
    icon: "BookOpen",
    children: [
      {
        path: "/user-dashboard/blogs",
        name: "Catalogue",
        moduleKey: "blog",
        roles: ["ALL"],
        icon: "ScrollText",
      },
      {
        path: "/user-dashboard/installation-videos",
        name: "Installation Videos",
        moduleKey: "installation-videos",
        roles: [
          "ADMIN",
          "SERVICE HEAD",
          "TEAM LEADER",
          "GRAPHIC DESIGNER",
          "ACCOUNTANT",
          "WAREHOUSE INCHARGE",
          "SALES",
          "SALES HEAD",
          "SALES_HEAD",
        ],
        icon: "PlayCircle",
      },
      {
        path: "/user-dashboard/installation-videos/manage",
        name: "Manage Video Links",
        moduleKey: "installation-videos-manage",
        roles: [
          "ADMIN",
          "SERVICE HEAD",
          "TEAM LEADER",
          "GRAPHIC DESIGNER",
          "ACCOUNTANT",
          "WAREHOUSE INCHARGE",
        ],
        icon: "FilePlus2",
      },
      {
        path: "/user-dashboard/assets-management",
        name: "Assets",
        moduleKey: "assets",
        roles: ["ADMIN", "ACCOUNTANT", "SALES", "SALES HEAD", "SALES_HEAD"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/qa",
        name: "Knowledge Base",
        moduleKey: "qa",
        roles: [
          "ADMIN",
          "SUPERADMIN",
          "TEAM LEADER",
          "SERVICE HEAD",
          "BACK OFFICE",
          "DIGITAL MARKETER",
          "GEM PORTAL",
          "ACCOUNTANT",
          "WAREHOUSE INCHARGE",
          "HR",
        ],
        icon: "BookOpen",
      },
      {
        path: "/user-dashboard/company-documents",
        name: "Company Documents",
        moduleKey: "company-documents",
        roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/email-templates",
        name: "Email Templates",
        moduleKey: "email-templates",
        roles: ["ADMIN", "GRAPHIC DESIGNER", "SERVICE HEAD", "DIGITAL MARKETER"],
        icon: "Mail",
      },
    ],
  },
  {
    path: "/user-dashboard/attendance-log/",
    name: "All Attendance details",
    moduleKey: "attendance-log",
    roles: ["ADMIN", "ACCOUNTANT", "HR", "TEAM LEADER"],
    icon: "ListOrdered",
  },
];

async function getUserModuleAccess(username) {
  if (!username) return null;
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      "SELECT module_access FROM rep_list WHERE username = ? LIMIT 1",
      [username],
    );
    if (!rows.length) return []; // unknown user → show nothing (fail closed)
    return parseModuleAccess(rows[0].module_access ?? null);
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();
    // Backward-compat: if column isn't present yet, allow all.
    if (msg.includes("unknown column") && msg.includes("module_access")) {
      return null;
    }
    // Any other DB error: do NOT leak modules.
    return [];
  }
}

export default async function getSidebarMenuItems() {
  const payload = await getSessionPayload();
  const role = (payload?.role ?? payload?.userRole) || "GUEST";
  const roleKey = normalizeRoleKey(role) || "GUEST";
  const username = payload?.username || null;

  // Module access is the source of truth (per-user selection in Quick Edit).
  let items = filterByRole(allMenuItems, roleKey);

  // Hard deny SUPERADMIN-only modules even when module_access is NULL (backward compat).
  items = stripSuperadminOnlyMenuItems(items, roleKey);

  // Step 2: filter by module_access (SUPERADMIN bypasses this — sees everything)
  if (roleKey !== "SUPERADMIN") {
    const allowedModulesRaw = await getUserModuleAccess(username);
    const allowedModules1 = applySuperadminOnlyModuleRestrictions(
      allowedModulesRaw,
      roleKey,
    );
    const allowedModules2 = applyRoleDenyModuleRestrictions(allowedModules1, roleKey);
    const allowedModules = allowedModules2;
    // allowedModules === null means column not set yet → show all (backward compat)
    if (allowedModules !== null) {
      const filterByModuleAccess = (list) =>
        (list || [])
          .map((item) => {
            const children = item?.children?.length
              ? filterByModuleAccess(item.children)
              : [];
            // When module_access is configured, a leaf link MUST have a moduleKey to be shown.
            // Otherwise older menu entries would "leak" through and ignore module_access.
            const allowed = item?.moduleKey
              ? isSectionAllowed(item.moduleKey, allowedModules)
              : item?.path
                ? false
                : true;
            // If it originally has children, keep it only if any child remains.
            // This prevents "empty groups" (e.g. Orders) from showing just because
            // a broad parent moduleKey like "dashboard" is allowed.
            if (item?.children?.length) {
              return children.length > 0 ? { ...item, children } : null;
            }
            // Leaf: keep only if allowed.
            return allowed ? item : null;
          })
          .filter(Boolean);

      items = filterByModuleAccess(items);
    }
  }

  return items;
}
