// app/director-dashboard/layout.js
import "../globals.css";
import getDirectorSidebarMenuItems from "@/lib/getDirectorSidebarMenuItems";
import DirectorLayoutShell from "@/components/layouts/DirectorLayoutShell";
import ImpersonationWrapper from '../user-dashboard/ImpersonationWrapper';
import IpGuard from "@/components/IpGuard";

export default async function DirectorDashboardLayout({ children }) {
  const menuItems = await getDirectorSidebarMenuItems();

  return (
    <DirectorLayoutShell menuItems={menuItems}>
      <IpGuard />
      <ImpersonationWrapper>
        {children}
      </ImpersonationWrapper>
    </DirectorLayoutShell>
  );
}
