
// // app/user-dashboard/layout.js

// import "../globals.css";
// import getSidebarMenuItems from "@/lib/getSidebarMenuItems";
// import UserLayoutShell from "@/components/layouts/UserLayoutShell";

// export default async function UserDashboardLayout({ children }) {
//   const menuItems = await getSidebarMenuItems(); // ✅ runs server-side

//   return (
//     <UserLayoutShell menuItems={menuItems}>
//       {children}
//     </UserLayoutShell>
//   );
// }


// app/user-dashboard/layout.js

import "../globals.css";
import getSidebarMenuItems from "@/lib/getSidebarMenuItems";
import UserLayoutShell from "@/components/layouts/UserLayoutShell";
import ImpersonationWrapper from './ImpersonationWrapper';
import IpGuard from "@/components/IpGuard";

export default async function UserDashboardLayout({ children }) {
  const menuItems = await getSidebarMenuItems(); // ✅ runs server-side

  return (
    <UserLayoutShell menuItems={menuItems}>
      <IpGuard />
      <ImpersonationWrapper>
        {children}
      </ImpersonationWrapper>
    </UserLayoutShell>
  );
}