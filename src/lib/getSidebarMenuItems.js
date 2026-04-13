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
        roles: ["ALL"],
        icon: "Home",
      },
      {
        path: "/user-dashboard/lead-reports",
        name: "Lead Reports",
        roles: ["SALES", "SALES HEAD"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/today-reports",
        name: "Today Report",
        roles: ["TEAM LEADER", "ADMIN", "HR", "SALES", "SALES HEAD"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/attendance/",
        name: "Attendance details",
        roles: ["ALL"],
        icon: "ListOrdered",
      },
      {
        path: "/user-dashboard/attendance-regularization-approvals",
        name: "Regularization approvals",
        roles: ["ALL"],
        icon: "CheckSquare",
      },
      {
        path: "/user-dashboard/task-manager",
        name: "Task Manager",
        roles: ["ALL"],
        icon: "ClipboardList",
      },
      {
        path: "/user-dashboard/expenses",
        name: "Expense",
        roles: ["ALL"],
        icon: "DollarSign",
      },
      {
        path: "/user-dashboard/report-data",
        name: "Fast Card",
        roles: ["ALL"],
        icon: "ShieldCheck",
      },
    ],
  },

  {
    path: "/user-dashboard/reports/customer-payment-behavior",
    name: "Customer Payment Behavior",
    moduleKey: "payments",
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
        roles: ["TEAM LEADER"],
        icon: "DollarSign",
      },
      {
        path: "/user-dashboard/reports/item-wise-sales",
        name: "Item Wise Sales",
        roles: ["TEAM LEADER"],
        icon: "FileText",
      },
      {
        path: "/user-dashboard/reports/customer-payment-behavior",
        name: "Customer Payment Behavior",
        roles: ["TEAM LEADER"],
        icon: "FileText",
      },
    ],
  },

  {
    path: "/user-dashboard/reports/payment-pending",
    name: "Payment Pending",
    moduleKey: "payments",
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
    moduleKey: "payments",
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
        roles: ["SUPERADMIN", "ACCOUNTANT"],
        icon: "FileText",
      },
      {
        path: "/admin-dashboard/statements",
        name: "Statement",
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
        roles: ["ALL"],
        icon: "ListOrdered",
      },
      {
        path: "/user-dashboard/order/delivery-status",
        name: "Delay Delivery",
        roles: ["ALL"],
        icon: "ListOrdered",
      },
    ],
  },

  {
    path: "/user-dashboard/monitor-targets",
    name: "Target Monitor",
    moduleKey: "dashboard",
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
    moduleKey: "dashboard",
    roles: ["DIGITAL MARKETER", "TEAM LEADER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/blogs",
    name: "Blog",
    moduleKey: "dashboard",
    roles: ["DIGITAL MARKETER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/my-leads",
    name: "My Leads",
    moduleKey: "dashboard",
    roles: ["DIGITAL MARKETER", "TEAM LEADER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/digital-marketer-leads",
    name: "24h Fresh Leads",
    moduleKey: "dashboard",
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
    moduleKey: "tl-management",
    roles: ["ALL"],
    icon: "ScrollText",
    children: [
      {
        path: "/user-dashboard/customers",
        name: "View Customers",
        roles: ["ALL"],
        icon: "ScrollText",
      },
      {
        path: "/user-dashboard/add-customer",
        name: "Add Customer",
        roles: ["ALL"],
        icon: "FilePlus2",
      },
    ],
  },
  {
    path: "/user-dashboard/tl-customers",
    name: "TL Management",
    moduleKey: "tl-management",
    roles: ["TEAM LEADER"],
    icon: "Users",
  },

  {
    path: "/user-dashboard/demo_details",
    name: "Demo Details",
    moduleKey: "dashboard",
    roles: ["ALL"],
    icon: "PlayCircle",
  },
  {
    path: "/user-dashboard/quotations",
    name: "Quotation",
    moduleKey: "tl-management",
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
    moduleKey: "tl-management",
    roles: [
      "ACCOUNTANT"
    ],
    icon: "FileText",
  },

  {
    path: "/user-dashboard/all-expenses",
    name: "View Expenses",
    moduleKey: "payments",
    roles: ["ACCOUNTANT", "ADMIN", "TEAM LEADER"],
    icon: "DollarSign",
  },
  {
    name: "Service History",
    moduleKey: "tl-management",
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
    moduleKey: "documents",
    roles: ["ADMIN", "GRAPHIC DESIGNER", "SERVICE HEAD", "DIGITAL MARKETER"],
    icon: "Mail",
  },

  {
    name: "Warranty",
    moduleKey: "products",
    roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER"],
    icon: "ScrollText",
    children: [
      {
        path: "/user-dashboard/warranty",
        name: "Register Product",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER"],
        icon: "ShieldCheck",
      },
      {
        path: "/user-dashboard/warranty/products",
        name: "Registered Products",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER"],
        icon: "ShieldCheck",
      },
      {
        path: "/user-dashboard/warranty/map",
        name: "Map View",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER"],
        icon: "MapPin",
      },
    ],
  },
  {
    name: "Materials",
    moduleKey: "documents",
    roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "GRAPHIC DESIGNER"],
    icon: "ScrollText",
    children: [
      {
        path: "/user-dashboard/installation-videos",
        name: "Installation Videos",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "GRAPHIC DESIGNER"],
        icon: "PlayCircle",
      },
      {
        path: "/user-dashboard/installation-videos/manage",
        name: "Manage Video Links",
        roles: ["ADMIN", "SERVICE HEAD", "TEAM LEADER", "GRAPHIC DESIGNER"],
        icon: "FilePlus2",
      },
    ],
  },
  {
    path: "/user-dashboard/installation-videos",
    name: "Installation Videos",
    moduleKey: "documents",
    roles: ["SALES", "SALES HEAD"],
    icon: "PlayCircle",
  },
  {
    path: "/user-dashboard/assets-management",
    name: "Assets",
    moduleKey: "documents",
    roles: ["ADMIN", "ACCOUNTANT"],
    icon: "FileText",
  },
  {
    path: "/user-dashboard/product-stock",
    name: "Price List",
    moduleKey: "products",
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
    moduleKey: "products",
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
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "PackageCheck",
      },
      {
        path: "/user-dashboard/purchase/generate-request",
        name: "Generate Request",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "FilePlus",
      },
      {
        path: "/user-dashboard/purchase/warehouse-in",
        name: "Warehouse In",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "PackageCheck",
      },
      {
        path: "/user-dashboard/purchase/purchases",
        name: "Purchases",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "ShoppingBag",
      },
    ],
  },
  {
    path: "/user-dashboard/spare",
    name: "Spare Parts",
    moduleKey: "products",
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
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "PackageCheck",
      },
      {
        path: "/user-dashboard/spare/purchase/generate-request",
        name: "Generate Request",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "FilePlus",
      },
      {
        path: "/user-dashboard/spare/purchase/warehouse-in",
        name: "Warehouse In",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
        icon: "PackageCheck",
      },
      {
        path: "/user-dashboard/spare/purchase/purchases",
        name: "Purchases",
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
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE", "DESIGN ENGINEER"],
        icon: "ListOrdered",
      },
      {
        path: "/user-dashboard/productions/bom-list",
        name: "BOM List",
        roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE", "DESIGN ENGINEER"],
        icon: "ClipboardList",
      },
    ],
  },
  {
    path: "/user-dashboard/qa",
    name: "Knowledge Base",
    moduleKey: "documents",
    roles: ["ALL"],
    icon: "BookOpen",
  },
  {
    path: "/user-dashboard/company-documents",
    name: "Company Documents",
    moduleKey: "documents",
    roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"],
    icon: "FileText",
  },
  {
    path: "/user-dashboard/employees",
    name: "Employees",
    moduleKey: "employee",
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
    moduleKey: "documents",
    roles: ["ADMIN", "ACCOUNTANT"],
    icon: "DollarSign",
  },
  {
    path: "/empcrm/user-dashboard",
    name: "Employee CRM",
    moduleKey: "employee",
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
    if (!rows.length) return null;
    return parseModuleAccess(rows[0].module_access ?? null);
  } catch {
    return null; // column doesn't exist yet → allow all
  }
}

