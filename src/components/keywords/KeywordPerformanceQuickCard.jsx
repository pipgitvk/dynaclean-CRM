"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

function getEffectivePage(keyword) {
  const page = keyword?.latest_followup_page ?? keyword?.page;
  if (page == null || page === "") return null;
  const num = parseInt(String(page).trim(), 10);
  return Number.isNaN(num) ? null : num;
}

function isFirstPageKeyword(keyword) {
  return getEffectivePage(keyword) === 1;
}

function getRingColor(percent) {
  if (percent >= 100) return "#22c55e";
  if (percent >= 70) return "#7c3aed";
  if (percent >= 30) return "#f59e0b";
  return "#f97316";
}

export default function KeywordPerformanceQuickCard() {
  const [loading, setLoading] = useState(true);
  const [totalKeywords, setTotalKeywords] = useState(0);
  const [firstPageKeywords, setFirstPageKeywords] = useState(0);

  useEffect(() => {
    const fetchKeywords = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/keywords", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch keywords");
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        setTotalKeywords(rows.length);
        setFirstPageKeywords(rows.filter(isFirstPageKeyword).length);
      } catch {
        setTotalKeywords(0);
        setFirstPageKeywords(0);
      } finally {
        setLoading(false);
      }
    };

    fetchKeywords();
  }, []);

  const hasTarget = totalKeywords > 0;
  const achievedPercent = hasTarget
    ? Math.round((firstPageKeywords / totalKeywords) * 100)
    : 0;
  const ringPercent = Math.min(Math.max(achievedPercent, 0), 100);
  const strokeColor = getRingColor(achievedPercent);

  const ring = useMemo(() => {
    const radius = 22;
    const stroke = 5;
    const normalizedRadius = radius - stroke / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (ringPercent / 100) * circumference;

    return {
      radius,
      stroke,
      circumference,
      strokeDashoffset,
      normalizedRadius,
    };
  }, [ringPercent]);

  if (loading) {
    return (
      <div className="flex min-h-[88px] animate-pulse items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="h-12 w-12 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded bg-slate-100" />
          <div className="h-6 w-16 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/admin-dashboard/dm-report"
      className="group relative flex min-h-[88px] items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-md"
    >
      <div className="relative h-12 w-12 shrink-0">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          className="-rotate-90"
          aria-hidden
        >
          <circle
            stroke="#e2e8f0"
            fill="transparent"
            strokeWidth={ring.stroke}
            r={ring.normalizedRadius}
            cx={ring.radius}
            cy={ring.radius}
          />
          {hasTarget && (
            <circle
              stroke={strokeColor}
              fill="transparent"
              strokeWidth={ring.stroke}
              strokeLinecap="round"
              strokeDasharray={`${ring.circumference} ${ring.circumference}`}
              strokeDashoffset={ring.strokeDashoffset}
              r={ring.normalizedRadius}
              cx={ring.radius}
              cy={ring.radius}
            />
          )}
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-600">
          Keyword Performance
        </p>
        <p className="text-2xl font-bold leading-tight tabular-nums text-slate-900">
          {hasTarget ? `${achievedPercent}%` : "—"}
        </p>
        <p className="text-xs text-slate-400">1st Page Keywords</p>
      </div>

      <Search size={18} className="shrink-0 text-slate-400" />

      <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden min-w-[250px] rounded-xl border border-slate-200/80 bg-white/95 p-3.5 text-xs shadow-xl backdrop-blur-sm group-hover:block">
        <div className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 border-l border-t border-slate-200/80 bg-white/95" />
        <p className="mb-2 font-semibold tracking-wide text-slate-800">
          Keyword Snapshot
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-violet-50 px-2.5 py-1.5">
            <span className="text-slate-600">Total Keywords</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {totalKeywords}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5">
            <span className="text-slate-600">1st Page Keywords</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {firstPageKeywords}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
