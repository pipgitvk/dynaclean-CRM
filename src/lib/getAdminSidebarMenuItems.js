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

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

// Ensure a TextEncoder is available in all Node runtimes
const TextEncoderImpl =
  typeof TextEncoder !== "undefined" ? TextEncoder : NodeTextEncoder;

const allMenuItems = [
  //dashboard section
  {
    name: "Dashboard",
    roles: ["SUPERADMIN"],
    icon: "Home",
    children: [
      {
        path: "/admin-dashboard",
        name: "Dashboard",
        roles: ["ALL"],
        icon: "Home",
      },
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
          {
            path: "/admin-dashboard/assign-targets",
            name: "Assign",
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
  // tl management section
  {
    name: "TL Management",
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
      {
        path: "/admin-dashboard/quotations",
        name: "Quotation",
        roles: ["SUPERADMIN"],
        icon: "FileSignature",
      },
      {
        path: "/admin-dashboard/invoices",
        name: "Invoices",
        roles: ["SUPERADMIN","ACCOUNTANT"],
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
];

export default async function getSidebarMenuItems() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let role = "GUEST";

  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoderImpl().encode(JWT_SECRET),
      );
      role = payload?.role || "GUEST";
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  return allMenuItems.filter(
    (item) => item.roles.includes("ALL") || item.roles.includes(role),
  );
}
