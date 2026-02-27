"use client";

import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, User, Bell, Plus, UserPlus, Search } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navbar({ onToggleSidebar }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

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

  // search with debounce
  useEffect(() => {
    const delay = setTimeout(() => {
      handleSearch();
    }, 400);

    return () => clearTimeout(delay);
  }, [query]);

  const handleUser = async () => {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();
      setUsername(data.username);
      setUserRole(data.userRole);
      // console.log("User", data);
    } catch (err) {
      console.error("Failed to fetch user data", err);
    }
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `/api/customers-data?search=${encodeURIComponent(q)}&pageSize=5`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) {
        setResults([]);
        setShowDropdown(true);
        return;
      }
      setResults(data.customers || []);
      setShowDropdown(true);
    } finally {
      setLoading(false);
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
    <nav
      className={`w-full min-h-[64px] h-16 bg-gradient-to-r ${
        theme.navbar?.gradient || theme.sidebar.gradient
      } ${
        theme.navbar?.textureClass || ""
      } shadow-lg flex items-center justify-between px-4 md:px-6 lg:px-8 border-b ${
        theme.sidebar.border
      } transition-colors duration-300 flex-shrink-0`}
    >
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
        <div className="relative">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5 w-72 bg-white">
            <input
              type="text"
              placeholder="Search customer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 outline-none text-sm"
            />
            <Search size={18} className="text-gray-600" />
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && results.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
              {results.map((c) => (
                <div
                  key={c.customer_id}
                  className="flex justify-between items-center px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      {c.first_name} {c.company && `(${c.company})`}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {c.customer_id} • Source: {c.lead_source}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setResults([]);
                      setQuery("");
                      const base = pathname?.startsWith("/admin-dashboard") ? "admin-dashboard" : "user-dashboard";
                      router.push(`/${base}/view-customer/${c.customer_id}`);
                    }}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}

          {showDropdown && results.length === 0 && !loading && (
            <div className="absolute top-full mt-2 w-full bg-white border rounded-lg shadow-lg z-50 p-3 text-sm text-gray-500">
              No results found
            </div>
          )}
        </div>

        {/* add cutomer button  */}
        <Link
          href="/admin-dashboard/add-customer"
          className="flex items-center gap-2 text-white bg-green-600 hover:bg-green-700 px-3 py-2.5 md:px-4 md:py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg font-medium"
          aria-label="Add Customer"
        >
          <UserPlus size={20} />
        </Link>
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
