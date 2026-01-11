import "../../globals.css";
import getEmpCrmAdminSidebarMenuItems from "@/lib/getEmpCrmAdminSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";

export default async function EmpCrmLayout({ children }) {
  const menuItems = await getEmpCrmAdminSidebarMenuItems();

  return (
    <UserLayoutShell menuItems={menuItems} showBackButton={true} backButtonPath="/admin-dashboard">
      {children}
    </UserLayoutShell>
  );
}
