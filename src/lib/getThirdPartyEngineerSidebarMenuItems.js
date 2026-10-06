/** Sidebar for third-party engineer portal (mirrors service engineer essentials). */
export default function getThirdPartyEngineerSidebarMenuItems() {
  return [
    {
      path: "/third-party-engineer-dashboard",
      name: "Dashboard",
      icon: "Home",
    },
    {
      path: "/third-party-engineer-dashboard/services",
      name: "Service History",
      icon: "BookOpen",
    },
    {
      path: "/third-party-engineer-dashboard/profile",
      name: "My Profile",
      icon: "User",
    },
  ];
}
