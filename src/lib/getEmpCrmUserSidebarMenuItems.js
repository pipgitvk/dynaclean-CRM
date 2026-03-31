import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getReportees } from "@/lib/reportingManager";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const empCrmUserMenuItems = [
  { path: "/empcrm/user-dashboard", name: "EMPCRM Dashboard", roles: ["ALL"], icon: "Home" },
  { path: "/empcrm/user-dashboard/profile", name: "My Profile", roles: ["ALL"], icon: "UserCircle" },
  { path: "/empcrm/user-dashboard/leave", name: "Leave", roles: ["ALL"], icon: "Calendar" },
  { path: "/empcrm/user-dashboard/leave-approvals", name: "Leave Approvals", roles: ["REPORTING_MANAGER"], icon: "CheckSquare" },
  { path: "/empcrm/user-dashboard/attendance-summary", name: "Attendance Summary", roles: ["ALL"], icon: "Grid3x3" },
  { path: "/empcrm/user-dashboard/attendance", name: "Attendance details", roles: ["ALL"], icon: "Clock" },
  { path: "/empcrm/user-dashboard/documents", name: "Documents", roles: ["ALL"], icon: "FileText" },
  { path: "/empcrm/user-dashboard/salary", name: "Salary", roles: ["ALL"], icon: "DollarSign" },
  { path: "/empcrm/user-dashboard/payslips", name: "Payslips", roles: ["ALL"], icon: "Receipt" },
  { path: "/empcrm/user-dashboard/settings", name: "Settings", roles: ["ALL"], icon: "Settings" },
];

export default async function getEmpCrmUserSidebarMenuItems() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let role = "GUEST";
  let hasReportees = false;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      role = payload?.role || "GUEST";
      if (payload?.username) {
        const reportees = await getReportees(payload.username);
        hasReportees = reportees.length > 0;
      }
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  return empCrmUserMenuItems.filter((item) => {
    if (item.roles.includes("ALL")) return true;
    if (item.roles.includes(role)) return true;
    if (item.roles.includes("REPORTING_MANAGER") && hasReportees) return true;
    return false;
  });
}