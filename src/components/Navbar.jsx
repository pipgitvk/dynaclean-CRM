"use client";

import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Menu, LogOut, User, Plus, UserPlus, Search } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect, useRef } from "react";
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const searchRef = useRef(null);

  const updateDropdownPosition = () => {
    const el = searchRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const minDropdownWidth = 260;
    const maxWidth = window.innerWidth - margin * 2;
    const width = Math.min(Math.max(rect.width, minDropdownWidth), maxWidth);
    let left = rect.left + rect.width / 2 - width / 2;
    if (left < margin) left = margin;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width;
    }
    const top = rect.bottom + margin;
    setDropdownPosition({ top, left, width });
  };

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

  useEffect(() => {
    if (!showDropdown || typeof window === "undefined") return;
    updateDropdownPosition();
    const onReposition = () => updateDropdownPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [showDropdown, results.length, loading]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e) => {
      const target = e.target;
      const isSearchInput = searchRef.current?.contains(target);
      const isDropdown = target.closest?.("[data-header-search-dropdown]");
      if (!isSearchInput && !isDropdown) setShowDropdown(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showDropdown]);

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

  const searchDropdown =
    typeof window !== "undefined" &&
    showDropdown &&
    createPortal(
      results.length > 0 ? (
        <div
          data-header-search-dropdown
          className="fixed bg-white border rounded-lg shadow-xl z-[9999] max-h-[min(18rem,70vh)] overflow-y-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          {results.map((c) => (
            <div
              key={c.customer_id}
              className="flex justify-between items-center gap-2 px-3 py-2 hover:bg-gray-100 border-b last:border-b-0 cursor-pointer"
            >
              <div className="text-sm min-w-0">
                <div className="font-medium truncate">
                  {c.first_name} {c.company && `(${c.company})`}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  ID: {c.customer_id} • {c.lead_source || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDropdown(false);
                  setResults([]);
                  setQuery("");
                  const base = pathname?.startsWith("/admin-dashboard")
                    ? "admin-dashboard"
                    : "user-dashboard";
                  router.push(`/${base}/view-customer/${c.customer_id}`);
                }}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex-shrink-0"
              >
                View
              </button>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div
          data-header-search-dropdown
          className="fixed bg-white border rounded-lg shadow-xl z-[9999] p-3 text-sm text-gray-500"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          Searching...
        </div>
      ) : (
        <div
          data-header-search-dropdown
          className="fixed bg-white border rounded-lg shadow-xl z-[9999] p-3 text-sm text-gray-500"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          No results found
        </div>
      ),
      document.body
    );

  return (
    <nav
      className={`w-full min-h-16 h-auto py-2 sm:py-0 sm:h-16 bg-gradient-to-r ${
        theme.navbar?.gradient || theme.sidebar.gradient
      } ${
        theme.navbar?.textureClass || ""
      } shadow-lg flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 px-3 sm:px-4 md:px-6 lg:px-8 border-b ${
        theme.sidebar.border
      } transition-colors duration-300 flex-shrink-0`}
    >
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink-0">
        <button
          onClick={onToggleSidebar}
          className={`${theme.sidebar.text} ${theme.sidebar.hover} p-2 rounded-lg transition-all flex-shrink-0`}
          aria-label="Toggle Sidebar"
        >
          <Menu size={24} />
        </button>

        <div className="hidden lg:flex items-center gap-2 min-w-0">
          <User size={20} className={`${theme.sidebar.text} flex-shrink-0`} />
          <span className={`font-medium ${theme.sidebar.text} truncate`}>
            {username ? `Welcome, ${username}` : "Welcome"} - {userRole}
          </span>
        </div>
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div ref={searchRef} className="relative flex-1 min-w-0 w-full sm:max-w-2xl">
          <div className="flex items-center gap-2 border rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 w-full bg-white min-h-[44px]">
            <input
              type="text"
              placeholder="Search customer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (showDropdown) updateDropdownPosition();
              }}
              className="flex-1 min-w-0 outline-none text-sm"
            />
            <Search size={18} className="text-gray-600 flex-shrink-0" aria-hidden />
          </div>
          {searchDropdown}
        </div>

        <div className="flex items-center justify-end gap-2 md:gap-3 flex-shrink-0">
          <Link
            href="/admin-dashboard/add-customer"
            className="flex items-center justify-center text-white bg-green-600 hover:bg-green-700 px-2.5 py-2.5 sm:px-3 md:px-4 rounded-lg transition-all shadow-md hover:shadow-lg font-medium min-h-[44px] min-w-[44px] sm:min-w-0"
            aria-label="Add Customer"
          >
            <UserPlus size={20} />
          </Link>
          <button
            type="button"
            onClick={handleNewTask}
            className="flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-2 sm:px-3 md:px-4 rounded-lg transition-all shadow-md hover:shadow-lg min-h-[44px]"
            aria-label="New Task"
          >
            <Plus size={18} />
            <span className="hidden sm:inline font-medium">New Task</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 text-white bg-red-500 hover:bg-red-600 px-2.5 py-2 sm:px-3 md:px-4 rounded-lg transition-all shadow-md hover:shadow-lg min-h-[44px]"
            aria-label="Logout"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline font-medium">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
