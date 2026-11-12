"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const APPROVALS_HREF = "/hr-dashboard/admin-crm/profile/approvals";

export default function HrProfileApprovalStatCard({
  status,
  title,
  subtitle,
  tab,
  borderClass = "border-teal-500",
  icon: Icon,
  iconClass = "text-teal-500",
}) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/empcrm/profile/submissions?status=${encodeURIComponent(status)}`,
          { credentials: "include", cache: "no-store" },
        );
        const data = await res.json();
        if (!cancelled) {
          setCount(
            data.success && Array.isArray(data.submissions)
              ? data.submissions.length
              : 0,
          );
        }
      } catch (e) {
        console.error("HrProfileApprovalStatCard:", e);
        if (!cancelled) setCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const href = tab
    ? `${APPROVALS_HREF}?tab=${encodeURIComponent(tab)}`
    : APPROVALS_HREF;

  return (
    <Link href={href} className="block h-full w-full max-w-[11rem]">
      <div
        className={`bg-white rounded-lg shadow-md p-3 text-black cursor-pointer hover:shadow-lg transition-shadow h-full border-l-4 ${borderClass} min-h-[108px] w-full`}
      >
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-5 h-5 shrink-0 ${iconClass}`} />
              <h2 className="text-sm font-bold text-black leading-tight">
                {title}
              </h2>
            </div>
            <p
              className={`text-2xl font-bold mt-1 ${
                loading
                  ? "text-gray-400"
                  : count === 0
                    ? "text-green-600"
                    : "text-red-600"
              }`}
            >
              {loading ? "..." : count}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
