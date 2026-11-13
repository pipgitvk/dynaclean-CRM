"use client";

import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Menu,
  User,
  Plus,
  UserPlus,
  Search,
  Bell,
  X,
  DollarSign,
} from "lucide-react";
import HeaderLogoutButton from "@/components/HeaderLogoutButton";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AttendanceStatusTracker from "@/components/AttendanceStatusTracker";
import ProspectHeaderButton from "@/components/prospects/ProspectHeaderButton";
import CustomerQuickViewModal from "@/components/Customers/CustomerQuickViewModal";
import CustomerHeaderSearchResultCard from "@/components/Customers/CustomerHeaderSearchResultCard";

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
  const [headerCustomerModal, setHeaderCustomerModal] = useState(null);

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
    const storedUser = localStorage.getItem("username");
    if (storedUser) {
      setUsername(storedUser);
    }
    handleUser();
  }, []);

  useEffect(() => {
    const onFocus = () => handleUser();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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
  
  // Fetch notifications on component mount and poll every 15 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
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
      const response = await fetch("/api/me", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      const prevRole = userRole;
      if (data.username) {
        setUsername(data.username);
        localStorage.setItem("username", data.username);
      }
      if (data.userRole) {
        setUserRole(data.userRole);
      }
      if (
        prevRole &&
        data.userRole &&
        normalizeRoleKey(prevRole) !== normalizeRoleKey(data.userRole)
      ) {
        router.refresh();
      }
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

    const isSuperAdmin = normalizeRoleKey(userRole) === "SUPERADMIN";

    try {
      setLoading(true);
      const res = await fetch(
        isSuperAdmin
          ? `/api/tl-customers/search-suggestions?q=${encodeURIComponent(q)}`
          : `/api/customers-data?search=${encodeURIComponent(q)}&pageSize=5&global=1`,
        { credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok) {
        setResults([]);
        setShowDropdown(true);
        return;
      }
      setResults(
        isSuperAdmin
          ? data.suggestions || []
          : data.customers || [],
      );
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
      r === "SALES CUM BACKOFFICE" ||
      r === "GEM"
    );
  };

  const shouldShowAttendanceTracker =
    Boolean(username) && normalizeRoleKey(userRole) !== "SUPERADMIN";

  const isThirdPartyEngineerPortal =
    pathname?.startsWith("/third-party-engineer-dashboard") ||
    normalizeRoleKey(userRole) === "THIRD PARTY ENGINEER";

  const shouldShowAddCustomer =
    !isThirdPartyEngineerPortal &&
    normalizeRoleKey(userRole) !== "DESIGN ENGINEER";

  const dashboardBase = pathname?.startsWith("/admin-dashboard")
    ? "admin-dashboard"
    : "user-dashboard";

  const customerViewHref = (customerId) =>
    `/${dashboardBase}/view-customer/${customerId}`;

  const isSuperAdminSearch = normalizeRoleKey(userRole) === "SUPERADMIN";

  const openHeaderCustomerModal = (kind, customerId) => {
    setShowDropdown(false);
    setHeaderCustomerModal({ kind, customerId });
  };

  const searchDropdown =
    typeof window !== "undefined" &&
    showDropdown &&
    createPortal(
      results.length > 0 ? (
        <div
          data-header-search-dropdown
          className="fixed z-[9999] max-h-[min(24rem,75vh)] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: Math.max(dropdownPosition.width, 320),
          }}
        >
          {results.map((c) => (
            <CustomerHeaderSearchResultCard
              key={c.customer_id}
              customer={c}
              isSuperAdminSearch={isSuperAdminSearch}
              viewHref={customerViewHref(c.customer_id)}
              onSuperAdminPopupView={(customerId) =>
                openHeaderCustomerModal("view", customerId)
              }
              onView={() => {
                setShowDropdown(false);
                setResults([]);
                setQuery("");
                router.push(customerViewHref(c.customer_id));
              }}
            />
          ))}
        </div>
      ) : loading ? (
        <div
          data-header-search-dropdown
          className="fixed z-[9999] rounded-xl border border-slate-200 bg-white p-4 text-sm text-gray-500 shadow-2xl ring-1 ring-black/5"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: Math.max(dropdownPosition.width, 320),
          }}
        >
          Searching...
        </div>
      ) : (
        <div
          data-header-search-dropdown
          className="fixed z-[9999] rounded-xl border border-slate-200 bg-white p-4 text-sm text-gray-500 shadow-2xl ring-1 ring-black/5"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: Math.max(dropdownPosition.width, 320),
          }}
        >
          No results found
        </div>
      ),
      document.body
    );

  const quickHeaderTools = (
    <>
      {!isThirdPartyEngineerPortal && (
        <ProspectHeaderButton userRole={userRole} username={username} />
      )}
      {shouldShowAttendanceTracker && !isThirdPartyEngineerPortal && (
        <AttendanceStatusTracker username={username} />
      )}
    </>
  );

  const customerSearchField = shouldShowSearch() ? (
    <div
      ref={searchRef}
      className="relative w-full min-w-0 min-[1100px]:w-72 min-[1100px]:shrink-0"
    >
      <div
        className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl border px-3 py-2 min-[1100px]:min-h-0 min-[1100px]:h-10 ${
          showSalesMeta
            ? "border-slate-200 bg-slate-50"
            : "border-gray-200 bg-white"
        }`}
      >
        <input
          type="text"
          placeholder={
            showSalesMeta
              ? "Search customers by name, phone, GSTIN..."
              : "Search customers by name, phone, company, ID, or GSTIN..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (showDropdown) updateDropdownPosition();
          }}
          className="flex-1 min-w-0 outline-none text-sm"
        />
        <Search size={18} className="text-gray-600 shrink-0" aria-hidden />
      </div>
      {searchDropdown}
    </div>
  ) : null;

  const headerIconActions = (
    <>
          {shouldShowAddCustomer && (
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
          )}
          {!isThirdPartyEngineerPortal && (
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
          )}
          
          {/* Notification Icon */}
          {!isThirdPartyEngineerPortal && (
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
          )}

      <HeaderLogoutButton
        onClick={handleLogout}
        variant={showSalesMeta ? "sales" : "gradient"}
      />
    </>
  );

  return (
    <>
    <nav
      data-dashboard-navbar
      className={
        showSalesMeta
          ? "print:hidden w-full min-h-16 h-auto border-b border-slate-200 bg-white py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col gap-2 min-[1100px]:min-h-16 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between px-3 min-[1100px]:px-5 md:px-6 lg:px-8 shrink-0"
          : `print:hidden w-full min-h-16 h-auto py-2 min-[1100px]:py-0 min-[1100px]:h-16 bg-gradient-to-r ${
              theme.navbar?.gradient || theme.sidebar.gradient
            } ${theme.navbar?.textureClass || ""} shadow-lg flex flex-col gap-2 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between px-3 min-[1100px]:px-4 md:px-6 lg:px-8 border-b ${
              theme.sidebar.border
            } transition-colors duration-300 shrink-0`
      }
    >
      <div className="flex w-full min-w-0 items-center gap-2 min-[1100px]:gap-4 min-[1100px]:shrink-0">
        <button
          onClick={onToggleSidebar}
          className={
            showSalesMeta
              ? "rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 shrink-0"
              : `${theme.sidebar.text} ${theme.sidebar.hover} p-2 rounded-lg transition-all shrink-0`
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
            <User size={20} className={`${theme.sidebar.text} shrink-0`} />
            <span className={`font-medium ${theme.sidebar.text} truncate`}>
              {username ? `Welcome, ${username}` : "Welcome"} - {userRole}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-[1100px]:hidden">
          <div className="flex w-max max-w-full flex-nowrap items-center gap-1.5 pl-0.5 [&_a]:shrink-0 [&_button]:shrink-0 [&>div]:shrink-0">
            {quickHeaderTools}
            {headerIconActions}
          </div>
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 min-[1100px]:min-w-0 min-[1100px]:flex-1 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-end min-[1100px]:gap-4">
        <div className="hidden min-[1100px]:flex shrink-0 items-center gap-4">
          {quickHeaderTools}
        </div>
        {customerSearchField}
        <div className="hidden min-[1100px]:flex shrink-0 items-center justify-end gap-3">
          {headerIconActions}
        </div>
      </div>
    </nav>
    <CustomerQuickViewModal
      modal={headerCustomerModal}
      onClose={() => setHeaderCustomerModal(null)}
      dashboardBase={dashboardBase}
    />
    </>
  );
}
