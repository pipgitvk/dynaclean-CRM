import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getReportees } from "@/lib/reportingManager";
import { getDbConnection } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const empCrmUserMenuItems = [
  { path: "/empcrm/user-dashboard", name: "EMPCRM Dashboard", roles: ["ALL"], icon: "Home" },
  { path: "/empcrm/admin-dashboard", name: "Go to Admin Panel", roles: ["HR", "SUPERADMIN"], icon: "LayoutGrid" },
  { path: "/empcrm/user-dashboard/profile", name: "My Profile", roles: ["ALL"], icon: "UserCircle" },
  { path: "/empcrm/user-dashboard/leave", name: "Leave", roles: ["ALL"], icon: "Calendar" },
  { path: "/empcrm/user-dashboard/leave-approvals", name: "Leave Approvals", roles: ["REPORTING_MANAGER"], icon: "CheckSquare" },
  { path: "/empcrm/user-dashboard/attendance-summary", name: "Attendance Summary", roles: ["ALL"], icon: "Grid3x3" },
  { path: "/empcrm/user-dashboard/attendance", name: "Attendance details", roles: ["ALL"], icon: "Clock" },
  { path: "/empcrm/user-dashboard/attendance-regularization", name: "Attendance Regularization", roles: ["REPORTING_MANAGER"], moduleKey: "regularization-approvals", icon: "ClipboardCheck" },
  { path: "/empcrm/user-dashboard/overtime", name: "Overtime", roles: ["REPORTING_MANAGER"], moduleKey: "overtime-management", icon: "Clock" },
  { path: "/empcrm/user-dashboard/documents", name: "Documents", roles: ["ALL"], icon: "FileText" },
  { path: "/empcrm/user-dashboard/salary", name: "Salary", roles: ["ALL"], icon: "DollarSign" },
  { path: "/empcrm/user-dashboard/payslips", name: "Payslips", roles: ["ALL"], icon: "Receipt" },
  { path: "/empcrm/user-dashboard/settings", name: "Settings", roles: ["ALL"], icon: "Settings" },
];

async function getPendingOvertimeCount(username) {
  if (!username) return 0;
  try {
    const conn = await getDbConnection();
    const reportees = await getReportees(username);
    if (reportees.length === 0) return 0;
    
    const ph = reportees.map(() => "?").join(", ");
    const [rows] = await conn.execute(
      `SELECT COUNT(*) AS count FROM attendance_regularization_requests
       WHERE status = 'pending' AND username IN (${ph})`,
      reportees
    );
    return Number(rows[0]?.count) || 0;
  } catch (error) {
    console.error("Error fetching pending overtime count:", error);
    return 0;
  }
}

export default async function getEmpCrmUserSidebarMenuItems() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let role = "GUEST";
  let hasReportees = false;
  let username = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      role = payload?.role || "GUEST";
      username = payload?.username;
      if (username) {
        const reportees = await getReportees(username);
        hasReportees = reportees.length > 0;
      }
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  // Get pending overtime count
  const pendingOvertimeCount = await getPendingOvertimeCount(username);

  const filteredItems = empCrmUserMenuItems.filter((item) => {
    if (item.roles.includes("ALL")) return true;
    if (item.roles.includes(role)) return true;
    if (item.roles.includes("REPORTING_MANAGER") && hasReportees) return true;
    return false;
  });

  // Add badge count to attendance regularization menu item
  return filteredItems.map((item) => {
    if (item.path === "/empcrm/user-dashboard/attendance-regularization") {
      return { ...item, badge: pendingOvertimeCount };
    }
    return item;
  });
}