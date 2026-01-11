// components/user/SidebarWrapper.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { TextEncoder as NodeTextEncoder } from "util";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const TextEncoderImpl =
  typeof TextEncoder !== "undefined" ? TextEncoder : NodeTextEncoder;

const allMenuItems = [
  { path: "/user-dashboard", name: "Dashboard", roles: ["ALL"], icon: "Home" },
  {
    path: "/user-dashboard/order",
    name: "Order Process",
    roles: ["ALL"],
    icon: "ListOrdered",
  },
  {
    path: "/new_upload",
    name: "Leads Upload",
    roles: ["DIGITAL MARKETER"],
    icon: "Upload",
  },
  {
    path: "/user-dashboard/add-customer",
    name: "New Followup",
    roles: ["ALL"],
    icon: "FilePlus2",
  },
  {
    path: "/user-dashboard/customers",
    name: "View Followups",
    roles: ["ALL"],
    icon: "ScrollText",
  },
  {
    path: "/demo_regi_reports",
    name: "Demo Status",
    roles: ["SALES"],
    icon: "ClipboardList",
  },
  {
    path: "/user-dashboard/task-manager",
    name: "Task Manager",
    roles: ["ALL"],
    icon: "ClipboardList",
  },
  {
    path: "/user-dashboard/quotations",
    name: "Quotation",
    roles: ["SALES", "ADMIN", "BACK OFFICE", "DIGITAL MARKETER"],
    icon: "FileSignature",
  },
  {
    path: "/user-dashboard/expenses",
    name: "Expense",
    roles: ["ALL"],
    icon: "DollarSign",
  },
  {
    path: "/user-dashboard/all-expenses",
    name: "View Expense",
    roles: ["ACCOUNTANT"],
    icon: "DollarSign",
  },
  {
    path: "/view_service_reports",
    name: "Service History",
    roles: ["SERVICE ENGINEER"],
    icon: "BookOpen",
  },
  {
    path: "/view_service_reports_admin",
    name: "Service History",
    roles: ["ADMIN"],
    icon: "BookOpen",
  },
  {
    path: "/view_warranty",
    name: "All Products",
    roles: ["ADMIN"],
    icon: "ShieldCheck",
  },
  {
    path: "/warranty_register",
    name: "Register Product",
    roles: ["ADMIN"],
    icon: "ShieldCheck",
  },
  {
    path: "/user-dashboard/reports",
    name: "Report",
    roles: ["ADMIN", "BACK OFFICE"],
    icon: "FileText",
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
        new TextEncoderImpl().encode(JWT_SECRET)
      );
      role = payload?.role || "GUEST";
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  return allMenuItems.filter(
    (item) => item.roles.includes("ALL") || item.roles.includes(role)
  );
}
