"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/admin/Sidebar";
import { UserProvider } from "@/context/UserContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import ThemeSwitcher from "@/components/ThemeSwitcher";

function LayoutContent({
  children,
  menuItems,
  showBackButton,
  backButtonPath,
  showBackToUserCrm,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme } = useTheme();

  // Close sidebar on small screens initially
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSmall = window.innerWidth < 1024; // tailwind lg breakpoint
      if (isSmall) setSidebarOpen(false);
    }
  }, []);

  return (
    <div className={`flex h-screen ${theme.body.bg} transition-colors duration-300`}>
      <Sidebar
        isOpen={sidebarOpen}
        menuItems={menuItems}
        onCloseSidebar={() => setSidebarOpen(false)}
        showBackButton={showBackButton}
        backButtonPath={backButtonPath}
        showBackToUserCrm={showBackToUserCrm}
      />
      <div className="flex flex-col flex-1 transition-all duration-300 overflow-hidden">
        <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <UserProvider>
          <main className={`p-3 sm:p-4 md:p-6 lg:p-8 overflow-auto min-w-0 ${theme.body.text}`}>{children}</main>
        </UserProvider>
      </div>
      <ThemeSwitcher />
    </div>
  );
}

export default function UserLayoutShell({
  children,
  menuItems,
  showBackButton,
  backButtonPath,
  showBackToUserCrm,
}) {
  return (
    <ThemeProvider>
      <LayoutContent
        menuItems={menuItems}
        showBackButton={showBackButton}
        backButtonPath={backButtonPath}
        showBackToUserCrm={showBackToUserCrm}
      >
        {children}
      </LayoutContent>
    </ThemeProvider>
  );
}
