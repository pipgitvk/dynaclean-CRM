// components/director/Sidebar.jsx
"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";

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
  MapPin,
  Users,
  User,
  Calendar,
  Clock,
  LayoutGrid,
  Grid3x3,
  Receipt,
  ArrowLeft,
  ShoppingCart,
  FilePlus,
  PackageCheck,
  ShoppingBag,
  UserPlus,
  Mail,
  Settings,
  CheckSquare,
  Package,
  Import,
  Ship,
  ClipboardCheck,
  Target,
  Briefcase,
  Wrench,
  Eye,
  HelpCircle,
  Video,
  Newspaper,
  Box,
  Bell,
  Globe,
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
  MapPin,
  Users,
  User,
  UserCircle: User,
  Calendar,
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
  CheckSquare,
  Package,
  Import,
  Ship,
  ClipboardCheck,
  Target,
  Briefcase,
  Wrench,
  Eye,
  HelpCircle,
  Video,
  Newspaper,
  Box,
  Bell,
  Globe,
};

export default function DirectorSidebar({
  isOpen,
  menuItems,
  onCloseSidebar,
  showBackButton,
  backButtonPath,
}) {
  const [openMenus, setOpenMenus] = useState({});
  const [activePath, setActivePath] = useState("");
  const { theme } = useTheme();
  const { user } = useUser();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setActivePath(window.location.pathname);
    }
  }, []);

  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLinkClick = () => {
    if (
      typeof window !== "undefined" &&
      window.innerWidth < 768 &&
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

      const isActive = typeof window !== "undefined" && window.location.pathname === item.path;

      if (item.children?.length) {
        const isSubOpen = openMenus[itemKey];
        return (
          <li key={itemKey} className="px-3">
            <button
              type="button"
              onClick={() => toggleMenu(itemKey)}
              className={clsx(
                "flex items-center gap-3 w-full rounded-lg transition-all duration-200 p-2.5 group",
                isSubOpen ? "text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              {Icon && <Icon size={20} className={clsx("transition-colors", isSubOpen ? "text-blue-500" : "group-hover:text-white")} />}
              <span className="flex-1 text-left font-medium">{item.name}</span>
              {isSubOpen ? (
                <ChevronDown size={16} className="text-slate-500" />
              ) : (
                <ChevronRight size={16} className="text-slate-500" />
              )}
            </button>

            {isSubOpen && (
              <ul className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-4">
                {renderMenuList(item.children, itemKey)}
              </ul>
            )}
          </li>
        );
      }

      return (
        <li key={itemKey} className="px-3">
          <Link
            href={item.path || "#"}
            className={clsx(
              "flex items-center gap-3 rounded-lg transition-all duration-200 p-2.5 group",
              isActive 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
            onClick={handleLinkClick}
          >
            {Icon && <Icon size={parentKey ? 18 : 20} className="transition-colors text-white" />}
            <span className={clsx("flex-1 font-medium", parentKey ? "text-sm" : "text-base")}>{item.name}</span>
            {item.badge && item.badge > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {item.badge > 99 ? "99+" : item.badge}
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
        "h-full bg-[#0f172a] text-white flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800",
        isOpen ? "w-64" : "w-0 overflow-hidden"
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-center border-b border-slate-800/50">
        <img 
          src="/DYNACLEAN-LOGO11.SVG" 
          alt="Dynaclean Logo" 
          className="h-35 w-45"
        />
      </div>

      {/* Menu Section */}
      <div className="flex-1 overflow-y-auto py-0.5 scrollbar-hide">
        {showBackButton && backButtonPath && (
          <div className="px-3 mb-4">
            <Link
              href={backButtonPath}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors p-2.5"
              onClick={handleLinkClick}
            >
              <ArrowLeft size={18} />
              <span className="font-medium">Back to CRM</span>
            </Link>
          </div>
        )}
        <ul className="space-y-1">{renderMenuList(menuItems)}</ul>
      </div>

      {/* User Section */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-800">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold border border-slate-600 overflow-hidden">
             {user?.profilePic ? (
               <img src={`/api/image/${user.profilePic}`} alt="Profile" className="w-full h-full object-cover" />
             ) : (
               <User size={24} />
             )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate capitalize">{user?.username || "Director"}</p>
            <p className="text-xs text-slate-500 truncate">{user?.userRole || "Administrator"}</p>
          </div>
          <ChevronDown size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
        </div>
      </div>
    </div>
  );
}

