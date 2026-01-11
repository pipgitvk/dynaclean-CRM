



import "../globals.css";
import getSidebarMenuItems from "@/lib/getAdminSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserAdminLayoutShell";

export default async function UserDashboardLayout({ children }) {
  const menuItems = await getSidebarMenuItems(); // ✅ runs server-side

  return (
    <UserLayoutShell menuItems={menuItems}>
      {children}
    </UserLayoutShell>
  );
}
