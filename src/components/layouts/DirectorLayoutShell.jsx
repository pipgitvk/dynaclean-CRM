"use client";

import Navbar from "@/components/Navbar";
import { UserProvider } from "@/context/UserContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import ThemeSwitcher from "@/components/ThemeSwitcher";

function LayoutContent({ children }) {
  const { theme } = useTheme();

  return (
    <div className={`flex h-screen ${theme.body.bg} transition-colors duration-300`}>
      <UserProvider>
        <div className="flex flex-col flex-1 transition-all duration-300 overflow-hidden">
          <Navbar />
          <main className={`p-3 sm:p-4 md:p-6 lg:p-8 overflow-auto ${theme.body.text}`}>{children}</main>
        </div>
      </UserProvider>
      <ThemeSwitcher />
    </div>
  );
}

export default function DirectorLayoutShell({ children }) {
  return (
    <ThemeProvider>
      <LayoutContent>{children}</LayoutContent>
    </ThemeProvider>
  );
}
