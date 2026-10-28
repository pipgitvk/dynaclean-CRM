"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { ArrowRight } from "lucide-react";

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function getRingColor(percent) {
  if (percent >= 100) return "#22c55e";
  if (percent >= 70) return "#3b82f6";
  if (percent >= 30) return "#f59e0b";
  return "#f97316";
}

function getIstMonthRange() {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  const [y, m] = today.split("-");
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default function SalesTargetQuickCard() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);
  const [target, setTarget] = useState(0);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const init = async () => {
      try {
        const [modulesRes, targetRes] = await Promise.all([
          fetch("/api/my-modules"),
          fetch("/api/employee-target"),
        ]);

        if (modulesRes.ok) {
          const { allowedModules } = await modulesRes.json();
          if (
            allowedModules !== null &&
            !allowedModules.includes("fast-card")
          ) {
            setAllowed(false);
            setLoading(false);
            return;
          }
        }

        if (targetRes.ok) {
          const data = await targetRes.json();
          setTarget(Number(data?.target || 0));
          setCompleted(Number(data?.completed_orders || 0));
        }
      } catch {
        setTarget(0);
        setCompleted(0);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const hasTarget = target > 0;
  const achievedPercent = hasTarget
    ? Math.round((completed / target) * 100)
    : 0;
  const ringPercent = Math.min(Math.max(achievedPercent, 0), 100);
  const strokeColor = getRingColor(achievedPercent);

  const ring = useMemo(() => {
    const radius = 22;
    const stroke = 5;
    const normalizedRadius = radius - stroke / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset =
      circumference - (ringPercent / 100) * circumference;

    return {
      radius,
      stroke,
      circumference,
      strokeDashoffset,
      normalizedRadius,
    };
  }, [ringPercent]);

  const month = getIstMonthRange();
  const href = `/sales-dashboard/order?${new URLSearchParams({
    date_from: month.start,
    date_to: month.end,
    has_invoice: "1",
  }).toString()}`;

  if (!loading && !allowed) return null;

  if (loading) {
    return (
      <div className="flex min-h-[88px] flex-1 animate-pulse items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="h-11 w-11 shrink-0 rounded-full bg-slate-100" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-slate-100" />
          <div className="h-7 w-28 rounded bg-slate-100" />
          <div className="h-2.5 w-16 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex min-h-[88px] min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-md"
    >
      <div
        className="group/ring relative z-10 h-11 w-11 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        tabIndex={0}
        aria-label={`Sales target ${hasTarget ? formatAmount(target) : "not set"}, completed ${formatAmount(completed)}`}
      >
        <svg
          width="44"
          height="44"
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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          <span className="text-[8px] font-semibold tabular-nums text-slate-500">
            {hasTarget ? `${achievedPercent}%` : "—"}
          </span>
        </div>

        <div
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden min-w-[190px] rounded-xl border border-slate-200/80 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-sm group-hover/ring:block group-focus-within/ring:block"
        >
          <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-slate-200/80 bg-white/95" />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5">
              <span className="text-slate-600">Target</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {hasTarget ? formatAmount(target) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-2.5 py-1.5">
              <span className="text-slate-600">Completed</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {formatAmount(completed)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-600">Sales</p>
        <p className="text-2xl font-bold leading-tight tabular-nums text-slate-900">
          {hasTarget ? `${achievedPercent}%` : "—"}
        </p>
        <p className="text-xs text-slate-400">{dayjs().format("MMM YYYY")}</p>
      </div>

      <ArrowRight
        size={18}
        strokeWidth={2}
        className="shrink-0 text-blue-500 transition group-hover:translate-x-0.5"
      />
    </Link>
  );
}
