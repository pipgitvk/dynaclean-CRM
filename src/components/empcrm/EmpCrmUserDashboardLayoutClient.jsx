"use client";

import { usePathname } from "next/navigation";
import SalesLayoutShell from "@/components/layouts/SalesLayoutShell";
import UserAdminLayoutShell from "@/components/layouts/UserAdminLayoutShell";
import IpGuard from "@/components/IpGuard";
import { isEmpCrmRouteOnMainCrmShell } from "@/lib/empCrmMainCrmShellPaths";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

function usesAdminMainShell(role) {
  const key = normalizeRoleKey(role || "") || "";
  return key === "SUPERADMIN" || key === "EA";
}

export default function EmpCrmUserDashboardLayoutClient({
  children,
  empcrmMenuItems,
  mainCrmMenuItems,
  adminMenuItems,
  role,
  backButtonPath,
  showBackToUserCrmAdmin,
  accountantBackPath,
}) {
  const pathname = usePathname();
  const onMainCrmShell = isEmpCrmRouteOnMainCrmShell(pathname);

  if (onMainCrmShell && usesAdminMainShell(role)) {
    return (
      <UserAdminLayoutShell
        menuItems={adminMenuItems}
        showBackToUserCrm={showBackToUserCrmAdmin}
        showBackButton={!!accountantBackPath}
        backButtonPath={accountantBackPath}
      >
        <IpGuard />
        {children}
      </UserAdminLayoutShell>
    );
  }

  if (onMainCrmShell) {
    return (
      <SalesLayoutShell
        menuItems={mainCrmMenuItems}
        showBackButton={false}
        backButtonPath="/"
        showBackToUserCrm={false}
      >
        <IpGuard />
        {children}
      </SalesLayoutShell>
    );
  }

  return (
    <SalesLayoutShell
      menuItems={empcrmMenuItems}
      showBackButton={true}
      backButtonPath={backButtonPath}
      showBackToUserCrm={false}
    >
      <IpGuard />
      {children}
    </SalesLayoutShell>
  );
}
