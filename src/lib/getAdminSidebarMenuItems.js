// import { cookies } from "next/headers";
// import { jwtVerify } from "jose";

// const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

// const allMenuItems = [
//   { path: "/admin-dashboard", name: "Dashboard", roles: ["ALL"], icon: "Home" },
//   { path: "/admin-dashboard/today-reports", name: "Daily Report", roles: ["SUPERADMIN"], icon: "FileText" },
//   {
//     name: "Reports",
//     roles: ["SUPERADMIN"],
//     icon: "ScrollText",
//     children: [
//       { path: "/admin-dashboard/lead-reports", name: "Lead Reports", roles: ["SUPERADMIN"], icon: "FileText" },
//       { path: "/admin-dashboard/quot-report", name: "Quotations Report", roles: ["SUPERADMIN"], icon: "FileText" },
//       { path: "/admin-dashboard/order-followups", name: "Order Report", roles: ["SUPERADMIN"], icon: "FileText" },
//       { path: "/admin-dashboard/demo-registrations", name: "Demo Followups", roles: ["SUPERADMIN"], icon: "FileText" },
//       { path: "/admin-dashboard/reports/payment-pending", name: "Payment Pending", roles: ["SUPERADMIN"], icon: "DollarSign" },
//       { path: "/admin-dashboard/reports/item-wise-sales", name: "Item Wise Sales", roles: ["SUPERADMIN"], icon: "FileText" },
//       { path: "/admin-dashboard/reports/customer-payment-behavior", name: "Customer Payment Behavior", roles: ["SUPERADMIN"], icon: "FileText" },
//     ],
//   },
//   {
//     name: "Targets",
//     roles: ["SUPERADMIN"],
//     icon: "Target",
//     children: [
//       { path: "/admin-dashboard/assign-targets", name: "Assign", roles: ["SUPERADMIN"], icon: "FileText" },
//       { path: "/admin-dashboard/monitor-targets", name: "Monitor", roles: ["SUPERADMIN"], icon: "FileText" },
//     ],
//   },
//   {
//     name: "Orders",
//     roles: ["SUPERADMIN"],
//     icon: "ListOrdered",
//     children: [
//       { path: "/admin-dashboard/order", name: "Order Process", roles: ["SUPERADMIN"], icon: "ListOrdered" },
//       { path: "/admin-dashboard/order/delivery-status", name: "Delay Delivery", roles: ["SUPERADMIN"], icon: "ListOrdered" },
//     ],
//   },
//   // { path: "/new_upload", name: "Leads Upload", roles: ["SUPERADMIN"], icon: "Upload" },
//   { path: "/admin-dashboard/bulk-reassign", name: "Bulk Reassign Leads", roles: ["SUPERADMIN"], icon: "Upload" },
//   { path: "/admin-dashboard/my-leads", name: "My Leads", roles: ["SUPERADMIN"], icon: "Upload" },
//   { path: "/admin-dashboard/add-customer", name: "Add Customer", roles: ["SUPERADMIN"], icon: "FilePlus2" },
//   { path: "/admin-dashboard/customers", name: "View Customers", roles: ["SUPERADMIN"], icon: "ScrollText" },
//   { path: "/admin-dashboard/tl-customers", name: "TL Management", roles: ["SUPERADMIN"], icon: "Users" },
//   { path: "/admin-dashboard/lead-distribution", name: "Lead Distribution", roles: ["SUPERADMIN"], icon: "ScrollText" },
//   { path: "/admin-dashboard/task-manager", name: "Task Manager", roles: ["SUPERADMIN"], icon: "ClipboardList" },
//   { path: "/admin-dashboard/product-stock", name: "Products", roles: ["SUPERADMIN"], icon: "ClipboardList" },
//   { path: "/admin-dashboard/product-accessories", name: "Product Accessories", roles: ["SUPERADMIN"], icon: "ClipboardList" },
//   {
//     name: "Purchase Products",
//     roles: ["SUPERADMIN"],
//     icon: "ShoppingCart",
//     children: [
//       { path: "/admin-dashboard/purchase/direct-in", name: "Direct In", roles: ["SUPERADMIN"], icon: "PackageCheck" },
//       { path: "/admin-dashboard/purchase/generate-request", name: "Generate Request", roles: ["SUPERADMIN"], icon: "FilePlus" },
//       { path: "/admin-dashboard/purchase/warehouse-in", name: "Warehouse In", roles: ["SUPERADMIN"], icon: "PackageCheck" },
//       { path: "/admin-dashboard/purchase/purchases", name: "Purchases", roles: ["SUPERADMIN"], icon: "ShoppingBag" },
//     ],
//   },
//   { path: "/admin-dashboard/spare", name: "Spare Parts", roles: ["SUPERADMIN"], icon: "ClipboardList" },
//   {
//     name: "Purchase Spares",
//     roles: ["SUPERADMIN"],
//     icon: "ShoppingCart",
//     children: [
//       { path: "/admin-dashboard/spare/purchase/direct-in", name: "Direct In", roles: ["SUPERADMIN"], icon: "PackageCheck" },
//       { path: "/admin-dashboard/spare/purchase/generate-request", name: "Generate Request", roles: ["SUPERADMIN"], icon: "FilePlus" },
//       { path: "/admin-dashboard/spare/purchase/warehouse-in", name: "Warehouse In", roles: ["SUPERADMIN"], icon: "PackageCheck" },
//       { path: "/admin-dashboard/spare/purchase/purchases", name: "Purchases", roles: ["SUPERADMIN"], icon: "ShoppingBag" }
//     ],
//   },
//   {
//     name: "Productions",
//     roles: ["SUPERADMIN"],
//     icon: "PackageCheck",
//     children: [
//       { path: "/admin-dashboard/productions/status", name: "Production Status", roles: ["SUPERADMIN"], icon: "ListOrdered" },
//       { path: "/admin-dashboard/productions/bom-list", name: "BOM List", roles: ["SUPERADMIN"], icon: "ClipboardList" }
//     ],
//   },
//   { path: "/admin-dashboard/demo_details", name: "Demo Details", roles: ["SUPERADMIN"], icon: "PlayCircle" },
//   { path: "/admin-dashboard/quotations", name: "Quotation", roles: ["SUPERADMIN"], icon: "FileSignature" },
//   { path: "/admin-dashboard/expenses", name: "Expense", roles: ["SUPERADMIN"], icon: "DollarSign" },
//   // { path: "/admin-dashboard/all-expenses", name: "View Expenses", roles: ["SUPERADMIN"], icon: "DollarSign" },
//   { path: "/admin-dashboard/manual-payments", name: "Manual Payments", roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"], icon: "Receipt" },
//   {
//     name: "Service History",
//     roles: ["SUPERADMIN"],
//     icon: "BookOpen",
//     children: [
//       { path: "/admin-dashboard/view_service_reports", name: "Service Records", roles: ["SUPERADMIN"], icon: "BookOpen" },
//       { path: "/admin-dashboard/view_service_reports/upcoming-installation", name: "Upcoming Installations", roles: ["SUPERADMIN"], icon: "BookOpen" },
//       { path: "/admin-dashboard/view_service_reports/map", name: "Service Map", roles: ["SUPERADMIN"], icon: "MapPin" },
//     ],
//   },
//   { path: "/admin-dashboard/email-templates", name: "Email Templates", roles: ["SUPERADMIN"], icon: "Mail" },
//   {
//     name: "Warranty",
//     roles: ["SUPERADMIN"],
//     icon: "ShieldCheck",
//     children: [
//       { path: "/admin-dashboard/warranty", name: "Product Console", roles: ["SUPERADMIN"], icon: "ShieldCheck" },
//       { path: "/admin-dashboard/warranty/products", name: "Registered Products", roles: ["SUPERADMIN"], icon: "ShieldCheck" },
//       { path: "/admin-dashboard/warranty/map", name: "Map View", roles: ["SUPERADMIN"], icon: "MapPin" },
//     ],
//   },
//   { path: "/admin-dashboard/holidays", name: "Holidays", roles: ["SUPERADMIN"], icon: "Calendar" },
//   {
//     name: "Knowledge Base",
//     roles: ["SUPERADMIN"],
//     icon: "BookOpen",
//     children: [
//       { path: "/admin-dashboard/qa-approval", name: "Q&A Approval", roles: ["SUPERADMIN"], icon: "BookOpen" },
//       { path: "/admin-dashboard/qa", name: "Q&A", roles: ["SUPERADMIN"], icon: "BookOpen" },
//     ],
//   },
//   { path: "/admin-dashboard/company-documents", name: "Company Documents", roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"], icon: "FileText" },
//   { path: "/admin-dashboard/employees", name: "Employee", roles: ["SUPERADMIN"], icon: "ShieldCheck" },
//   { path: "/admin-dashboard/dd-management", name: "DD Management", roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"], icon: "DollarSign" },
//   { path: "/empcrm", name: "Employee CRM", roles: ["SUPERADMIN", "HR", "HR HEAD"], icon: "User" },

