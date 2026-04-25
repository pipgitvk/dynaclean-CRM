"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

/**
 * Shown on user dashboard when Global Module Access includes "hr-daily-report"
 * (same rule as Reports → HR Daily Report in the sidebar). Mirrors TodayReportButton.
 */
export default function HrTodayReportButton() {
  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/my-modules");
        if (res.ok) {
          const { allowedModules } = await res.json();
          if (allowedModules !== null && !allowedModules.includes("hr-daily-report")) {
            setAllowed(false);
          }
        }
      } catch {
        // on error, keep default (show) — same as TodayReportButton
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  if (loading || !allowed) return null;

  return (
    <Link
      href="/user-dashboard/hr-today-report"
      className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors shrink-0"
    >
      <ClipboardList size={16} />
      HR Today Report
    </Link>
  );
}
