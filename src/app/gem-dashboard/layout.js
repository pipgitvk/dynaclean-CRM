import "../globals.css";
import getSidebarMenuItems from "@/lib/getSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";
import IpGuard from "@/components/IpGuard";

export default async function GemLayout({ children }) {
  const menuItems = await getSidebarMenuItems();

  return (
    <UserLayoutShell
      menuItems={menuItems}
      showBackButton={false}
      backButtonPath="/"
      showBackToUserCrm={false}
    >
      <IpGuard />
      {children}
    </UserLayoutShell>
  );
}
