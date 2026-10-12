import "../../globals.css";
import getEmpCrmUserSidebarMenuItems from "@/lib/getEmpCrmUserSidebarMenuItems";
import getMainCrmSidebarMenuItems from "@/lib/getSidebarMenuItems";
import getAdminSidebarMenuItems, {
  getShowBackToUserCrm,
  getAccountantBackPath,
} from "@/lib/getAdminSidebarMenuItems";
import EmpCrmUserDashboardLayoutClient from "@/components/empcrm/EmpCrmUserDashboardLayoutClient";
import { getSessionPayload } from "@/lib/auth";

function getBackToCrmPathByRole(roleValue) {
  const role = String(roleValue || "").trim().toUpperCase();

  if (role === "SUPERADMIN" || role === "EA") return "/admin-dashboard";
  if (role.includes("SALES")) return "/sales-dashboard";
  if (role.includes("HR")) return "/hr-dashboard";
  if (role.includes("SERVICE") && role.includes("HEAD")) {
    return "/service-head-dashboard";
  }
  if (role.includes("DIGITAL") || role.includes("MARKETER")) {
    return "/digital-marketing-dashboard";
  }
  if (role.includes("ACCOUNTANT")) return "/accounts-dashboard";

  return "/user-dashboard";
}

export default async function EmpCrmUserLayout({ children }) {
  const [empcrmMenuItems, mainCrmMenuItems, adminMenuItems] = await Promise.all([
    getEmpCrmUserSidebarMenuItems(),
    getMainCrmSidebarMenuItems(),
    getAdminSidebarMenuItems(),
  ]);
  const payload = await getSessionPayload();
  const role = payload?.role || payload?.userRole;
  const backButtonPath = getBackToCrmPathByRole(role);
  const showBackToUserCrmAdmin = await getShowBackToUserCrm();
  const accountantBackPath = await getAccountantBackPath();

  return (
    <EmpCrmUserDashboardLayoutClient
      empcrmMenuItems={empcrmMenuItems}
      mainCrmMenuItems={mainCrmMenuItems}
      adminMenuItems={adminMenuItems}
      role={role}
      backButtonPath={backButtonPath}
      showBackToUserCrmAdmin={showBackToUserCrmAdmin}
      accountantBackPath={accountantBackPath}
    >
      {children}
    </EmpCrmUserDashboardLayoutClient>
  );
}
