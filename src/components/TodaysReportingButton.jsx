"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

export default function TodaysReportingButton() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check module access
        const res = await fetch("/api/my-modules");
        if (res.ok) {
          const { allowedModules } = await res.json();
          // null = all allowed; otherwise check for customers view
          if (allowedModules !== null && !allowedModules.includes("view-customers")) {
            setAllowed(false);
            return;
          }
        }

        // Fetch today's reporting count
        const reportRes = await fetch("/api/dashboard/todays-reporting");
        if (reportRes.ok) {
          const { count } = await reportRes.json();
          setCount(count);
        }
      } catch (error) {
        console.error("Error fetching today's reporting:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh count every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !allowed) return null;

  return (
    <Link
      href="/sales-dashboard/customers?filter=today_reporting"
      className="group flex h-[82px] min-w-[180px] items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[11px] font-medium text-slate-500">Today's Reporting</span>
        <span className="text-2xl font-bold leading-tight text-slate-800">{count > 99 ? "99+" : count}</span>
        <span className="text-[11px] text-slate-400">Reports</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-xl bg-amber-100 p-2 text-amber-600">
          <Calendar size={16} />
        </div>
        <ArrowRight size={12} className="text-amber-500 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
