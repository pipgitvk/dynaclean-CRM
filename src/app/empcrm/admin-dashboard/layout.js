import "../../globals.css";
import getSidebarMenuItems, {
  getShowBackToUserCrm,
  getAccountantBackPath,
} from "@/lib/getAdminSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";
import IpGuard from "@/components/IpGuard";

/** Same admin shell + sidebar as /admin-dashboard; EMPCRM pages stay under /empcrm/... URLs. */
export default async function EmpCrmAdminLayout({ children }) {
  const menuItems = await getSidebarMenuItems();
  const showBackToUserCrm = await getShowBackToUserCrm();
  const accountantBackPath = await getAccountantBackPath();

  return (
    <UserLayoutShell
      menuItems={menuItems}
      showBackToUserCrm={showBackToUserCrm}
      showBackButton={!!accountantBackPath}
      backButtonPath={accountantBackPath}
    >
      <IpGuard />
      {children}
    </UserLayoutShell>
  );
}
