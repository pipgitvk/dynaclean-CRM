"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  FileText,
  Upload,
  ClipboardList,
  ScrollText,
  BookOpen,
  DollarSign,
  FileSignature,
  ShieldCheck,
  ListOrdered,
  FilePlus2,
  PlayCircle,
  Calendar,
  Target,
  MapPin,
  Users,
  User,
  ArrowLeft,
  ShoppingCart,
  FilePlus,
  PackageCheck,
  Package,
  PackagePlus,
  ShoppingBag,
  UserPlus,
  Mail,
  Settings,
  Import,
  Ship,
  Receipt,
  Clock,
  LayoutGrid,
  Grid3x3,
  Briefcase,
  Globe,
  Truck,
  Landmark,
  RotateCcw,
  TrendingUp,
  Gavel,
  BarChart3,
} from "lucide-react";

const iconMap = {
  Home,
  FileText,
  Upload,
  ClipboardList,
  PlayCircle,
  ScrollText,
  BookOpen,
  DollarSign,
  FileSignature,
  ShieldCheck,
  ListOrdered,
  FilePlus2,
  Calendar,
  Target,
  MapPin,
  Users,
  User,
  UserCircle: User,
  Clock,
  LayoutGrid,
  Grid3x3,
  Receipt,
  ShoppingCart,
  FilePlus,
  PackageCheck,
  Package,
  PackagePlus,
  ShoppingBag,
  UserPlus,
  Mail,
  Settings,
  Import,
  Ship,
  ArrowLeft,
  Briefcase,
  Globe,
  Truck,
  Landmark,
  RotateCcw,
  TrendingUp,
  Gavel,
  BarChart3,
};

function isDashboardRootPath(path) {
  const normalized = String(path || "").replace(/\/+$/, "");
  return /^\/(?:(?:empcrm\/)?(?:sales|user|admin|service-head|accounts|hr|digital-marketing)-dashboard)$/.test(
    normalized.replace(/^\/+/, "/")
  );
}

function isPathActive(pathname, path) {
  if (!path) return false;
  if (isDashboardRootPath(path)) {
    return pathname === path;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function SalesSidebar({
  isOpen,
  menuItems,
  onCloseSidebar,
  onToggleSidebar,
  showBackButton,
  backButtonPath,
  showBackToUserCrm = false,
}) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState({});
  const [username, setUsername] = useState("");

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => {});
  }, []);

  const toggleMenu = (name) => {
    setOpenMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleLinkClick = () => {
    if (
      typeof window !== "undefined" &&
      window.innerWidth < 1024 &&
      onCloseSidebar
    ) {
      onCloseSidebar();
    }
  };

  const renderMenuList = (items, parentKey = "", depth = 0) => {
    return items.map((item, idx) => {
      const keyBase = parentKey ? `${parentKey}-` : "";
      const itemKey = `${keyBase}${item.path || item.name || idx}`;
      const Icon = iconMap[item.icon] || null;

      if (item.children?.length) {
        const childActive = item.children.some((child) =>
          isPathActive(pathname, child.path)
        );
        const isSubOpen = openMenus[item.name] ?? childActive;
        const groupActive = childActive;

        return (
          <li key={itemKey}>
            <button
              type="button"
              onClick={() => toggleMenu(item.name)}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                groupActive
                  ? "bg-violet-600/25 text-white"
                  : "text-slate-200 hover:bg-white/10 hover:text-white"
              )}
            >
              {Icon && <Icon size={18} className="shrink-0 opacity-90" />}
              <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
              {isSubOpen ? (
                <ChevronDown size={15} className="shrink-0 opacity-70" />
              ) : (
                <ChevronRight size={15} className="shrink-0 opacity-70" />
              )}
            </button>

            {isSubOpen && (
              <ul className="ml-3 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                {renderMenuList(item.children, itemKey, depth + 1)}
              </ul>
            )}
          </li>
        );
      }

      const active = isPathActive(pathname, item.path);
      const isLightRedNav = item.sidebarVariant === "lightRed";
      const badgeCount =
        typeof item.badgeCount === "number"
          ? item.badgeCount
          : typeof item.badge === "number"
            ? item.badge
            : 0;

      const leafLinkClass = isLightRedNav
        ? "flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/20 px-3 py-2.5 text-sm font-medium text-red-50 transition-colors hover:bg-red-500/30"
        : clsx(
            "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            active
              ? "bg-violet-600 text-white shadow-sm shadow-violet-900/40"
              : depth > 0
                ? "text-slate-300 hover:bg-white/10 hover:text-white"
                : "text-slate-200 hover:bg-white/10 hover:text-white"
          );

      return (
        <li key={itemKey}>
          <Link
            href={item.path}
            className={clsx(leafLinkClass, "justify-between gap-2")}
            onClick={handleLinkClick}
          >
            {active && !isLightRedNav && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/90" />
            )}
            <span className="flex min-w-0 flex-1 items-center gap-2.5 pl-0.5">
              {Icon && (
                <Icon
                  size={depth > 0 ? 16 : 18}
                  className={clsx("shrink-0", active ? "text-white" : "opacity-90")}
                />
              )}
              <span className="truncate">{item.name}</span>
            </span>
            {badgeCount > 0 && (
              <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </Link>
        </li>
      );
    });
  };

  const userInitial = username ? username.charAt(0).toUpperCase() : "U";

  return (
    <aside
      className={clsx(
        "relative flex h-full flex-col overflow-hidden border-r border-violet-950/50 bg-gradient-to-b from-[#1a1033] via-[#231552] to-[#2f1d6b] text-white shadow-2xl transition-all duration-300 ease-in-out",
        isOpen ? "w-[17.5rem]" : "w-0"
      )}
      style={{
        minWidth: isOpen ? "17.5rem" : "0",
      }}
    >
      {isOpen && (
        <>
          <div className="border-b border-white/10 px-4 pb-4 pt-5">
            <div className="mb-1 text-center text-sm font-bold tracking-wide text-white">
              CRM | Dynaclean
            </div>
            {showBackToUserCrm && (
              <Link
                href="/user-dashboard"
                className="mt-3 flex w-full items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                onClick={handleLinkClick}
              >
                <ArrowLeft size={18} className="shrink-0" />
                <span>Back to user CRM</span>
              </Link>
            )}
          </div>

          {showBackButton && backButtonPath && (
            <Link
              href={backButtonPath}
              className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
              onClick={handleLinkClick}
            >
              <ArrowLeft size={18} />
              <span>Back to CRM</span>
            </Link>
          )}

          <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ul className="space-y-1">{renderMenuList(menuItems)}</ul>
          </nav>

          <div className="mt-auto border-t border-white/10 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-500/30 text-sm font-semibold uppercase text-white ring-1 ring-white/20">
                  {userInitial}
                </div>
                {username && (
                  <span className="truncate text-xs text-slate-300">{username}</span>
                )}
              </div>
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
