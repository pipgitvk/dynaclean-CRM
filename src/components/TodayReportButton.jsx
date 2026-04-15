"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

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
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0"
    >
      <FileText size={16} />
      Today Report
    </Link>
  );
}
