



import "../globals.css";
import { headers } from "next/headers";
import getSidebarMenuItems, {
  getShowBackToUserCrm,
  getAccountantBackPath,
} from "@/lib/getAdminSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";
import DashboardEmbedShell from "@/components/layouts/DashboardEmbedShell";
import IpGuard from "@/components/IpGuard";

export default async function UserDashboardLayout({ children }) {
  const isEmbed = (await headers()).get("x-dashboard-embed") === "1";

  if (isEmbed) {
    return <DashboardEmbedShell>{children}</DashboardEmbedShell>;
  }

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
