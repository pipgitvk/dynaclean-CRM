



import "../globals.css";
import getSidebarMenuItems, {
  getShowBackToUserCrm,
  getAccountantBackPath,
} from "@/lib/getAdminSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";
import IpGuard from "@/components/IpGuard";

export default async function UserDashboardLayout({ children }) {
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
