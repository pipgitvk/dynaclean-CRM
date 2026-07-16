"use client";

import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Menu, LogOut, User, Plus, UserPlus, Search, Bell, X } from "lucide-react";
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
  
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const notificationRef = useRef(null);

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
  
  // Close notification dropdown on click outside
  useEffect(() => {
    if (!showNotificationDropdown) return;
    const handleClickOutsideNotifications = (e) => {
      const target = e.target;
      const isNotificationIcon = notificationRef.current?.contains(target);
      const isNotificationDropdown = target.closest?.("[data-notification-dropdown]");
      if (!isNotificationIcon && !isNotificationDropdown) setShowNotificationDropdown(false);
    };
    document.addEventListener("click", handleClickOutsideNotifications);
    return () => document.removeEventListener("click", handleClickOutsideNotifications);
  }, [showNotificationDropdown]);
  
  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };
  
  // Fetch notifications on component mount and poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [username]);
  
  const markNotificationAsRead = async (notificationId) => {
    try {
      console.log("Marking notification as read:", notificationId);
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        credentials: "include"
      });
      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);
      // Refresh notifications after marking as read
      await fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

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

  const normalizeRoleKey = (role) => {
    if (!role) return "";
    return role.toUpperCase().trim();
  };

  const shouldShowSearch = () => {
    const r = normalizeRoleKey(userRole);
    return (
      r === "TEAM LEADER" ||
      r === "HR" ||
      r === "HR HEAD" ||
      r === "HR EXECUTIVE" ||
      r === "SUPERADMIN" ||
      r === "ADMIN" ||
      r === "SALES" ||
      r === "SALES EXECUTIVE" ||
      r === "SALES REPRESENTATIVE" ||
      r === "DIRECTOR" ||
      r === "EA" ||
      r === "SERVICE SUPPORT"
    );
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
      className={`w-full min-h-16 h-auto py-2 min-[1100px]:py-0 min-[1100px]:h-16 bg-gradient-to-r ${
        theme.navbar?.gradient || theme.sidebar.gradient
      } ${
        theme.navbar?.textureClass || ""
      } shadow-lg flex flex-col gap-2 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between px-3 min-[1100px]:px-4 md:px-6 lg:px-8 border-b ${
        theme.sidebar.border
      } transition-colors duration-300 flex-shrink-0`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
        <button
          onClick={onToggleSidebar}
          className={`${theme.sidebar.text} ${theme.sidebar.hover} p-2 rounded-lg transition-all flex-shrink-0`}
          aria-label="Toggle Sidebar"
        >
          <Menu size={24} />
        </button>

        <div className="hidden min-[1100px]:flex items-center gap-2 min-w-0">
          <User size={20} className={`${theme.sidebar.text} flex-shrink-0`} />
          <span className={`font-medium ${theme.sidebar.text} truncate`}>
            {username ? `Welcome, ${username}` : "Welcome"} - {userRole}
          </span>
        </div>
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-2 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-end min-[1100px]:gap-4 min-[1100px]:overflow-visible overflow-x-auto">
        {shouldShowSearch() && (
          <div
            ref={searchRef}
            className="relative flex-1 min-w-0 w-full min-[1100px]:w-72 min-[1100px]:flex-none min-[1100px]:flex-shrink-0"
          >
            <div className="flex items-center gap-1 min-[1100px]:gap-2 border rounded-lg px-2 min-[1100px]:px-3 py-2 min-[1100px]:py-2.5 w-full bg-white min-h-[44px] min-[1100px]:min-h-0 min-[1100px]:h-10">
              <input
                type="text"
                placeholder="Search customers by name, phone, company, or ID..."
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
        )}

        <div className="flex items-center justify-end gap-2 md:gap-4 flex-shrink-0">
          <Link
            href="/admin-dashboard/add-customer"
            className="flex items-center justify-center gap-2 text-white bg-green-600 hover:bg-green-700 px-3 py-2.5 min-[1100px]:px-4 min-[1100px]:py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg font-medium min-h-[44px] min-[1100px]:min-h-0 min-w-[44px] min-[1100px]:min-w-0"
            aria-label="Add Customer"
          >
            <UserPlus size={20} />
          </Link>
          <button
            type="button"
            onClick={handleNewTask}
            className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 min-[1100px]:px-4 min-[1100px]:py-2 rounded-lg transition-all shadow-md hover:shadow-lg min-h-[44px] min-[1100px]:min-h-0"
            aria-label="New Task"
          >
            <Plus size={18} />
            <span className="hidden sm:inline font-medium">New Task</span>
          </button>
          
          {/* Notification Icon */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
              className="relative flex items-center justify-center text-white bg-gray-700 hover:bg-gray-800 px-3 py-2 min-[1100px]:px-3 min-[1100px]:py-2 rounded-lg transition-all shadow-md hover:shadow-lg min-h-[44px] min-[1100px]:min-h-0"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {(() => {
                const unreadCount = notifications.filter(n => !n.is_read).length;
                return unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null;
              })()}
            </button>
            
            {/* Notification Dropdown */}
            {showNotificationDropdown && (
              <div 
                data-notification-dropdown
                className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] max-h-[400px] overflow-y-auto"
              >
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                  <button 
                    type="button"
                    onClick={() => setShowNotificationDropdown(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="p-2">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div 
                        key={notification.id} 
                        className={`p-3 border-b border-gray-100 ${!notification.is_read ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 opacity-75'}`}
                        onClick={() => {
                          if (notification.related_id && notification.type === 'recurring_task' || notification.type === 'task_reassign') {
                            const isAdminDashboard = pathname?.startsWith("/admin-dashboard");
                            const viewTaskRoute = isAdminDashboard
                              ? `/admin-dashboard/view-task/${notification.related_id}`
                              : `/user-dashboard/view-task/${notification.related_id}`;
                            router.push(viewTaskRoute);
                            setShowNotificationDropdown(false);
                          }
                        }}
                      >
                        <p className="text-sm text-gray-800">{notification.message}</p>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-xs text-gray-500">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                          <div className="flex gap-2">
                            {!notification.is_read && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markNotificationAsRead(notification.id);
                                }}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                Mark as Read
                              </button>
                            )}
                            {notification.is_read && (
                              <span className="text-xs text-green-600 font-medium">Read</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-white bg-red-500 hover:bg-red-600 px-3 py-2 min-[1100px]:px-4 min-[1100px]:py-2 rounded-lg transition-all shadow-md hover:shadow-lg min-h-[44px] min-[1100px]:min-h-0"
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
