import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const empCrmUserMenuItems = [
  { path: "/empcrm/user-dashboard", name: "EMPCRM Dashboard", roles: ["ALL"], icon: "Home" },
  { path: "/empcrm/user-dashboard/profile", name: "My Profile", roles: ["ALL"], icon: "UserCircle" },
  { path: "/empcrm/user-dashboard/leave", name: "Leave", roles: ["ALL"], icon: "Calendar" },
  { path: "/empcrm/user-dashboard/attendance", name: "Attendance", roles: ["ALL"], icon: "Clock" },
  { path: "/empcrm/user-dashboard/documents", name: "Documents", roles: ["ALL"], icon: "FileText" },
  { path: "/empcrm/user-dashboard/salary", name: "Salary", roles: ["ALL"], icon: "DollarSign" },
  // { path: "/empcrm/user-dashboard/payslip", name: "Payslip", roles: ["ALL"], icon: "Receipt", disabled: true },
  { path: "/empcrm/user-dashboard/settings", name: "Settings", roles: ["ALL"], icon: "Settings" },
];

export default async function getEmpCrmUserSidebarMenuItems() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let role = "GUEST";

  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      role = payload?.role || "GUEST";
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  return empCrmUserMenuItems.filter(
    (item) => item.roles.includes("ALL") || item.roles.includes(role)
  );
}