"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

export default function TodayReportButton() {
  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/my-modules");
        if (res.ok) {
          const { allowedModules } = await res.json();
          // null = all allowed; otherwise check daily-report key
          if (allowedModules !== null && !allowedModules.includes("daily-report")) {
            setAllowed(false);
          }
        }
      } catch {
        // on error, show the button (fail open)
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  if (loading || !allowed) return null;

  return (
    <Link
      href="/user-dashboard/today-reports"
      className="group flex h-[82px] min-w-[180px] items-center gap-3 rounded-2xl border border-indigo-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[11px] font-medium text-slate-500">Today Report</span>
        <span className="text-2xl font-bold leading-tight text-slate-800">Open</span>
        <span className="text-[11px] text-slate-400">Reports</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600">
          <FileText size={16} />
        </div>
        <ArrowRight size={12} className="text-indigo-500 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
