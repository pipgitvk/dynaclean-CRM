import "../../globals.css";
import getEmpCrmUserSidebarMenuItems from "@/lib/getEmpCrmUserSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserLayoutShell";

export default async function EmpCrmUserLayout({ children }) {
  const menuItems = await getEmpCrmUserSidebarMenuItems();

  return (
    <UserLayoutShell menuItems={menuItems} showBackButton={true} backButtonPath="/user-dashboard">
      {children}
    </UserLayoutShell>
  );
}
