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
      // HR: only show “Back to user CRM” (hide “Back to CRM” to avoid 2 buttons)
      showBackButton={!showBackToUserCrm}
      backButtonPath={backButtonPath}
      showBackToUserCrm={showBackToUserCrm}
    >
      {children}
    </UserLayoutShell>
  );
}
