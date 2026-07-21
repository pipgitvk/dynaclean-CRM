"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";

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
      className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 sm:gap-2 bg-amber-500 text-white text-[10px] sm:text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors shrink-0 whitespace-nowrap relative"
    >
      <Calendar size={14} className="sm:w-4 sm:h-4" />
      <span className="hidden sm:inline">Today's Reporting</span>
      <span className="sm:hidden">Reporting</span>
      {count > 0 && (
        <span className="ml-1 inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[9px] sm:text-xs font-bold bg-white text-amber-600 rounded-full">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
