import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const empCrmMenuItems = [
  { path: "/empcrm/admin-dashboard", name: "EMPCRM Dashboard", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "Home" },
  { path: "/empcrm/admin-dashboard/profile", name: "Profile Management", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "UserCircle" },
  { path: "/empcrm/admin-dashboard/profile/approvals", name: "Profile Approvals", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "UserCircle" },
  { path: "/empcrm/admin-dashboard/leave", name: "Leave Management", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "Calendar" },
  { path: "/empcrm/admin-dashboard/attendance", name: "Attendance", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "Clock" },
  { path: "/empcrm/admin-dashboard/documents", name: "Documents", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "FileText" },
  { path: "/empcrm/admin-dashboard/salary", name: "Salary Management", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "DollarSign" },
  // { path: "/empcrm/admin-dashboard/payslip", name: "Payslip", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "Receipt", disabled: true },
];

export default async function getEmpCrmAdminSidebarMenuItems() {
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

  return empCrmMenuItems.filter(
    (item) => item.roles.includes("ALL") || item.roles.includes(role)
  );
}
