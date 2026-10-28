import { getSessionPayload } from "@/lib/auth";
import { getReportees } from "@/lib/reportingManager";
import { getDbConnection } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Shown when user has reportees — not gated by Global Module Access keys. */
export const EMPCRM_REPORTING_MANAGER_PATH_PREFIXES = [
  "/empcrm/user-dashboard/leave-approvals",
  "/empcrm/user-dashboard/attendance-regularization",
  "/empcrm/user-dashboard/overtime",
  "/empcrm/user-dashboard/employee-expenses",
];

export function isEmpCrmReportingManagerMenuPath(path) {
  const p = String(path || "");
  return EMPCRM_REPORTING_MANAGER_PATH_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}

const empCrmUserMenuItems = [
  { path: "/empcrm/user-dashboard", name: "EMPCRM Dashboard", roles: ["ALL"], icon: "Home" },
  { path: "/empcrm/admin-dashboard", name: "Go to Admin Panel", roles: ["HR", "HR HEAD", "Junior HR Executive", "HR Recruiter", "SUPERADMIN"], icon: "LayoutGrid" },
  { path: "/empcrm/user-dashboard/profile", name: "My Profile", roles: ["ALL"], icon: "UserCircle" },
  { path: "/empcrm/user-dashboard/leave", name: "Leave", roles: ["ALL"], icon: "Calendar" },
  { path: "/empcrm/user-dashboard/leave-approvals", name: "Leave Approvals", roles: ["REPORTING_MANAGER"], icon: "CheckSquare" },
  { path: "/empcrm/user-dashboard/attendance-summary", name: "Attendance Summary", roles: ["ALL"], icon: "Grid3x3" },
  { path: "/empcrm/user-dashboard/attendance", name: "Attendance details", roles: ["ALL"], icon: "Clock" },
  { path: "/empcrm/user-dashboard/attendance-regularization", name: "Attendance Regularization", roles: ["REPORTING_MANAGER"], icon: "ClipboardCheck" },
  { path: "/empcrm/user-dashboard/overtime", name: "Overtime", roles: ["REPORTING_MANAGER"], icon: "Clock" },
  { path: "/empcrm/user-dashboard/employee-expenses", name: "Employee Expenses", roles: ["REPORTING_MANAGER"], icon: "Receipt" },
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

async function getEmpCrmUserSessionContext() {
  const payload = await getSessionPayload();

  const role = payload?.role || payload?.userRole || "GUEST";
  const username = payload?.username || null;
  let hasReportees = false;

  if (username) {
    const reportees = await getReportees(username);
    hasReportees = reportees.length > 0;
  }

  const roleKey = normalizeRoleKey(role || "GUEST") || "GUEST";
  const pendingOvertimeCount = await getPendingOvertimeCount(username);

  return { roleKey, hasReportees, pendingOvertimeCount };
}

function filterEmpCrmUserMenuItems(roleKey, hasReportees) {
  return empCrmUserMenuItems.filter((item) => {
    if (item.roles.includes("ALL")) return true;
    if (item.roles.some((r) => normalizeRoleKey(r) === roleKey)) return true;
    if (item.roles.includes("REPORTING_MANAGER") && hasReportees) return true;
    return false;
  });
}

function mapEmpCrmUserMenuItems(filteredItems, pendingOvertimeCount, forMainCrmSidebar) {
  return filteredItems.map((item) => {
    let result = item;
    if (item.path === "/empcrm/user-dashboard/attendance-regularization") {
      result = { ...item, badge: pendingOvertimeCount };
    }
    // Main CRM runs filterByRole on Employee CRM children; REPORTING_MANAGER is not a real
    // userRole — items are already limited to users with reportees above.
    if (
      forMainCrmSidebar &&
      Array.isArray(item.roles) &&
      item.roles.includes("REPORTING_MANAGER")
    ) {
      result = { ...result, roles: ["ALL"] };
    }
    return result;
  });
}

/** Nested under main CRM sidebar “Employee CRM” (same links as /empcrm/user-dashboard sidebar). */
export async function getEmpCrmUserMenuChildrenForRole() {
  const { roleKey, hasReportees, pendingOvertimeCount } =
    await getEmpCrmUserSessionContext();
  const filteredItems = filterEmpCrmUserMenuItems(roleKey, hasReportees);
  return mapEmpCrmUserMenuItems(filteredItems, pendingOvertimeCount, true);
}

export default async function getEmpCrmUserSidebarMenuItems() {
  const { roleKey, hasReportees, pendingOvertimeCount } =
    await getEmpCrmUserSessionContext();
  const filteredItems = filterEmpCrmUserMenuItems(roleKey, hasReportees);
  return mapEmpCrmUserMenuItems(filteredItems, pendingOvertimeCount, false);
}