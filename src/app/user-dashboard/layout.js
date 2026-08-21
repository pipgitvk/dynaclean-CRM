
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
import SalesLayoutShell from "@/components/layouts/SalesLayoutShell";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import ImpersonationWrapper from './ImpersonationWrapper';
import IpGuard from "@/components/IpGuard";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function UserDashboardLayout({ children }) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("impersonation_token")?.value ||
    cookieStore.get("token")?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(JWT_SECRET)
      );
      const roleNorm = String(payload?.role || "").trim().toUpperCase();
      if (roleNorm === "SUPERADMIN" || roleNorm === "EA") {
        redirect("/admin-dashboard");
      }
      if (roleNorm.includes("HR")) {
        redirect("/hr-dashboard");
      }
    } catch {
      // Keep rendering flow; page-level guards handle invalid tokens.
    }
  }

  const menuItems = await getSidebarMenuItems(); // ✅ runs server-side

  return (
    <SalesLayoutShell menuItems={menuItems} showBackToUserCrm={false}>
      <IpGuard />
      <ImpersonationWrapper>
        {children}
      </ImpersonationWrapper>
    </SalesLayoutShell>
  );
}