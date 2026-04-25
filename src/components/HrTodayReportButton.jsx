"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

export default function HrTodayReportButton({ userRole }) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const isHr = String(userRole || "").trim() === "HR";
        if (isHr) {
          setAllowed(true);
        } else {
          // Check if user has access to hiring module via api if needed, 
          // but usually userRole HR is enough as per DefaultDashboard.jsx logic
          const res = await fetch("/api/my-modules");
          if (res.ok) {
            const { allowedModules } = await res.json();
            if (allowedModules === null || allowedModules.includes("hiring")) {
              setAllowed(true);
            }
          }
        }
      } catch {
        // fail closed for HR report
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [userRole]);

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
