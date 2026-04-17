// // components/user/Sidebar.jsx
// "use client";

// import clsx from "clsx";
// import Link from "next/link";

// import {
//   Home,
//   FileText,
//   Upload,
//   ClipboardList,
//   ScrollText,
//   BookOpen,
//   DollarSign,
//   FileSignature,
//   ShieldCheck,
//   ListOrdered,
//   FilePlus2,
//   PlayCircle,
// } from "lucide-react";

// // Icon map
// const iconMap = {
//   Home,
//   FileText,
//   Upload,
//   ClipboardList,
//   PlayCircle,
//   ScrollText,
//   BookOpen,
//   DollarSign,
//   FileSignature,
//   ShieldCheck,
//   ListOrdered,
//   FilePlus2,
// };

// export default function Sidebar({ isOpen, menuItems }) {
//   return (
//     <div
//       className={clsx(
//         "h-full bg-gradient-to-b from-gray-800 to-pink-200 text-white overflow-hidden transition-all duration-300 ease-in-out",
//         // "h-full bg-green-700 text-white overflow-hidden transition-all duration-300 ease-in-out",
//         isOpen ? "w-64" : "w-0"
//       )}
//       style={{
//         minWidth: isOpen ? "16rem" : "0",
//         padding: isOpen ? "1rem" : "0",
//       }}
//     >
//       {isOpen && (
//         <>
//           <h2 className="text-xl font-bold mb-4">User Dashboard</h2>
//           <ul className="space-y-2 mt-10">
//             {menuItems.map((item) => {
//               const Icon = iconMap[item.icon] || null;

//               return (
//                 <li key={item.path} className="flex items-center gap-2 m-4">
//                   {Icon && <Icon size={20} />}
//                   <Link href={item.path} className="hover:underline">
//                     {item.name}
//                   </Link>
//                 </li>
//               );
//             })}
//           </ul>
//         </>
//       )}
//     </div>
//   );
// }

// components/user/Sidebar.jsx
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
};

//this is test

export default function Sidebar({
  isOpen,
  menuItems,
  onCloseSidebar,
  showBackButton,
  backButtonPath,
}) {
  const [openMenus, setOpenMenus] = useState({});
  const { theme } = useTheme();

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

      if (item.children?.length) {
        const isSubOpen = openMenus[itemKey];
        return (
          <li key={itemKey} className="m-2">
            <button
              type="button"
              onClick={() => toggleMenu(itemKey)}
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
            className={`flex items-center gap-2 text-sm ${parentKey ? `${theme.sidebar.submenuText} hover:text-white ${theme.sidebar.submenuHover}` : theme.sidebar.hover} rounded-md transition-colors p-2`}
            onClick={handleLinkClick}
          >
            {Icon && <Icon size={parentKey ? 16 : 20} />}
            <span>{item.name}</span>
          </Link>
        </li>
      );
    });
  };

  return (
    <div
      className={clsx(
        `h-full bg-gradient-to-b ${theme.sidebar.gradient} ${theme.sidebar.text} ${theme.sidebar.textureClass || ""} overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300 ease-in-out shadow-2xl border-r ${theme.sidebar.border}`,
        isOpen ? "w-72" : "w-0",
      )}
      style={{
        minWidth: isOpen ? "18rem" : "0",
        padding: isOpen ? "1rem" : "0",
      }}
    >
      {isOpen && (
        <>
          <h2
            className={`text-xl font-bold mb-4 ${theme.sidebar.text} border-b ${theme.sidebar.border} pb-3`}
          >
            User Dashboard
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
