"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import dayjs from "dayjs";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export default function TodayReportButton({ variant = "default" }) {
  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      try {
        const today = dayjs().format("YYYY-MM-DD");
        const startDate = `${today} 00:00:00`;
        const endDate = `${today} 23:59:59`;

        const [modulesRes, dataRes] = await Promise.all([
          fetch("/api/my-modules"),
          fetch(
            `/api/dashboard-data?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
          ),
        ]);

        if (modulesRes.ok) {
          const { allowedModules } = await modulesRes.json();
          if (
            allowedModules !== null &&
            !allowedModules.includes("daily-report")
          ) {
            setAllowed(false);
            setLoading(false);
            return;
          }
        }

        if (dataRes.ok) {
          const data = await dataRes.json();
          const total =
            (data.followups?.length || 0) +
            (data.quotations?.length || 0) +
            (data.newOrders?.length || 0) +
            (data.demos?.length || 0);
          setCount(total);
        }
      } catch {
        setCount(0);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  const href =
    variant === "sales"
      ? "/sales-dashboard/today-reports"
      : "/user-dashboard/today-reports";

  if (!loading && !allowed) return null;

  if (variant === "sales") {
    return (
      <SummaryStatCard
        href={href}
        label="Today Report"
        count={count}
        suffix="Reports"
        icon={FileText}
        iconWrapClass="bg-violet-500"
        arrowClass="text-violet-500"
        loading={loading}
      />
    );
  }

  if (loading) return null;

  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-blue-700 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
    >
      <FileText size={14} className="sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Today Report</span>
      <span className="sm:hidden">Report</span>
    </Link>
  );
}
