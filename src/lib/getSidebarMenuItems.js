// lib/getSidebarMenuItems.js users
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getSessionPayload } from "./auth";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const allMenuItems = [
  {
    path: "/user-dashboard",
    name: "Dashboard",
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
        name: "Attendance",
        roles: ["ALL"],
        icon: "ListOrdered",
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
    roles: ["ADMIN", "ACCOUNTANT", "SALES", "SALES HEAD"],
    icon: "FileText",
  },
  {
    name: "Reports",
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
    roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"],
    icon: "Receipt",
  },
  {
    name: "Orders",
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
    roles: ["ACCOUNTANT"],
    icon: "DollarSign",
  },
  {
    path: "/user-dashboard/attendance-log/",
    name: "All Attendance",
    roles: ["ADMIN", "ACCOUNTANT", "HR", "TEAM LEADER"],
    icon: "ListOrdered",
  },
  {
    path: "/user-dashboard/new_upload",
    name: "Leads Upload",
    roles: ["DIGITAL MARKETER", "TEAM LEADER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/blogs",
    name: "Blog",
    roles: ["DIGITAL MARKETER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/my-leads",
    name: "My Leads",
    roles: ["DIGITAL MARKETER", "TEAM LEADER"],
    icon: "Upload",
  },

  {
    // path: "/user-dashboard/customers",
    name: "View Customers",
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
    roles: ["TEAM LEADER"],
    icon: "Users",
  },

  {
    path: "/user-dashboard/demo_details",
    name: "Demo Details",
    roles: ["ALL"],
    icon: "PlayCircle",
  },
  {
    path: "/user-dashboard/quotations",
    name: "Quotation",
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
    path: "/user-dashboard/all-expenses",
    name: "View Expenses",
    roles: ["ACCOUNTANT", "ADMIN", "TEAM LEADER"],
    icon: "DollarSign",
  },
  {
    name: "Service History",
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
    roles: ["ADMIN", "GRAPHIC DESIGNER", "SERVICE HEAD", "DIGITAL MARKETER"],
    icon: "Mail",
  },

  {
    name: "Warranty",
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
    roles: ["SALES", "SALES HEAD"],
    icon: "PlayCircle",
  },
  {
    path: "/user-dashboard/assets-management",
    name: "Assets",
    roles: ["ADMIN", "ACCOUNTANT"],
    icon: "FileText",
  },
  {
    path: "/user-dashboard/product-stock",
    name: "Price List",
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
    roles: ["ADMIN", "ACCOUNTANT", "WAREHOUSE INCHARGE"],
    icon: "ClipboardList",
  },
  {
    name: "Purchase Products",
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
    roles: ["ALL"],
    icon: "BookOpen",
  },
  {
    path: "/user-dashboard/company-documents",
    name: "Company Documents",
    roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT"],
    icon: "FileText",
  },
  {
    path: "/user-dashboard/employees",
    name: "Employees",
    roles: ["HR"],
    icon: "UserPlus",
  },
  {
    path: "/user-dashboard/dd-management",
    name: "DD Management",
    roles: ["ALL"],
    icon: "DollarSign",
  },
  {
    path: "/empcrm/user-dashboard",
    name: "Employee CRM",
    roles: ["ALL"],
    icon: "User",
  },
];

export default async function getSidebarMenuItems() {
  const payload = await getSessionPayload(); // Get the full session payload

  let role = payload?.role || "GUEST";

  return allMenuItems.filter(
    (item) => item.roles.includes("ALL") || item.roles.includes(role),
  );
}