// ];

// export default async function getSidebarMenuItems() {
//   const cookieStore = await cookies();
//   const token = cookieStore.get("token")?.value;

//   let role = "GUEST";

//   if (token) {
//     try {
//       const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
//       role = payload?.role || "GUEST";
//     } catch (error) {
//       console.error("JWT decode error:", error.message);
//     }
//   }

//   return allMenuItems.filter(
//     (item) => item.roles.includes("ALL") || item.roles.includes(role)
//   );
// }

import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { TextEncoder as NodeTextEncoder } from "util";
import { getDbConnection } from "@/lib/db";
import {
  ATTENDANCE_RULES_ALLOWED_ROLES,
  normalizeRoleKey,
} from "@/lib/adminAttendanceRulesAuth";
import { parseModuleAccess, isSectionAllowed } from "@/lib/moduleAccess";

const FINAL_PROFILE_APPROVAL_PATH =
  "/empcrm/admin-dashboard/profile/approvals-admin";

async function countPendingFinalProfileApprovals() {
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM employee_profile_submissions WHERE status = 'pending_admin'`,
    );
    return Number(rows[0]?.c ?? 0);
  } catch (e) {
    return 0;
  }
}

function attachFinalProfileApprovalBadge(items, pendingCount) {
  return items.map((item) => {
    if (item.path === FINAL_PROFILE_APPROVAL_PATH) {
      return { ...item, badgeCount: pendingCount };
    }
    if (item.children?.length) {
      return {
        ...item,
        children: attachFinalProfileApprovalBadge(item.children, pendingCount),
      };
    }
    return item;
  });
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

// Ensure a TextEncoder is available in all Node runtimes
const TextEncoderImpl =
  typeof TextEncoder !== "undefined" ? TextEncoder : NodeTextEncoder;

const allMenuItems = [
  //dashboard section
  {
    name: "Dashboard",
    moduleKey: "dashboard",
    roles: ["SUPERADMIN"],
    icon: "Home",
    children: [
      {
        path: "/admin-dashboard",
        name: "Dashboard",
        roles: ["ALL"],
        icon: "Home",
      },
      // {
      //   path: "/admin-dashboard/attendance-regularization",
      //   name: "Attendance regularization",
      //   roles: ["SUPERADMIN", "ADMIN", "HR"],
      //   icon: "Clock",
      // },
      {
        path: "/admin-dashboard/today-reports",
        name: "Daily Report",
        roles: ["SUPERADMIN"],
        icon: "FileText",
      },
      {
        name: "Reports",
        roles: ["SUPERADMIN"],
        icon: "ScrollText",
        children: [
          {
            path: "/admin-dashboard/lead-reports",
            name: "Lead Reports",
            roles: ["SUPERADMIN"],
            icon: "FileText",
          },
          {
            path: "/admin-dashboard/quot-report",
            name: "Quotations Report",
            roles: ["SUPERADMIN"],
            icon: "FileText",
          },
          {
            path: "/admin-dashboard/order-followups",
            name: "Order Report",
            roles: ["SUPERADMIN"],
            icon: "FileText",
          },
          {
            path: "/admin-dashboard/demo-registrations",
            name: "Demo Followups",
            roles: ["SUPERADMIN"],
            icon: "FileText",
          },

          {
            path: "/admin-dashboard/reports/item-wise-sales",
            name: "Item Wise Sales",
            roles: ["SUPERADMIN"],
            icon: "FileText",
          },
          {
            path: "/admin-dashboard/reports/customer-payment-behavior",
            name: "Customer Payment Behavior",
            roles: ["SUPERADMIN"],
            icon: "FileText",
          },
        ],
      },
      {
        name: "Targets",
        roles: ["SUPERADMIN"],
        icon: "Target",
        children: [
          // {
          //   path: "/admin-dashboard/assign-targets",
          //   name: "Assign",
          //   roles: ["SUPERADMIN"],
          //   icon: "FileText",
          // },
          {
            path: "/admin-dashboard/hr-designation-targets",
            name: "HR designation targets",
            roles: ["SUPERADMIN"],
            icon: "FileText",
          },
          {
            path: "/admin-dashboard/monitor-targets",
            name: "Monitor",
            roles: ["SUPERADMIN", "ACCOUNTANT"],
            icon: "FileText",
          },
        ],
      },
      {
        path: "/admin-dashboard/lead-distribution",
        name: "Lead Distribution",
        roles: ["SUPERADMIN"],
        icon: "ScrollText",
      },
      {
        name: "Orders",
        roles: ["SUPERADMIN"],
        icon: "ListOrdered",
        children: [
          {
            path: "/admin-dashboard/order",
            name: "Order Process",
            roles: ["SUPERADMIN"],
            icon: "ListOrdered",
          },
          {
            path: "/admin-dashboard/order/delivery-status",
            name: "Delay Delivery",
            roles: ["SUPERADMIN"],
            icon: "ListOrdered",
          },
        ],
      },
      
      {
        path: "/admin-dashboard/bulk-reassign",
        name: "Bulk Reassign Leads",
        roles: ["SUPERADMIN"],
        icon: "Upload",
      },
      {
        path: "/admin-dashboard/my-leads",
        name: "My Leads",
        roles: ["SUPERADMIN"],
        icon: "Upload",
      },
      {
        path: "/user-dashboard/digital-marketer-leads",
        name: "24h Fresh Leads (DM)",
        roles: ["SUPERADMIN", "DIGITAL MARKETER"],
        icon: "Clock",
      },
      {
        path: "/admin-dashboard/task-manager",
        name: "Task Manager",
        roles: ["SUPERADMIN"],
        icon: "ClipboardList",
      },
      {
        path: "/admin-dashboard/demo_details",
        name: "Demo Details",
        roles: ["SUPERADMIN"],
        icon: "PlayCircle",
      },
    ],
  },
  {
    name: "Prospects",
    moduleKey: "prospects",
    roles: ["SUPERADMIN", "ADMIN", "SALES", "SALES HEAD"],
    icon: "UserPlus",
    children: [
      {
        path: "/user-dashboard",
        name: "Back to user dashboard",
        roles: ["SALES", "SALES HEAD"],
        icon: "ArrowLeft",
        sidebarVariant: "lightRed",
      },
      {
        path: "/admin-dashboard/prospects",
        name: "View prospects",
        roles: ["SUPERADMIN", "ADMIN", "SALES", "SALES HEAD"],
        icon: "UserPlus",
      },
    ],
  },
  // tl management section
  {
    name: "TL Management",
    moduleKey: "tl-management",
    roles: ["SUPERADMIN"],
    icon: "Users",
    children: [
      {
        path: "/admin-dashboard/tl-customers",
        name: "TL Management",
        roles: ["SUPERADMIN"],
        icon: "Users",
      },
      {
        path: "/admin-dashboard/add-customer",
        name: "Add Customer",
        roles: ["SUPERADMIN"],
        icon: "FilePlus2",
      },
      {
        path: "/admin-dashboard/customers",
        name: "View Customers",
        roles: ["SUPERADMIN"],
        icon: "ScrollText",
      },
  //       {
  //   name: "Special Pricing",
  //   path: "/admin-dashboard/special-pricing",
  //   roles: ["SUPERADMIN"],
  //   icon: "ScrollText",
  //   children: [
  //     {
  //       path: "/admin-dashboard/special-pricing",
  //       name: "All Special Prices",
  //       roles: ["ADMIN"],
  //       icon: "List",
  //     },
  //     {
  //       path: "/admin-dashboard/special-pricing/new",
  //       name: "Create Special Price",
  //       roles: ["ADMIN"],
  //       icon: "FilePlus2",
  //     }
  //   ],
  // },
     
      {
        path: "/admin-dashboard/quotations",
        name: "Quotation",
        roles: ["SUPERADMIN"],
        icon: "FileSignature",
      },
      {
        path: "/admin-dashboard/invoices",
        name: "Invoices",
        roles: ["SUPERADMIN"],
        icon: "FileText",
      },
      {
        name: "Service History",
        roles: ["SUPERADMIN"],
        icon: "BookOpen",
        children: [
          {
            path: "/admin-dashboard/view_service_reports",
            name: "Service Records",
            roles: ["SUPERADMIN"],
            icon: "BookOpen",
          },
          {
            path: "/admin-dashboard/view_service_reports/upcoming-installation",
            name: "Upcoming Installations",
            roles: ["SUPERADMIN"],
            icon: "BookOpen",
          },
          {
            path: "/admin-dashboard/view_service_reports/map",
            name: "Service Map",
            roles: ["SUPERADMIN"],
            icon: "MapPin",
          },
        ],
      },
    ],
  },
  // product section
  {
    name: "Products",
    moduleKey: "products",
    roles: ["SUPERADMIN"],
    icon: "ShoppingCart",
    children: [
      {
        path: "/admin-dashboard/product-stock",
        name: "Products",
        roles: ["SUPERADMIN"],
        icon: "ClipboardList",
      },
      {
        path: "/admin-dashboard/product-accessories",
        name: "Product Accessories",
        roles: ["SUPERADMIN"],
        icon: "ClipboardList",
      },
      {
        name: "Purchase Products",
        roles: ["SUPERADMIN"],
        icon: "ShoppingCart",
        children: [
          {
            path: "/admin-dashboard/purchase/direct-in",
            name: "Direct In",
            roles: ["SUPERADMIN"],
            icon: "PackageCheck",
          },
          {
            path: "/admin-dashboard/purchase/generate-request",
            name: "Generate Request",
            roles: ["SUPERADMIN"],
            icon: "FilePlus",
          },
          {
            path: "/admin-dashboard/purchase/warehouse-in",
            name: "Warehouse In",
            roles: ["SUPERADMIN"],
            icon: "PackageCheck",
          },
          {
            path: "/admin-dashboard/purchase/purchases",
            name: "Purchases",
            roles: ["SUPERADMIN"],
            icon: "ShoppingBag",
          },
        ],
      },
      {
        path: "/admin-dashboard/spare",
        name: "Spare Parts",
        roles: ["SUPERADMIN"],
        icon: "ClipboardList",
      },
      {
        name: "Purchase Spares",
        roles: ["SUPERADMIN"],
        icon: "ShoppingCart",
        children: [
          {
            path: "/admin-dashboard/spare/purchase/direct-in",
            name: "Direct In",
            roles: ["SUPERADMIN"],
            icon: "PackageCheck",
          },
          {
            path: "/admin-dashboard/spare/purchase/generate-request",
            name: "Generate Request",
            roles: ["SUPERADMIN"],
            icon: "FilePlus",
          },
          {
            path: "/admin-dashboard/spare/purchase/warehouse-in",
            name: "Warehouse In",
            roles: ["SUPERADMIN"],
            icon: "PackageCheck",
          },
          {
            path: "/admin-dashboard/spare/purchase/purchases",
            name: "Purchases",
            roles: ["SUPERADMIN"],
            icon: "ShoppingBag",
          },
        ],
      },
      {
        name: "Productions",
        roles: ["SUPERADMIN"],
        icon: "PackageCheck",
        children: [
          {
            path: "/admin-dashboard/productions/status",
            name: "Production Status",
            roles: ["SUPERADMIN"],
            icon: "ListOrdered",
          },
          {
            path: "/admin-dashboard/productions/bom-list",
            name: "BOM List",
            roles: ["SUPERADMIN"],
            icon: "ClipboardList",
          },
        ],
      },
      {
        name: "Warranty",
        roles: ["SUPERADMIN"],
        icon: "ShieldCheck",
        children: [
          {
            path: "/admin-dashboard/warranty",
            name: "Product Console",
            roles: ["SUPERADMIN"],
            icon: "ShieldCheck",
          },
          {
            path: "/admin-dashboard/warranty/products",
            name: "Registered Products",
            roles: ["SUPERADMIN"],
            icon: "ShieldCheck",
          },
          {
            path: "/admin-dashboard/warranty/map",
            name: "Map View",
            roles: ["SUPERADMIN"],
            icon: "MapPin",
          },
        ],
      },
    ],
  },

  

  // employee section
  {
    name: "Employee",
    moduleKey: "employee",
    roles: ["SUPERADMIN"],
    icon: "UserCircle",
    children: [
      {
        path: "/admin-dashboard/employees",
        name: "Employee",
        roles: ["SUPERADMIN"],
        icon: "ShieldCheck",
      },

      {
        path: "/empcrm",
        name: "Employee CRM",
        roles: ["SUPERADMIN", "HR", "HR HEAD"],
        icon: "User",
      },
    ],
  },

  // company documents section
  {
    name: "Documents",
    moduleKey: "documents",
    roles: ["SUPERADMIN"],
    icon: "FileText",
    children: [
      {
        path: "/admin-dashboard/company-documents",
        name: "Company Documents",
        roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"],
        icon: "FileText",
      },
      {
        path: "/admin-dashboard/dd-management",
        name: "DD Management",
        roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"],
        icon: "Receipt",
      },
      {
        name: "Knowledge Base",
        roles: ["SUPERADMIN"],
        icon: "BookOpen",
        children: [
          {
            path: "/admin-dashboard/qa-approval",
            name: "Q&A Approval",
            roles: ["SUPERADMIN"],
            icon: "BookOpen",
          },
          {
            path: "/admin-dashboard/qa",
            name: "Q&A",
            roles: ["SUPERADMIN"],
            icon: "BookOpen",
          },
        ],
      },
      {
        path: "/admin-dashboard/email-templates",
        name: "Email Templates",
        roles: ["SUPERADMIN"],
        icon: "Mail",
      },
      {
        path: "/admin-dashboard/holidays",
        name: "Holidays",
        roles: ["SUPERADMIN"],
        icon: "Calendar",
      },
    ],
  },

  // payments section
  {
    name: "Payments",
    moduleKey: "payments",
    roles: ["SUPERADMIN"],
    icon: "DollarSign",
    children: [
      {
        path: "/admin-dashboard/reports/payment-pending",
        name: "Payment Pending",
        roles: ["SUPERADMIN"],
        icon: "DollarSign",
      },
      {
        path: "/admin-dashboard/manual-payments",
        name: "Manual Payments",
        roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"],
        icon: "Receipt",
      },
      {
        path: "/admin-dashboard/expenses",
        name: "Expense",
        roles: ["SUPERADMIN"],
        icon: "DollarSign",
      },
    ],
  },
  {
    name: "Tally Payments",
    moduleKey: "tally-payments",
    roles: ["SUPERADMIN", "ACCOUNTANT"],
    icon: "Receipt",
    children: [
      {
        path: "/user-dashboard",
        name: "Back to user dashboard",
        roles: ["ACCOUNTANT"],
        icon: "ArrowLeft",
        sidebarVariant: "lightRed",
      },
      {
        path: "/admin-dashboard/client-expenses/cards",
        name: "Client Expenses",
        roles: ["SUPERADMIN", "ACCOUNTANT"],
        icon: "Users",
      },
      {
        path: "/admin-dashboard/statements",
        name: "Statement",
        roles: ["SUPERADMIN", "ACCOUNTANT"],
        icon: "Receipt",
      },
      {
        path: "/empcrm/admin-dashboard/salary-slips",
        name: "Salary slips",
        roles: ["SUPERADMIN", "ACCOUNTANT"],
        icon: "Receipt",
      },
      
    ],
  },


  
    {
      name: "Import CRM",
      moduleKey: "import-crm",
      roles: ["SUPERADMIN"],
      icon: "Import",
      children: [
        
        {
          path: "/admin-dashboard/import-crm/agents",
          name: "Agents",
          roles: ["SUPERADMIN"],
          icon: "UserPlus",
        },
        {
          path: "/admin-dashboard/import-crm/suppliers",
          name: "Suppliers",
          roles: ["SUPERADMIN"],
          icon: "Users",
        },
        {
          path: "/admin-dashboard/import-crm/shipments",
          name: "Shipments",
          roles: ["SUPERADMIN"],
          icon: "Ship",
        },
        {
          path: "/admin-dashboard/import-crm/quote-submissions",
          name: "Quote submissions",
          roles: ["SUPERADMIN"],
          icon: "ScrollText",
        },
        {
          path: "/admin-dashboard/import-crm/award-followups",
          name: "Award follow-ups",
          roles: ["SUPERADMIN"],
          icon: "PackageCheck",
        },
        {
          path: "/admin-dashboard/import-crm/billing",
          name: "Billing",
          roles: ["SUPERADMIN"],
          icon: "Receipt",
        },
      
        
        
      
         // {
         //   path: "/admin-dashboard/import-crm/purchase-orders",
         //   name: "Purchase Orders",
         //   roles: ["SUPERADMIN"],
        //   icon: "FileText",
        // },
      ],
    },
  {
    path: "/admin-dashboard/attendance-rules",
    name: "Attendance rules",
    moduleKey: "attendance-rules",
    roles: [...ATTENDANCE_RULES_ALLOWED_ROLES],
    icon: "Clock",
  },
  {
    path: "/empcrm/admin-dashboard/profile/approvals-admin",
    name: "Final profile approval",
    moduleKey: "final-profile-approval",
    roles: ["SUPERADMIN"],
    icon: "UserCircle",
  },
  {
    path: "/admin-dashboard/hiring-process",
    name: "Hiring Process",
    moduleKey: "hiring-process",
    roles: ["SUPERADMIN"],
    icon: "Briefcase",
  },
];

function filterMenuItemsByRole(items, roleKeyNormalized) {
  if (!items?.length) return [];
  return items
    .map((item) => {
      const roleOk =
        item.roles?.includes("ALL") ||
        item.roles?.some((r) => normalizeRoleKey(r) === roleKeyNormalized);
      if (!roleOk) return null;

      if (!item.children?.length) {
        return item;
      }

      const children = filterMenuItemsByRole(item.children, roleKeyNormalized);
      if (children.length === 0) {
        return null;
      }
      return { ...item, children };
    })
    .filter(Boolean);
}

async function getAdminRoleKeyNormalized() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let role = "GUEST";

  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoderImpl().encode(JWT_SECRET),
      );
      role = (payload?.role ?? payload?.userRole) || "GUEST";
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  return normalizeRoleKey(role || "GUEST") || "GUEST";
}

async function getSessionUsername() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoderImpl().encode(JWT_SECRET),
    );
    return payload?.username || null;
  } catch {
    return null;
  }
}

/**
 * Fetch module_access for the logged-in user from rep_list.
 * Returns parsed array of module keys, or null if column doesn't exist / user not found.
 */
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
    // If column doesn't exist yet, allow all
    return null;
  }
}

/**
 * Filter top-level menu items by the user's allowed modules.
 * Uses isSectionAllowed which checks both parent key AND any child key.
 * Items without a moduleKey are always shown.
 * SUPERADMIN always sees everything (no module restriction).
 */
function filterMenuItemsByModuleAccess(items, allowedModules) {
  if (!allowedModules) return items;
  return items.filter((item) => {
    if (!item.moduleKey) return true;
    return isSectionAllowed(item.moduleKey, allowedModules);
  });
}

export default async function getSidebarMenuItems() {
  const roleKeyNormalized = await getAdminRoleKeyNormalized();
  let items = filterMenuItemsByRole(allMenuItems, roleKeyNormalized);

  // Apply module_access filtering for non-SUPERADMIN users
  if (roleKeyNormalized !== "SUPERADMIN") {
    const username = await getSessionUsername();
    const allowedModules = await getUserModuleAccess(username);
    items = filterMenuItemsByModuleAccess(items, allowedModules);
  }

  if (roleKeyNormalized === "SUPERADMIN") {
    const pending = await countPendingFinalProfileApprovals();
    items = attachFinalProfileApprovalBadge(items, pending);
  }
  return items;
}

/** User CRM is the default home for non–SUPERADMIN logins; hide “Back to user CRM” for SUPERADMIN. */
export async function getShowBackToUserCrm() {
  const roleKeyNormalized = await getAdminRoleKeyNormalized();
  return roleKeyNormalized !== "SUPERADMIN";
}
