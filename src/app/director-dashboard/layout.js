// app/director-dashboard/layout.js
import "../globals.css";
import getSidebarMenuItems from "@/lib/getSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserLayoutShell";
import ImpersonationWrapper from '../user-dashboard/ImpersonationWrapper';
import IpGuard from "@/components/IpGuard";

export default async function DirectorDashboardLayout({ children }) {
  const menuItems = await getSidebarMenuItems();

  return (
    <UserLayoutShell menuItems={menuItems}>
      <IpGuard />
      <ImpersonationWrapper>
        {children}
      </ImpersonationWrapper>
    </UserLayoutShell>
  );
}
