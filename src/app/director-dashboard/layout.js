// app/director-dashboard/layout.js
import "../globals.css";
import getSidebarMenuItems from "@/lib/getSidebarMenuItems";
import SalesLayoutShell from "@/components/layouts/SalesLayoutShell";
import ImpersonationWrapper from '../user-dashboard/ImpersonationWrapper';
import IpGuard from "@/components/IpGuard";

export default async function DirectorDashboardLayout({ children }) {
  const menuItems = await getSidebarMenuItems();

  return (
    <SalesLayoutShell menuItems={menuItems} showBackToUserCrm={false}>
      <IpGuard />
      <ImpersonationWrapper>
        {children}
      </ImpersonationWrapper>
    </SalesLayoutShell>
  );
}
