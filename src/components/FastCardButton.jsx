"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { LayoutDashboard, Users, FileText, TrendingUp } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

const iconMap = {
  LayoutDashboard,
  Users,
  FileText,
  TrendingUp,
};

const salesAccentMap = {
  "border-green-200": {
    iconWrap: "bg-emerald-500",
    arrow: "text-emerald-500",
  },
  "border-purple-200": {
    iconWrap: "bg-blue-500",
    arrow: "text-blue-500",
  },
  "border-blue-200": {
    iconWrap: "bg-blue-500",
    arrow: "text-blue-500",
  },
};

const suffixMap = {
  customers: "Customers",
  sales: "Orders",
  quotations: "Quotes",
};

export default function FastCardButton({
  type,
  label,
  iconName,
  href,
  iconColor,
  variant = "default",
  monthly = false,
}) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);

  const Icon = iconMap[iconName];

  useEffect(() => {
    const init = async () => {
      try {
        const cardUrl = monthly
          ? "/api/card-data?period=month"
          : "/api/card-data";
        const [modulesRes, cardRes] = await Promise.all([
          fetch("/api/my-modules"),
          fetch(cardUrl),
        ]);

        if (modulesRes.ok) {
          const { allowedModules } = await modulesRes.json();
          if (
            allowedModules !== null &&
            !allowedModules.includes("fast-card")
          ) {
            setAllowed(false);
            setLoading(false);
            return;
          }
        }

        if (cardRes.ok) {
          const result = await cardRes.json();
          if (type === "quotations") {
            setCount(result.quotationsCount ?? 0);
          } else if (type === "customers") {
            setCount(result.customersCount ?? 0);
          } else if (type === "sales") {
            setCount(result.ordersCount ?? 0);
          }
        }
      } catch {
        setCount(0);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [type, monthly]);

  if (!loading && !allowed) return null;

  if (variant === "sales") {
    const accent = salesAccentMap[iconColor] || salesAccentMap["border-purple-200"];
    const suffix = monthly
      ? dayjs().format("MMM YYYY")
      : suffixMap[type] || "";
    return (
      <SummaryStatCard
        href={href}
        label={label}
        count={count}
        suffix={suffix}
        icon={Icon}
        iconWrapClass={accent.iconWrap}
        arrowClass={accent.arrow}
        loading={loading}
      />
    );
  }

  if (loading) {
    return (
      <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-100 px-3 py-0.5 sm:w-36 sm:px-4 sm:py-1" />
    );
  }

  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border-2 bg-white px-3 py-0.5 text-[9px] font-medium text-gray-700 transition-all hover:shadow-md sm:px-4 sm:py-1 sm:text-xs ${iconColor}`}
    >
      <div className="flex flex-1 flex-col items-start gap-0">
        <span className="text-[7px] font-normal leading-none text-gray-500 sm:text-[8px]">
          {label}
        </span>
        <span className="text-sm font-bold leading-none text-gray-800 sm:text-base">
          {count}
        </span>
      </div>
      {Icon && (
        <Icon
          size={16}
          className={`sm:h-4 sm:w-4 ${iconColor.replace("border-", "text-")}`}
        />
      )}
    </Link>
  );
}
