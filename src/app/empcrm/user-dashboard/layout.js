import "../../globals.css";
import getEmpCrmUserSidebarMenuItems from "@/lib/getEmpCrmUserSidebarMenuItems";
import SalesLayoutShell from "@/components/layouts/SalesLayoutShell";
import IpGuard from "@/components/IpGuard";
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
  const menuItems = await getEmpCrmUserSidebarMenuItems();
  const payload = await getSessionPayload();
  const backButtonPath = getBackToCrmPathByRole(payload?.role || payload?.userRole);

  return (
    <SalesLayoutShell
      menuItems={menuItems}
      showBackButton={true}
      backButtonPath={backButtonPath}
      showBackToUserCrm={false}
    >
      <IpGuard />
      {children}
    </SalesLayoutShell>
  );
}
