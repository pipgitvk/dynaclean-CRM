// // components/user/Sidebar.jsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
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
  Clock: Calendar,
  Receipt: FileText,
  ShoppingCart,
  FilePlus,
  PackageCheck,
  ShoppingBag,
  UserPlus,
  Mail,
  Settings,
};

export default function Sidebar({
  isOpen,
  menuItems,
  onCloseSidebar,
  showBackButton,
  backButtonPath,
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

      return (
        <li key={itemKey} className="m-2">
          <Link
            href={item.path}
            className={`flex items-center gap-2 ${theme.sidebar.hover} rounded-md transition-colors p-2`}
            onClick={handleLinkClick}
          >
            {Icon && <Icon size={20} />}
            <span>{item.name}</span>
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
        } overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out shadow-2xl border-r ${
          theme.sidebar.border
        }`,
        isOpen ? "w-64" : "w-0"
      )}
      style={{
        minWidth: isOpen ? "16rem" : "0",
        padding: isOpen ? "1rem" : "0",
      }}
    >
      {isOpen && (
        <>
          <h2
            className={`text-xl font-bold mb-4 ${theme.sidebar.text} border-b ${theme.sidebar.border} pb-3`}
          >
            Admin Dashboard
          </h2>
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
