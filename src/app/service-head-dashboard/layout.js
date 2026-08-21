import "../globals.css";
import getSidebarMenuItems from "@/lib/getSidebarMenuItems";
import SalesLayoutShell from "@/components/layouts/SalesLayoutShell";
import IpGuard from "@/components/IpGuard";

export default async function ServiceHeadLayout({ children }) {
  const menuItems = await getSidebarMenuItems("SERVICE HEAD");

  return (
    <SalesLayoutShell
      menuItems={menuItems}
      showBackButton={false}
      backButtonPath="/"
      showBackToUserCrm={false}
    >
      <IpGuard />
      {children}
    </SalesLayoutShell>
  );
}
