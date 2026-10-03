



import "../globals.css";
import getSidebarMenuItems, {
  getShowBackToUserCrm,
} from "@/lib/getAdminSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";
import IpGuard from "@/components/IpGuard";

export default async function UserDashboardLayout({ children }) {
  const menuItems = await getSidebarMenuItems(); // ✅ runs server-side
  const showBackToUserCrm = await getShowBackToUserCrm();

  return (
    <UserLayoutShell
      menuItems={menuItems}
      showBackToUserCrm={showBackToUserCrm}
    >
      <IpGuard />
      {children}
    </UserLayoutShell>
  );
}
