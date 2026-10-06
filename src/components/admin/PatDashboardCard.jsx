"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IndianRupee } from "lucide-react";
import { formatPatInr } from "@/components/admin/PatStatementView";

export default function PatDashboardCard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin-dashboard/pat-summary?range=thisMonth");
      const data = await res.json();
      if (data.success) setSummary(data.summary);
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const patAmount = summary?.lines?.pat?.amount ?? 0;
  const patMargin = summary?.lines?.patMargin?.amount ?? 0;

  return (
    <Link
      href="/admin-dashboard/pat"
      className="bg-white rounded-lg shadow-md p-4 text-black hover:shadow-lg transition-shadow h-full cursor-pointer block border-l-4 border-teal-600 min-h-[140px]"
    >
      <div className="flex flex-col h-full justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-5 h-5 text-teal-600 shrink-0" />
            <h2 className="text-sm font-bold text-black leading-tight">PAT</h2>
          </div>
          {loading && !summary ? (
            <p className="text-sm text-slate-500 mt-1">Loading…</p>
          ) : (
            <>
              <p className="text-2xl font-bold mt-1 text-teal-800 tabular-nums">
                {formatPatInr(patAmount)}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Margin {formatPatInr(patMargin, true)} · this month
              </p>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
