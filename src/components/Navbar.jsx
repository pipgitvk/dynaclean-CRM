"use client";

import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Menu, LogOut, User, Plus, UserPlus, Search, Bell, X, DollarSign } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AttendanceStatusTracker from "@/components/AttendanceStatusTracker";

export default function Navbar({ onToggleSidebar, showSalesMeta = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [reportingManager, setReportingManager] = useState("");
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

  useEffect(() => {
    const fetchReportingManager = async () => {
      if (!username) return;
      try {
        const res = await fetch("/api/user/reporting-manager", { credentials: "include" });
        const data = await res.json();
        const managerName =
          data?.reportingManager?.name || data?.reportingManager?.username || "";
        if (managerName) {
          setReportingManager(managerName);
          return;
        }

        const fallbackRes = await fetch(
          `/api/empcrm/manager-email?username=${encodeURIComponent(username)}`,
          { credentials: "include" }
        );
        const fallbackData = await fallbackRes.json();
        setReportingManager(
          fallbackData?.manager_name || fallbackData?.manager_username || ""
        );
      } catch {
        setReportingManager("");
      }
    };

    fetchReportingManager();
  }, [username]);

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
        `/api/customers-data?search=${encodeURIComponent(q)}&pageSize=5&global=1`,
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
      r === "SERVICE SUPPORT" ||
      r === "SALES CUM BACKOFFICE"
    );
  };

  const shouldShowAttendanceTracker =
    Boolean(username) && normalizeRoleKey(userRole) !== "SUPERADMIN";

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
      className={
        showSalesMeta
          ? "w-full min-h-16 h-auto border-b border-slate-200 bg-white py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col gap-2 min-[1100px]:min-h-16 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between px-3 min-[1100px]:px-5 md:px-6 lg:px-8 flex-shrink-0"
          : `w-full min-h-16 h-auto py-2 min-[1100px]:py-0 min-[1100px]:h-16 bg-gradient-to-r ${
              theme.navbar?.gradient || theme.sidebar.gradient
            } ${theme.navbar?.textureClass || ""} shadow-lg flex flex-col gap-2 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between px-3 min-[1100px]:px-4 md:px-6 lg:px-8 border-b ${
              theme.sidebar.border
            } transition-colors duration-300 flex-shrink-0`
      }
    >
      <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
        <button
          onClick={onToggleSidebar}
          className={
            showSalesMeta
              ? "rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 flex-shrink-0"
              : `${theme.sidebar.text} ${theme.sidebar.hover} p-2 rounded-lg transition-all flex-shrink-0`
          }
          aria-label="Toggle Sidebar"
        >
          <Menu size={24} />
        </button>

        {showSalesMeta ? (
          <div className="hidden min-w-0 items-center gap-2.5 min-[1100px]:flex">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
              <User size={16} />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-800">
                {username ? `Welcome, ${username} 👋` : "Welcome 👋"}
              </p>
              <p className="truncate text-xs text-slate-500">
                {userRole || "—"}
                {reportingManager ? ` | Reporting Manager: ${reportingManager}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="hidden min-[1100px]:flex items-center gap-2 min-w-0">
            <User size={20} className={`${theme.sidebar.text} flex-shrink-0`} />
            <span className={`font-medium ${theme.sidebar.text} truncate`}>
              {username ? `Welcome, ${username}` : "Welcome"} - {userRole}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-2 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-end min-[1100px]:gap-4 min-[1100px]:overflow-visible overflow-x-auto">
        {shouldShowAttendanceTracker && (
          <AttendanceStatusTracker username={username} />
        )}
        {shouldShowSearch() && (
          <div
            ref={searchRef}
            className="relative flex-1 min-w-0 w-full min-[1100px]:w-72 min-[1100px]:flex-none min-[1100px]:flex-shrink-0"
          >
            <div className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl border px-3 py-2 min-[1100px]:min-h-0 min-[1100px]:h-10 ${
              showSalesMeta
                ? "border-slate-200 bg-slate-50"
                : "border-gray-200 bg-white"
            }`}>
              <input
                type="text"
                placeholder={
                  showSalesMeta
                    ? "Search customers by name, phone, etc..."
                    : "Search customers by name, phone, company, or ID..."
                }
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

        <div className="flex shrink-0 items-center justify-end gap-2 md:gap-3">
          <Link
            href={
              showSalesMeta
                ? "/sales-dashboard/add-customer"
                : "/admin-dashboard/add-customer"
            }
            className={`grid h-10 w-10 min-h-[44px] min-w-[44px] place-items-center rounded-xl text-white transition min-[1100px]:min-h-0 min-[1100px]:min-w-0 ${
              showSalesMeta
                ? "bg-emerald-500 hover:bg-emerald-600"
                : "bg-green-600 px-3 py-2.5 hover:bg-green-700 min-[1100px]:px-4 min-[1100px]:py-2.5 shadow-md hover:shadow-lg font-medium"
            }`}
            aria-label="Add Customer"
          >
            <UserPlus size={18} />
          </Link>
          <button
            type="button"
            onClick={handleNewTask}
            className={`grid h-10 w-10 min-h-[44px] min-w-[44px] place-items-center rounded-xl text-white transition min-[1100px]:min-h-0 min-[1100px]:min-w-0 ${
              showSalesMeta
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-blue-600 px-3 py-2 min-[1100px]:px-4 hover:bg-blue-700 shadow-md hover:shadow-lg"
            }`}
            aria-label="New Task"
            title="New Task"
          >
            <Plus size={18} />
          </button>
          
          {/* Notification Icon */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
              className={`relative grid h-10 w-10 min-h-[44px] min-w-[44px] place-items-center rounded-xl transition min-[1100px]:min-h-0 min-[1100px]:min-w-0 ${
                showSalesMeta
                  ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  : "bg-gray-700 px-3 py-2 text-white shadow-md hover:bg-gray-800 min-[1100px]:px-3"
              }`}
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
                className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-[9999] max-h-[500px] overflow-y-auto"
              >
                <div className="sticky top-0 p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center gap-2">
                    <Bell size={20} className="text-blue-600" />
                    <h3 className="font-bold text-gray-800 text-lg">Notifications</h3>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <span className="ml-2 px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {notifications.filter(n => !n.is_read).length}
                      </span>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowNotificationDropdown(false)}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1 rounded-lg transition"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="p-2">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="text-gray-300 mb-2">
                        <Bell size={32} className="mx-auto" />
                      </div>
                      <p className="text-gray-500 font-medium">No new notifications</p>
                      <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const isPaymentDue = notification.type === 'payment_due' || notification.type === 'payment_due_admin';
                      const isRecurringTask = notification.type === 'recurring_task' || notification.type === 'task_reassign';
                      
                      return (
                        <div 
                          key={notification.id} 
                          className={`p-4 border-b border-gray-100 transition-all duration-200 hover:bg-blue-50 ${!notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-white'}`}
                          onClick={() => {
                            if (notification.related_id && isRecurringTask) {
                              const isAdminDashboard = pathname?.startsWith("/admin-dashboard");
                              const viewTaskRoute = isAdminDashboard
                                ? `/admin-dashboard/view-task/${notification.related_id}`
                                : `/user-dashboard/view-task/${notification.related_id}`;
                              router.push(viewTaskRoute);
                              setShowNotificationDropdown(false);
                            }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={`mt-1 p-2 rounded-lg ${isPaymentDue ? 'bg-amber-100' : 'bg-blue-100'}`}>
                              {isPaymentDue ? (
                                <DollarSign size={18} className="text-amber-600" />
                              ) : (
                                <Bell size={18} className="text-blue-600" />
                              )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Message */}
                              <p className="text-sm text-gray-800 font-medium leading-snug">
                                {notification.message}
                              </p>
                              
                              {/* Footer */}
                              <div className="flex justify-between items-center mt-3 gap-2">
                                <p className="text-xs text-gray-500">
                                  {new Date(notification.created_at).toLocaleString('en-IN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                <div className="flex gap-2">
                                  {!notification.is_read && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markNotificationAsRead(notification.id);
                                      }}
                                      className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
                                    >
                                      Mark as Read
                                    </button>
                                  )}
                                  {notification.is_read && (
                                    <span className="text-xs text-green-600 font-semibold bg-green-50 px-2.5 py-1 rounded-md">✓ Read</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={
              showSalesMeta
                ? "grid h-10 w-10 min-h-[44px] min-w-[44px] place-items-center rounded-xl bg-red-500 text-white transition hover:bg-red-600 min-[1100px]:min-h-0 min-[1100px]:min-w-0"
                : "flex min-h-[44px] items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-white shadow-md transition hover:bg-red-600 min-[1100px]:min-h-0 min-[1100px]:px-4"
            }
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={18} />
            {!showSalesMeta && (
              <span className="hidden font-medium sm:inline">Logout</span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
