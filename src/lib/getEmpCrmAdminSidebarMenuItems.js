import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";

const PROFILE_APPROVALS_PATH = "/empcrm/admin-dashboard/profile/approvals";

async function countPendingHrProfileApprovals() {
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM employee_profile_submissions WHERE status = 'pending'`,
    );
    return Number(rows[0]?.c ?? 0);
  } catch (e) {
    console.error("countPendingHrProfileApprovals:", e);
    return 0;
  }
}

function attachProfileApprovalsBadge(items, pendingCount) {
  return items.map((item) => {
    if (item.path === PROFILE_APPROVALS_PATH) {
      return { ...item, badgeCount: pendingCount };
    }
    return item;
  });
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const empCrmMenuItems = [
  { path: "/empcrm/admin-dashboard", name: "EMPCRM Dashboard", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "Home" },
  { path: "/empcrm/admin-dashboard/profile", name: "Profile Management", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "UserCircle" },
  { path: "/empcrm/admin-dashboard/profile/approvals", name: "Profile Approvals", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "UserCircle" },
  { path: "/empcrm/admin-dashboard/leave", name: "Leave Management", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "Calendar" },


  { path: "/empcrm/admin-dashboard/attendance-summary", name: "Attendance Summary", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "LayoutGrid" },
  { path: "/empcrm/admin-dashboard/attendance", name: "Attendance details", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "Clock" },
  { path: "/empcrm/admin-dashboard/documents", name: "Employee Documents", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"], icon: "FileText" },
  { path: "/empcrm/admin-dashboard/hiring", name: "Hiring", roles: ["HR HEAD", "HR", "HR Executive"], icon: "UserPlus" },
  { path: "/empcrm/admin-dashboard/salary", name: "Salary Management", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive", "ACCOUNTANT"], icon: "DollarSign" },
  { path: "/empcrm/admin-dashboard/salary-slips", name: "Salary slips", roles: ["SUPERADMIN", "HR HEAD", "HR", "HR Executive", "ACCOUNTANT"], icon: "Receipt" },
];

export default async function getEmpCrmAdminSidebarMenuItems() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let role = "GUEST";

  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      role = (payload?.role ?? payload?.userRole) || "GUEST";
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  const roleKey = normalizeRoleKey(role || "GUEST") || "GUEST";

  let items = empCrmMenuItems.filter(
    (item) =>
      item.roles.includes("ALL") ||
      item.roles.some((r) => normalizeRoleKey(r) === roleKey),
  );

  const seesProfileApprovals = items.some(
    (item) => item.path === PROFILE_APPROVALS_PATH,
  );
  if (seesProfileApprovals) {
    const pending = await countPendingHrProfileApprovals();
    items = attachProfileApprovalsBadge(items, pending);
  }

  return items;
}

/** EMPCRM “Back to CRM”: accountants usually work from user dashboard. */
export async function getEmpCrmAdminBackButtonPath() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let role = "GUEST";
  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(JWT_SECRET)
      );
      role = (payload?.role ?? payload?.userRole) || "GUEST";
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  const roleKey = normalizeRoleKey(role || "GUEST") || "GUEST";
  return roleKey === "ACCOUNTANT" ? "/user-dashboard" : "/admin-dashboard";
}

/** “Back to user CRM” on /empcrm/admin-dashboard — only for role HR (JWT). */
export async function getShowBackToUserCrmForEmpCrmAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let role = "GUEST";
  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(JWT_SECRET)
      );
      role = (payload?.role ?? payload?.userRole) || "GUEST";
    } catch (error) {
      console.error("JWT decode error:", error.message);
    }
  }

  const roleKey = normalizeRoleKey(role || "GUEST") || "GUEST";
  return roleKey === "HR";
}
