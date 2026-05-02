// // components/user/Sidebar.jsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

import {
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
} from "lucide-react";

// Icon map
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
  PlayCircle,
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
  ShoppingBag,
  UserPlus,
  Mail,
  Settings,
  Import,
  Ship,
  ArrowLeft,
  Briefcase,
};

export default function Sidebar({
  isOpen,
  menuItems,
  onCloseSidebar,
  showBackButton,
  backButtonPath,
  showBackToUserCrm = false,
}) {
  const [openMenus, setOpenMenus] = useState({});
  const { theme } = useTheme();

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

  const renderMenuList = (items, parentKey = "") => {
    return items.map((item, idx) => {
      const keyBase = parentKey ? `${parentKey}-` : "";
      const itemKey = `${keyBase}${item.path || item.name || idx}`;
      const Icon = iconMap[item.icon] || null;

      if (item.children) {
        const isSubOpen = openMenus[item.name];
        return (
          <li key={itemKey} className="m-2">
            <button
              onClick={() => toggleMenu(item.name)}
              className={`flex items-center gap-2 w-full ${theme.sidebar.hover} rounded-md transition-colors p-2`}
            >
              {Icon && <Icon size={20} />}
              <span>{item.name}</span>
              {isSubOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {isSubOpen && (
              <ul className="ml-6 mt-2 space-y-1">
                {renderMenuList(item.children, itemKey)}
              </ul>
            )}
          </li>
        );
      }

      const isLightRedNav = item.sidebarVariant === "lightRed";
      const leafLinkClass = isLightRedNav
        ? "flex items-center gap-2 rounded-md border border-red-300/90 bg-red-100 p-2 text-sm font-medium text-red-950 shadow-sm transition-colors hover:bg-red-200 dark:border-red-500/50 dark:bg-red-950/55 dark:text-red-50 dark:hover:bg-red-900/60"
        : `flex items-center gap-2 ${theme.sidebar.hover} rounded-md transition-colors p-2`;

      const showBadge =
        typeof item.badgeCount === "number" && item.badgeCount > 0;

      return (
        <li key={itemKey} className="m-2">
          <Link
            href={item.path}
            className={`${leafLinkClass} justify-between gap-2`}
            onClick={handleLinkClick}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {Icon && <Icon size={20} className="shrink-0" />}
              <span className="truncate">{item.name}</span>
            </span>
            {showBadge && (
              <span
                className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
                title={`${item.badgeCount} pending`}
              >
                {item.badgeCount}
              </span>
            )}
          </Link>
        </li>
      );
    });
  };

  return (
    <div
      className={clsx(
        `h-full bg-gradient-to-b ${theme.sidebar.gradient} ${
          theme.sidebar.text
        } ${
          theme.sidebar.textureClass || ""
        } overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300 ease-in-out shadow-2xl border-r ${
          theme.sidebar.border
        }`,
        isOpen ? "w-72" : "w-0"
      )}
      style={{
        minWidth: isOpen ? "18rem" : "0",
        padding: isOpen ? "1rem" : "0",
      }}
    >
      {isOpen && (
        <>
          <div
            className={`mb-4 border-b ${theme.sidebar.border} pb-3`}
          >
            <div className="mb-1 flex justify-center px-1">
              <img
                src="/logo.png"
                alt="DYNACLEAN"
                className="h-auto w-full max-w-[220px] object-contain"
                style={{ maxHeight: '72px' }}
                onError={(e) => {
                  console.error('Logo failed to load:', e);
                  e.target.src = '/logo.jpg'; // fallback to jpg
                }}
              />
            </div>
            {showBackToUserCrm && (
              <Link
                href="/user-dashboard"
                className={`mt-3 flex w-full items-center gap-2 rounded-md bg-blue-600 p-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700`}
                onClick={handleLinkClick}
              >
                <ArrowLeft size={20} className="shrink-0" />
                <span>Back to user CRM</span>
              </Link>
            )}
          </div>
          {showBackButton && backButtonPath && (
            <Link
              href={backButtonPath}
              className={`flex items-center gap-2 ${theme.sidebar.hover} rounded-md transition-colors p-2 mb-4 mt-4 bg-blue-600 hover:bg-blue-700 text-white`}
              onClick={handleLinkClick}
            >
              <ArrowLeft size={20} />
              <span>Back to CRM</span>
            </Link>
          )}
          <ul className="space-y-2 mt-10">{renderMenuList(menuItems)}</ul>
        </>
      )}
    </div>
  );
}