export default async function getSidebarMenuItems() {
  const payload = await getSessionPayload();
  const role = (payload?.role ?? payload?.userRole) || "GUEST";
  const roleKey = normalizeRoleKey(role) || "GUEST";
  const username = payload?.username || null;

  // Step 1: filter by role
  let items = allMenuItems.filter(
    (item) =>
      item.roles.includes("ALL") ||
      item.roles.some((r) => normalizeRoleKey(r) === roleKey),
  );

  // Hard deny SUPERADMIN-only modules even when module_access is NULL (backward compat).
  items = stripSuperadminOnlyMenuItems(items, roleKey);

  // Accountant should only see a very small allowlist of screens.
  if (roleKey === "ACCOUNTANT") {
    const allowedExactPaths = new Set([
      "/user-dashboard",
      "/user-dashboard/",
    ]);
    const allowedPrefixes = [
      "/user-dashboard/manual-payments",
      "/user-dashboard/dd-management",
      "/user-dashboard/company-documents",
      "/admin-dashboard/client-expenses",
      "/admin-dashboard/statements",
      "/user-dashboard/monitor-targets",
      "/user-dashboard/invoices",
      "/user-dashboard/reports/payment-pending",
      "/user-dashboard/reports/customer-payment-behavior",
      "/user-dashboard/attendance-log",
      "/user-dashboard/quotations",
      "/user-dashboard/all-expenses",
      "/user-dashboard/view_service_reports",
      "/user-dashboard/assets-management",
      "/user-dashboard/product-stock",
      "/user-dashboard/product-accessories",
      "/user-dashboard/purchase",
      "/user-dashboard/spare",
      "/user-dashboard/spare/purchase",
      "/user-dashboard/productions",
      "/empcrm/user-dashboard",
    ];

    const isAllowedPath = (p) => {
      const path = String(p || "");
      if (allowedExactPaths.has(path)) return true;
      return allowedPrefixes.some((prefix) => path.startsWith(prefix));
    };

    const filterByPathAllowlist = (list) =>
      (list || [])
        .map((item) => {
          // Always keep the full Dashboard *section* (not every dashboard-tagged item).
          if (
            item?.moduleKey === "dashboard" &&
            item?.path === "/user-dashboard" &&
            Array.isArray(item?.children) &&
            item.children.length > 0
          ) {
            return item;
          }
          const children = item?.children?.length
            ? filterByPathAllowlist(item.children)
            : [];
          const pathOk = item?.path ? isAllowedPath(item.path) : false;
          if (children.length > 0) return { ...item, children };
          if (pathOk) return item;
          // Keep the top-level dashboard container if it has /user-dashboard path
          return null;
        })
        .filter(Boolean);

    items = filterByPathAllowlist(items);
  }

  // Team Leader should only see a small allowlist of screens.
  if (roleKey === "TEAM LEADER") {
    const allowedExactPaths = new Set([
      "/user-dashboard",
      "/user-dashboard/",
    ]);
    const allowedPrefixes = [
      "/user-dashboard/tl-customers",
      "/user-dashboard/customers",
      "/user-dashboard/add-customer",
      "/user-dashboard/reports/customer-payment-behavior",
      "/user-dashboard/reports/payment-pending",
      "/user-dashboard/reports/item-wise-sales",
      "/user-dashboard/lead-reports",
      "/user-dashboard/quot-report",
      "/user-dashboard/order-followups",
      "/user-dashboard/demo-registrations",
      "/user-dashboard/new_upload",
      "/user-dashboard/my-leads",
      "/empcrm/user-dashboard",
      "/empcrm/user-dashboard/profile",
    ];

    const isAllowedPath = (p) => {
      const path = String(p || "");
      if (allowedExactPaths.has(path)) return true;
      return allowedPrefixes.some((prefix) => path.startsWith(prefix));
    };

    const filterByPathAllowlist = (list) =>
      (list || [])
        .map((item) => {
          // Always keep the full Dashboard *section* (not every dashboard-tagged item).
          if (
            item?.moduleKey === "dashboard" &&
            item?.path === "/user-dashboard" &&
            Array.isArray(item?.children) &&
            item.children.length > 0
          ) {
            return item;
          }
          const children = item?.children?.length
            ? filterByPathAllowlist(item.children)
            : [];
          const pathOk = item?.path ? isAllowedPath(item.path) : false;
          if (children.length > 0) return { ...item, children };
          if (pathOk) return item;
          return null;
        })
        .filter(Boolean);

    items = filterByPathAllowlist(items);
  }

  // Sales roles should only see a small allowlist of screens.
  if (roleKey === "SALES" || roleKey === "SALES HEAD") {
    const allowedExactPaths = new Set([
      "/user-dashboard",
      "/user-dashboard/",
    ]);
    const allowedPrefixes = [
      "/user-dashboard/today-reports",
      "/user-dashboard/lead-reports",
      "/admin-dashboard/prospects",
      "/user-dashboard/customers",
      "/user-dashboard/add-customer",
      "/user-dashboard/reports/customer-payment-behavior",
      "/user-dashboard/reports/payment-pending",
      "/user-dashboard/quotations",
      "/user-dashboard/order",
      "/user-dashboard/order/delivery-status",
      "/user-dashboard/view_service_reports/upcoming-installation",
      "/user-dashboard/installation-videos",
      "/user-dashboard/product-stock",
      "/empcrm/user-dashboard",
    ];

    const isAllowedPath = (p) => {
      const path = String(p || "");
      if (allowedExactPaths.has(path)) return true;
      return allowedPrefixes.some((prefix) => path.startsWith(prefix));
    };

    const filterByPathAllowlist = (list) =>
      (list || [])
        .map((item) => {
          // Always keep the full Dashboard *section* (not every dashboard-tagged item).
          if (
            item?.moduleKey === "dashboard" &&
            item?.path === "/user-dashboard" &&
            Array.isArray(item?.children) &&
            item.children.length > 0
          ) {
            return item;
          }
          const children = item?.children?.length
            ? filterByPathAllowlist(item.children)
            : [];
          const pathOk = item?.path ? isAllowedPath(item.path) : false;
          if (children.length > 0) return { ...item, children };
          if (pathOk) return item;
          return null;
        })
        .filter(Boolean);

    items = filterByPathAllowlist(items);
  }

  // Step 2: filter by module_access (SUPERADMIN bypasses this — sees everything)
  if (roleKey !== "SUPERADMIN") {
    const allowedModulesRaw = await getUserModuleAccess(username);
    const allowedModules = applySuperadminOnlyModuleRestrictions(
      allowedModulesRaw,
      roleKey,
    );
    // allowedModules === null means column not set yet → show all (backward compat)
    if (allowedModules !== null) {
      items = items.filter((item) => {
        if (!item.moduleKey) return true; // no restriction → always show
        return isSectionAllowed(item.moduleKey, allowedModules);
      });
    }
  }

  return items;
}
