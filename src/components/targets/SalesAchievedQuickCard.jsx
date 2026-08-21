"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Target } from "lucide-react";

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function getRingColor(percent) {
  if (percent >= 100) return "#22c55e";
  if (percent >= 70) return "#7c3aed";
  if (percent >= 30) return "#f59e0b";
  return "#f97316";
}

export default function SalesAchievedQuickCard() {
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const fetchTarget = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/employee-target");
        if (!res.ok) throw new Error("Failed to fetch target");
        const data = await res.json();
        setTarget(Number(data?.target || 0));
        setCompleted(Number(data?.completed_orders || 0));
      } catch {
        setTarget(0);
        setCompleted(0);
      } finally {
        setLoading(false);
      }
    };

    fetchTarget();
  }, []);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(event.target)) {
        setMobileOpen(false);
      }
    };

    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const hasTarget = target > 0;
  const achievedPercent = hasTarget ? Math.round((completed / target) * 100) : 0;
  const ringPercent = Math.min(Math.max(achievedPercent, 0), 100);
  const strokeColor = getRingColor(achievedPercent);
  const monthLabel = new Date().toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

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
          <div className="h-3 w-24 rounded bg-slate-100" />
          <div className="h-6 w-16 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className="group relative flex min-h-[88px] items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)]"
      onClick={() => setMobileOpen((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setMobileOpen((prev) => !prev);
        }
      }}
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
        <p className="truncate text-sm font-medium text-slate-600">Achieved</p>
        <p className="text-2xl font-bold leading-tight tabular-nums text-slate-900">
          {hasTarget ? `${achievedPercent}%` : "—"}
        </p>
        <p className="text-xs text-slate-400">Monthly Target</p>
      </div>

      <Target size={18} className="shrink-0 text-slate-400" />

      <div
        className={`absolute left-0 top-full z-20 mt-2 min-w-[250px] rounded-xl border border-slate-200/80 bg-white/95 p-3.5 text-xs shadow-xl backdrop-blur-sm ${
          mobileOpen ? "block" : "hidden"
        } md:pointer-events-none md:hidden md:group-hover:block`}
      >
        <div className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 border-l border-t border-slate-200/80 bg-white/95" />
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold tracking-wide text-slate-800">Monthly Snapshot</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {monthLabel}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-violet-50 px-2.5 py-1.5">
            <span className="text-slate-600">Target</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatAmount(target)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5">
            <span className="text-slate-600">Completed</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatAmount(completed)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
