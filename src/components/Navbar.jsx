"use client";

import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, User, Bell, Plus } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect } from "react";

export default function Navbar({ onToggleSidebar }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [userRole , setUserRole] = useState("");

  useEffect(() => {
    // Get username from localStorage or session
    const storedUser = localStorage.getItem("username");

    if (storedUser) {
      setUsername(storedUser);
    }
  }, []);

  useEffect(() => {
    if (!username) {
      handleUser();
    }
  }, []);

  const handleUser = async () => {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();
      setUsername(data.username);
      setUserRole(data.userRole);
      // console.log(data)
    } catch (err) {
      console.error("Failed to fetch user data", err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      localStorage.removeItem("username");
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      router.push("/login");
    }
  };

  const handleNewTask = () => {
    // Determine the correct route based on current dashboard
    const isAdminDashboard = pathname?.startsWith("/admin-dashboard");
    const newTaskRoute = isAdminDashboard 
      ? "/admin-dashboard/new-task" 
      : "/user-dashboard/new-task";
    router.push(newTaskRoute);
  };

  return (
    <nav className={`w-full min-h-[64px] h-16 bg-gradient-to-r ${theme.navbar?.gradient || theme.sidebar.gradient} ${theme.navbar?.textureClass || ""} shadow-lg flex items-center justify-between px-4 md:px-6 lg:px-8 border-b ${theme.sidebar.border} transition-colors duration-300 flex-shrink-0`}>
      {/* Left Section - Menu Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className={`${theme.sidebar.text} ${theme.sidebar.hover} p-2 rounded-lg transition-all`}
          aria-label="Toggle Sidebar"
        >
          <Menu size={24} />
        </button>

        {/* Welcome Text - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-2">
          <User size={20} className={theme.sidebar.text} />
          <span className={`font-medium ${theme.sidebar.text}`}>
            {username ? `Welcome, ${username}` : "Welcome"} - {userRole}
          </span>
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* New Task Button */}
        <button
          onClick={handleNewTask}
          className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 md:px-4 md:py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
          aria-label="New Task"
        >
          <Plus size={18} />
          <span className="hidden sm:inline font-medium">New Task</span>
        </button>


        {/* Notifications - Hidden on small mobile */}
        {/* <button
          className={`hidden sm:flex ${theme.sidebar.text} ${theme.sidebar.hover} p-2 rounded-lg transition-all relative`}
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button> */}

        {/* User Avatar - Hidden on mobile, shown on tablet+ */}
        {/* <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ${theme.sidebar.text} font-semibold text-sm`}>
            {username ? username.charAt(0).toUpperCase() : "U"}
          </div>
          <span className={`${theme.sidebar.text} text-sm font-medium max-w-[100px] truncate`}>
            {username || "User"}
          </span>
        </div> */}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-white bg-red-500 hover:bg-red-600 px-3 py-2 md:px-4 md:py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
          aria-label="Logout"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
}
