"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";
import { isModuleKeyAllowed } from "@/lib/moduleAccess";

export default function ScheduleVisitCard({ variant = "default", href }) {
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const linkHref = href || "/user-dashboard/schedule-visits";

  useEffect(() => {
    const init = async () => {
      try {
        const [modulesRes, countRes] = await Promise.all([
          fetch("/api/my-modules", { credentials: "include", cache: "no-store" }),
          fetch("/api/schedule-visit/count", { credentials: "include", cache: "no-store" }),
        ]);

        if (modulesRes.ok) {
          const { allowedModules } = await modulesRes.json();
          if (!isModuleKeyAllowed("schedule-visits", allowedModules)) {
            setAllowed(false);
            setLoading(false);
            return;
          }
        } else {
          setAllowed(false);
          setLoading(false);
          return;
        }

        setAllowed(true);

        if (countRes.ok) {
          const data = await countRes.json();
          if (data.success) {
            setTotal(data.total || 0);
            setPending(data.pending || 0);
          }
        }
      } catch {
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (!loading && !allowed) return null;

  if (variant === "sales") {
    return (
      <SummaryStatCard
        href={linkHref}
        label="Schedule Visits"
        count={loading ? 0 : total}
        suffix={pending > 0 ? `${pending} pending` : "Total visits"}
        icon={MapPin}
        iconWrapClass="bg-violet-500"
        arrowClass="text-violet-500"
        loading={loading}
      />
    );
  }

  if (variant === "infobox") {
    return (
      <Link href={linkHref}>
        <div
          className="cursor-pointer rounded-xl p-4 sm:p-5 shadow-lg transition-transform transform hover:scale-105 flex flex-col justify-center items-center text-white w-full"
          style={{ backgroundColor: "#7c3aed" }}
        >
          <p className="text-2xl sm:text-3xl font-extrabold">
            {loading ? "..." : total}
          </p>
          <p className="mt-1 sm:mt-2 text-sm sm:text-lg text-center">Schedule Visits</p>
          {pending > 0 && (
            <p className="text-xs mt-1 opacity-90">{pending} pending</p>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link href={linkHref}>
      <div className="bg-white rounded-lg shadow-md p-4 text-black cursor-pointer hover:shadow-lg transition-shadow h-full border-l-4 border-violet-500 min-h-[140px]">
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-violet-500 shrink-0" />
              <h2 className="text-sm font-bold text-black leading-tight">
                Schedule Visits
              </h2>
            </div>
            <p className={`text-2xl font-bold mt-1 ${pending === 0 ? "text-green-600" : "text-red-600"}`}>
              {loading ? "..." : total}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {pending > 0 ? `${pending} pending approval` : "Total visits"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
