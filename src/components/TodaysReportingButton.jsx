"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export default function TodaysReportingButton({ variant = "default" }) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/my-modules");
        if (res.ok) {
          const { allowedModules } = await res.json();
          if (
            allowedModules !== null &&
            !allowedModules.includes("view-customers")
          ) {
            setAllowed(false);
            return;
          }
        }

        const reportRes = await fetch("/api/dashboard/todays-reporting");
        if (reportRes.ok) {
          const { count: reportCount } = await reportRes.json();
          setCount(reportCount);
        }
      } catch (error) {
        console.error("Error fetching today's reporting:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!loading && !allowed) return null;

  if (variant === "sales") {
    return (
      <SummaryStatCard
        href="/sales-dashboard/customers?filter=today_reporting"
        label="Today's Reporting"
        count={count}
        suffix="Reports"
        icon={Calendar}
        iconWrapClass="bg-orange-500"
        arrowClass="text-orange-500"
        loading={loading}
      />
    );
  }

  if (loading) return null;

  return (
    <Link
      href="/sales-dashboard/customers?filter=today_reporting"
      className="relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-500 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-amber-600 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
    >
      <Calendar size={14} className="sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Today&apos;s Reporting</span>
      <span className="sm:hidden">Reporting</span>
      {count > 0 && (
        <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-amber-600 sm:h-6 sm:w-6 sm:text-xs">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
