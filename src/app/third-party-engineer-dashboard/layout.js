import "../globals.css";
import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth";
import { getEngineerIdFromPayload } from "@/lib/thirdPartyEngineerPortalSession";
import getThirdPartyEngineerSidebarMenuItems from "@/lib/getThirdPartyEngineerSidebarMenuItems";
import SalesLayoutShell from "@/components/layouts/SalesLayoutShell";

export default async function ThirdPartyEngineerDashboardLayout({ children }) {
  const payload = await getSessionPayload();
  if (!getEngineerIdFromPayload(payload)) {
    redirect("/login");
  }

  const menuItems = getThirdPartyEngineerSidebarMenuItems();

  return (
    <SalesLayoutShell menuItems={menuItems} showBackToUserCrm={false}>
      {children}
    </SalesLayoutShell>
  );
}
