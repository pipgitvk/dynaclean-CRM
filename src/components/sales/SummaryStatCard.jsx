"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SummaryStatCard({
  href,
  label,
  count,
  suffix,
  icon: Icon,
  iconWrapClass,
  arrowClass,
  loading,
}) {
  if (loading) {
    return (
      <div className="flex min-h-[88px] flex-1 animate-pulse items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-slate-100" />
          <div className="h-7 w-14 rounded bg-slate-100" />
          <div className="h-2.5 w-16 rounded bg-slate-100" />
        </div>
        <div className="h-4 w-4 shrink-0 rounded bg-slate-100" />
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex min-h-[88px] min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-md"
    >
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconWrapClass}`}
      >
        {Icon && <Icon size={20} strokeWidth={2} className="text-white" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-600">{label}</p>
        <p className="text-2xl font-bold leading-tight tabular-nums text-slate-900">
          {count}
        </p>
        {suffix ? (
          <p className="text-xs text-slate-400">{suffix}</p>
        ) : null}
      </div>

      <ArrowRight
        size={18}
        strokeWidth={2}
        className={`shrink-0 transition group-hover:translate-x-0.5 ${arrowClass}`}
      />
    </Link>
  );
}
