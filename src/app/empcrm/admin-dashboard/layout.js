import "../../globals.css";
import getEmpCrmAdminSidebarMenuItems, {
  getShowBackToUserCrmForEmpCrmAdmin,
  getEmpCrmAdminBackButtonPath,
} from "@/lib/getEmpCrmAdminSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";

export default async function EmpCrmLayout({ children }) {
  const menuItems = await getEmpCrmAdminSidebarMenuItems();
  const showBackToUserCrm = await getShowBackToUserCrmForEmpCrmAdmin();
  const backButtonPath = await getEmpCrmAdminBackButtonPath();

  return (
    <UserLayoutShell
      menuItems={menuItems}
      showBackButton={true}
      backButtonPath={backButtonPath}
      showBackToUserCrm={showBackToUserCrm}
    >
      {children}
    </UserLayoutShell>
  );
}
