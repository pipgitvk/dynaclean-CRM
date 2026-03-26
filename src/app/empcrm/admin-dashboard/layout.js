import "../../globals.css";
import getEmpCrmAdminSidebarMenuItems, {
  getShowBackToUserCrmForEmpCrmAdmin,
} from "@/lib/getEmpCrmAdminSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";

export default async function EmpCrmLayout({ children }) {
  const menuItems = await getEmpCrmAdminSidebarMenuItems();
  const showBackToUserCrm = await getShowBackToUserCrmForEmpCrmAdmin();

  return (
    <UserLayoutShell
      menuItems={menuItems}
      showBackButton={true}
      backButtonPath="/admin-dashboard"
      showBackToUserCrm={showBackToUserCrm}
    >
      {children}
    </UserLayoutShell>
  );
}
