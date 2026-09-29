import "../../globals.css";
import getEmpCrmUserSidebarMenuItems from "@/lib/getEmpCrmUserSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserLayoutShell";
import IpGuard from "@/components/IpGuard";

export default async function EmpCrmUserLayout({ children }) {
  const menuItems = await getEmpCrmUserSidebarMenuItems();

  return (
    <UserLayoutShell menuItems={menuItems} showBackButton={true} backButtonPath="/user-dashboard">
      <IpGuard />
      {children}
    </UserLayoutShell>
  );
}
