"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/sales/Sidebar";
import { UserProvider } from "@/context/UserContext";
import { ThemeProvider } from "@/context/ThemeContext";

function LayoutContent({
  children,
  menuItems,
  showBackButton,
  backButtonPath,
  showBackToUserCrm,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSmall = window.innerWidth < 1024;
      if (isSmall) setSidebarOpen(false);
    }
  }, []);

  return (
    <div className="flex h-screen bg-[#f4f6f8] transition-colors duration-300">
      <Sidebar
        isOpen={sidebarOpen}
        menuItems={menuItems}
        onCloseSidebar={() => setSidebarOpen(false)}
        onToggleSidebar={() => setSidebarOpen(false)}
        showBackButton={showBackButton}
        backButtonPath={backButtonPath}
        showBackToUserCrm={showBackToUserCrm}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300">
        <Navbar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          showSalesMeta
        />
        <UserProvider>
          <main className="min-h-0 min-w-0 w-full flex-1 overflow-auto p-3 sm:p-4 md:p-5 text-slate-900">
            {children}
          </main>
        </UserProvider>
      </div>
    </div>
  );
}

export default function SalesLayoutShell({
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
