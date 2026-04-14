// lib/getSidebarMenuItems.js users
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getSessionPayload } from "./auth";
import {
  ATTENDANCE_RULES_ALLOWED_ROLES,
  normalizeRoleKey,
} from "@/lib/adminAttendanceRulesAuth";
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

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

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

const allMenuItems = [
  {
    path: "/user-dashboard",
    name: "Dashboard",
    moduleKey: "dashboard",
    roles: ["ALL"],
    icon: "Home",
    children: [
      {
        path: "/user-dashboard",
        name: "Dashboard",
        moduleKey: "dashboard-home",
        roles: ["ALL"],
        icon: "Home",
      },
      {
        path: "/user-dashboard/lead-reports",
        name: "Lead Reports",
        moduleKey: "lead-reports",
        roles: ["SALES", "SALES HEAD"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/today-reports",
        name: "Today Report",
        moduleKey: "daily-report",
        roles: ["TEAM LEADER", "ADMIN", "HR", "SALES", "SALES HEAD", "WAREHOUSE INCHARGE"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/attendance/",
        name: "Attendance details",
        moduleKey: "attendance-details",
        roles: ["ALL"],
        icon: "ListOrdered",
      },
      {
        path: "/user-dashboard/attendance-regularization-approvals",
        name: "Regularization approvals",
        moduleKey: "regularization-approvals",
        roles: ["ALL"],
        icon: "CheckSquare",
      },
      {
        path: "/user-dashboard/task-manager",
        name: "Task Manager",
        moduleKey: "task-manager",
        roles: ["ALL"],
        icon: "ClipboardList",
      },
      {
        path: "/user-dashboard/expenses",
        name: "Expense",
        moduleKey: "expenses",
        roles: ["ALL"],
        icon: "DollarSign",
      },
      {
        path: "/user-dashboard/report-data",
        name: "Fast Card",
        moduleKey: "fast-card",
        roles: ["ALL"],
        icon: "ShieldCheck",
      },
    ],
  },

  {
    path: "/user-dashboard/reports/customer-payment-behavior",
    name: "Customer Payment Behavior",
    moduleKey: "customer-payment-behavior",
    roles: ["ADMIN", "ACCOUNTANT", "SALES", "SALES HEAD"],
    icon: "FileText",
  },
  {
    name: "Reports",
    moduleKey: "dashboard",
    roles: ["TEAM LEADER"],
    icon: "ScrollText",
    children: [
      {
        path: "/user-dashboard/lead-reports",
        name: "Lead Reports",
        roles: ["TEAM LEADER"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/quot-report",
        name: "Quotations Report",
        roles: ["TEAM LEADER"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/order-followups",
        name: "Order Report",
        moduleKey: "order-report",
        roles: ["TEAM LEADER"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/demo-registrations",
        name: "Demo Followups",
        roles: ["TEAM LEADER"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/reports/payment-pending",
        name: "Payment Pending",
        moduleKey: "payment-pending",
        roles: ["TEAM LEADER"],
        icon: "DollarSign",
      },
      {
        path: "/user-dashboard/reports/item-wise-sales",
        name: "Item Wise Sales",
        moduleKey: "item-wise-sales",
        roles: ["TEAM LEADER"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/reports/customer-payment-behavior",
        name: "Customer Payment Behavior",
        moduleKey: "customer-payment-behavior",
        roles: ["TEAM LEADER"],
        icon: "FileText",
      },
    ],
  },

  // Admin can see the user-dashboard Order Report too (module_access controls actual visibility)
  {
    path: "/user-dashboard/order-followups",
    name: "Order Report",
    moduleKey: "order-report",
    roles: ["ADMIN"],
    icon: "FileText",
  },

  {
    path: "/user-dashboard/reports/payment-pending",
    name: "Payment Pending",
    moduleKey: "payment-pending",
    roles: [
      "ADMIN",
      "ACCOUNTANT",
      "SALES",
      "SALES HEAD",
      "BACK OFFICE",
      "GEM PORTAL",
    ],
    icon: "DollarSign",
  },
  {
    path: "/user-dashboard/manual-payments",
    name: "Manual Payments",
    moduleKey: "manual-payments",
    roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"],
    icon: "Receipt",
  },
  {
    path: "/admin-dashboard/prospects",
    name: "Prospects",
    moduleKey: "prospects",
    roles: ["SUPERADMIN", "ADMIN", "SALES", "SALES HEAD"],
    icon: "UserPlus",
  },
  {
    name: "Tally Payments",
    moduleKey: "tally-payments",
    roles: ["SUPERADMIN", "ACCOUNTANT"],
    icon: "Receipt",
    children: [
      {
        path: "/admin-dashboard/client-expenses/cards",
        name: "Client Expenses",
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
    path: "/empcrm/admin-dashboard/salary-slips",
    name: "Salary slips",
    moduleKey: "tally-payments",
    roles: ["SUPERADMIN", "ACCOUNTANT"],
    icon: "Receipt",
  },
  {
    name: "Orders",
    moduleKey: "dashboard",
    roles: ["ALL"],
    icon: "ListOrdered",
    children: [
      {
        path: "/user-dashboard/order",
        name: "Order Process",
        moduleKey: "orders-process",
        roles: ["ALL"],
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
    path: "/user-dashboard/monitor-targets",
    name: "Target Monitor",
    moduleKey: "targets-monitor",
    roles: ["ACCOUNTANT"],
    icon: "DollarSign",
  },
  {
    path: "/user-dashboard/attendance-log/",
    name: "All Attendance details",
    moduleKey: "attendance-log",
    roles: ["ADMIN", "ACCOUNTANT", "HR", "TEAM LEADER"],
    icon: "ListOrdered",
  },
  {
    path: "/user-dashboard/new_upload",
    name: "Leads Upload",
    moduleKey: "leads-upload",
    roles: ["DIGITAL MARKETER", "TEAM LEADER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/blogs",
    name: "Blog",
    moduleKey: "blog",
    roles: ["DIGITAL MARKETER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/my-leads",
    name: "My Leads",
    moduleKey: "my-leads",
    roles: ["DIGITAL MARKETER", "TEAM LEADER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/digital-marketer-leads",
    name: "24h Fresh Leads",
    moduleKey: "dm-fresh-leads",
    roles: ["DIGITAL MARKETER", "SUPERADMIN"],
    icon: "Clock",
  },

  
// {
//   name: "Special Pricing",
//   roles: ["ALL"],
//   icon: "ScrollText",
//   children: [
//     {
//       path: "/user-dashboard/special-pricing",
//       name: "All Special Prices",
//       roles: ["ADMIN", "MANAGER"],
//       icon: "List",
//     },
//     {
//       path: "/user-dashboard/special-pricing/new",
//       name: "Create Special Price",
//       roles: ["ADMIN", "EMPLOYEE"],
//       icon: "FilePlus2",
//     }
//   ],
// },

  {
    // path: "/user-dashboard/customers",
    name: "View Customers",
    moduleKey: "view-customers",
    roles: ["ALL"],
    icon: "ScrollText",
    children: [
      {
        path: "/user-dashboard/customers",
        name: "View Customers",
        moduleKey: "view-customers",
        roles: ["ALL"],
        icon: "ScrollText",
      },
      {
        path: "/user-dashboard/add-customer",
        name: "Add Customer",
        moduleKey: "add-customer",
        roles: ["ALL"],
        icon: "FilePlus2",
      },
    ],
  },
  {
    path: "/user-dashboard/tl-customers",
    name: "TL Management",
    moduleKey: "tl-customers",
    roles: ["TEAM LEADER"],
    icon: "Users",
  },

  {
    path: "/user-dashboard/demo_details",
    name: "Demo Details",
    moduleKey: "demo-details",
    roles: ["ALL"],
    icon: "PlayCircle",
  },
  {
    path: "/user-dashboard/quotations",
    name: "Quotation",
    moduleKey: "quotations",
    roles: [
      "SALES",
      "SALES HEAD",
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
    roles: [
      "ACCOUNTANT"
    ],
    icon: "FileText",
  },

  {
    path: "/user-dashboard/all-expenses",
    name: "View Expenses",
    moduleKey: "expenses",
    roles: ["ACCOUNTANT", "ADMIN", "TEAM LEADER"],
    icon: "DollarSign",
  },
  {
    name: "Service History",
    moduleKey: "service-records",
    roles: [
      "SERVICE ENGINEER",
      "SERVICE HEAD",
      "ADMIN",
      "TEAM LEADER",
      "ACCOUNTANT",
    ],
    icon: "BookOpen",
    children: [
      {
        path: "/user-dashboard/view_service_reports",
        name: "Service Records",
        moduleKey: "service-records",
        roles: [
          "ACCOUNTANT",
          "SERVICE ENGINEER",
          "SERVICE HEAD",
          "ADMIN",
          "TEAM LEADER",
        ],
        icon: "BookOpen",
      },
      {
        path: "/user-dashboard/view_service_reports/upcoming-installation",
        name: "Upcoming Installations",
        moduleKey: "upcoming-installations",
        roles: [
          "ACCOUNTANT",
          "SERVICE ENGINEER",
          "SERVICE HEAD",
          "ADMIN",
          "TEAM LEADER",
        ],
        icon: "BookOpen",
      },
      {
        path: "/user-dashboard/view_service_reports/map",
        name: "Service Map",
        roles: [
          "ACCOUNTANT",
          "SERVICE ENGINEER",
          "SERVICE HEAD",
          "ADMIN",
          "TEAM LEADER",
        ],
        icon: "MapPin",
      },
    ],
  },
  {
    path: "/user-dashboard/email-templates",
    name: "Email Templates",
    moduleKey: "email-templates",
    roles: ["ADMIN", "GRAPHIC DESIGNER", "SERVICE HEAD", "DIGITAL MARKETER"],
    icon: "Mail",
  },

  {
    name: "Warranty",
    moduleKey: "products",
    roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "WAREHOUSE INCHARGE", "ACCOUNTANT"],
    icon: "ScrollText",
    children: [
      {
        path: "/user-dashboard/warranty",
        name: "Register Product",
        moduleKey: "warranty-console",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "WAREHOUSE INCHARGE", "ACCOUNTANT"],
        icon: "ShieldCheck",
      },
      {
        path: "/user-dashboard/warranty/products",
        name: "Registered Products",
        moduleKey: "registered-products",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "WAREHOUSE INCHARGE", "ACCOUNTANT"],
        icon: "ShieldCheck",
      },
      {
        path: "/user-dashboard/warranty/map",
        name: "Map View",
        moduleKey: "warranty-map",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "WAREHOUSE INCHARGE", "ACCOUNTANT"],
        icon: "MapPin",
      },
    ],
  },
  {
    name: "Materials",
    moduleKey: "installation-videos",
    roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "GRAPHIC DESIGNER", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
    icon: "ScrollText",
    children: [
      {
        path: "/user-dashboard/installation-videos",
        name: "Installation Videos",
        moduleKey: "installation-videos",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "GRAPHIC DESIGNER", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "PlayCircle",
      },
      {
        path: "/user-dashboard/installation-videos/manage",
        name: "Manage Video Links",
        moduleKey: "installation-videos",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "GRAPHIC DESIGNER", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "FilePlus2",
      },
    ],
  },
  {
    path: "/user-dashboard/installation-videos",
    name: "Installation Videos",
    moduleKey: "installation-videos",
    roles: ["SALES", "SALES HEAD"],
    icon: "PlayCircle",
  },
  {
    path: "/user-dashboard/assets-management",
    name: "Assets",
    moduleKey: "assets",
    roles: ["ADMIN", "ACCOUNTANT"],
    icon: "FileText",
  },
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
    name: "Purchase Products",
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
      // "SALES",
    ],
    icon: "FileText",
  },
  {
    name: "Purchase Spares",
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
  {
    name: "Productions",
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
    path: "/user-dashboard/qa",
    name: "Knowledge Base",
    moduleKey: "qa",
    roles: ["ALL"],
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
    path: "/user-dashboard/employees",
    name: "Employees",
    moduleKey: "employee-list",
    roles: ["HR"],
    icon: "UserPlus",
  },
  {
    path: "/empcrm/admin-dashboard/hiring",
    name: "Hiring",
    moduleKey: "hiring-process",
    roles: ["HR", "HR HEAD", "HR Executive"],
    icon: "Users",
  },
  {
    path: "/user-dashboard/dd-management",
    name: "DD Management",
    moduleKey: "dd-management",
    roles: ["ADMIN", "ACCOUNTANT"],
    icon: "DollarSign",
  },
  {
    path: "/empcrm/user-dashboard",
    name: "Employee CRM",
    moduleKey: "employee-crm",
    roles: ["ALL"],
    icon: "User",
  },
  {
    path: "/admin-dashboard/attendance-rules",
    name: "Attendance rules",
    moduleKey: "attendance-rules",
    roles: [...ATTENDANCE_RULES_ALLOWED_ROLES],
    icon: "Clock",
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
