"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  MessageCircle,
  MessageCircleOff,
  Package,
  PackageCheck,
  Truck,
  Shield,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export const SBI_CARD_ICONS = {
  "total-registered": Package,
  "registered-installation-pending": Clock,
  "registered-installation-completed": CheckCircle2,
  "open-installation-delivered-pending": PackageCheck,
  "open-installation-delivery-pending": Truck,
  "open-installation-completed": CheckCircle2,
  "open-installation-feedback-collected": MessageCircle,
  "open-installation-no-feedback": MessageCircleOff,
  "open-installation": Wrench,
  "open-completions": ClipboardList,
  "overdue-delayed-installation": AlertTriangle,
  "active-warranty": ShieldCheck,
  "due-warranty-expiry": CalendarClock,
  "active-amc": Shield,
  "due-amc-expiring": CalendarClock,
};

export const SBI_SPARK_SEED = {
  "total-registered": 3,
  "registered-installation-pending": 6,
  "registered-installation-completed": 9,
  "open-installation-delivered-pending": 4,
  "open-installation-delivery-pending": 8,
  "open-installation-completed": 12,
  "open-installation-feedback-collected": 15,
  "open-installation-no-feedback": 15,
  "open-installation": 5,
  "open-completions": 7,
  "overdue-delayed-installation": 11,
  "active-warranty": 13,
  "due-warranty-expiry": 17,
  "active-amc": 19,
  "due-amc-expiring": 23,
};

const COMPACT_TITLES = {
  "overdue-delayed-installation": "Overdue (Delayed)",
};

export function formatSbiNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function sparkSeries(seed, value) {
  const base = Math.max(1, Number(value) || 0);
  return Array.from({ length: 12 }, (_, i) => ({
    i,
    v: Math.round(base * (0.55 + ((seed + i * 7) % 40) / 100)),
  }));
}

function SummarySparkline({ color, value, seed, size = "default" }) {
  const data = sparkSeries(seed, value);
  const box =
    size === "compact"
      ? "h-10 w-[4.75rem] sm:h-11 sm:w-20"
      : "h-12 w-24 shrink-0 opacity-90 sm:h-14 sm:w-28";
  return (
    <div className={`${box} min-h-[2.5rem] min-w-[4.5rem]`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={40}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={color}
            fillOpacity={size === "compact" ? 0.22 : 0.2}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChangePill({ value, invertTrend = false, className = "", size = "default" }) {
  const pad = size === "compact" ? "px-2 py-0.5 text-xs sm:text-sm" : "px-2.5 py-1 text-sm";

  if (value === null || value === undefined) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 font-semibold text-slate-500 ${pad} ${className}`}
      >
        0.0%
      </span>
    );
  }
  const n = Number(value);
  const isZero = !Number.isFinite(n) || n === 0;
  const up = !isZero && n > 0;
  const Icon = isZero ? null : up ? TrendingUp : TrendingDown;
  const positiveVisual = invertTrend ? !up : up;

  if (isZero) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 font-semibold text-slate-500 ${pad} ${className}`}
      >
        0.0%
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${pad} ${
        positiveVisual
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-rose-100 bg-rose-50 text-rose-700"
      } ${className}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {up ? "+" : ""}
      {n}%
    </span>
  );
}

function CardWave({ color = "#8b5cf6", gradientId = "hub-wave", tall = false }) {
  return (
    <svg
      className={`pointer-events-none absolute bottom-0 left-0 w-full ${tall ? "h-[4.5rem]" : "h-14 sm:h-16"}`}
      viewBox={tall ? "0 0 400 72" : "0 0 400 64"}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <path
        d={tall ? "M0,40 C60,58 130,18 210,38 S330,58 400,28 L400,72 L0,72 Z" : "M0,34 C55,52 125,16 205,36 S328,54 400,24 L400,64 L0,64 Z"}
        fill={`url(#${gradientId})`}
      />
      <path
        d={tall ? "M0,50 C90,30 150,56 250,42 S340,22 400,48 L400,72 L0,72 Z" : "M0,44 C85,26 145,50 245,38 S342,20 400,42 L400,64 L0,64 Z"}
        fill={color}
        fillOpacity="0.14"
      />
      {tall ? (
        <path
          d="M0,58 C100,44 180,62 280,48 S360,36 400,54 L400,72 L0,72 Z"
          fill={color}
          fillOpacity="0.08"
        />
      ) : null}
    </svg>
  );
}

export default function ServiceBeforeInstallationKpiCard({
  card,
  total,
  changePct = null,
  loading = false,
  active = false,
  variant = "hub",
  showTrend = true,
  onClick,
}) {
  const Icon = SBI_CARD_ICONS[card.id] || Package;
  const seed = SBI_SPARK_SEED[card.id] ?? 1;
  const numericTotal = Number(total);
  const hasNumber = total != null && total !== "" && Number.isFinite(numericTotal);
  const waiting = !hasNumber || (Boolean(loading) && !(numericTotal > 0));
  const displayTotal = hasNumber ? numericTotal : 0;
  const title =
    variant === "compact" && COMPACT_TITLES[card.id] ? COMPACT_TITLES[card.id] : card.title;
  const invertTrend = card.id === "overdue-delayed-installation" || card.id === "due-warranty-expiry";
  const isHub = variant === "hub";

  const compactHover =
    onClick || card.href
      ? " cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_rgba(124,58,237,0.22)]"
      : "";
  const shell = isHub
    ? `min-h-[12.5rem] border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${card.surface}`
    : `min-h-[9.25rem] border border-slate-200/75 bg-white/95 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:min-h-[9.75rem]${compactHover}`;

  const activeRing =
    card.id === "registered-installation-pending" ||
    card.id === "open-installation-delivered-pending"
      ? "ring-2 ring-amber-500/75 ring-offset-2 ring-offset-amber-50/60"
      : card.id === "registered-installation-completed" ||
          card.id === "open-installation-completed"
        ? "ring-2 ring-emerald-500/75 ring-offset-2 ring-offset-emerald-50/60"
        : card.id === "open-installation-delivery-pending"
          ? "ring-2 ring-sky-500/75 ring-offset-2 ring-offset-sky-50/60"
          : card.id === "open-installation-feedback-collected" ||
              card.id === "open-installation-no-feedback"
            ? "ring-2 ring-rose-500/75 ring-offset-2 ring-offset-rose-50/60"
            : "ring-2 ring-violet-500/75 ring-offset-2 ring-offset-violet-50/60";
  const className = `group relative block overflow-hidden rounded-2xl ${shell} ${active ? activeRing : ""}`;

  const inner = (
    <>
      <div className={`absolute rounded-full blur-3xl ${card.glow} ${isHub ? "-left-10 -top-10 h-28 w-28" : "-left-8 -top-8 h-24 w-24 blur-2xl"}`} aria-hidden />
      {isHub ? (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/90 via-white/40 to-transparent"
          aria-hidden
        />
      ) : null}

      {isHub ? (
        <div className={`relative z-10 flex min-h-[12.5rem] flex-col p-4 sm:p-5 pb-8`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`shrink-0 rounded-xl p-2.5 text-white shadow-lg shadow-black/10 ${card.iconSurface}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-snug text-slate-900 sm:text-lg">{title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{card.subtitle}</p>
              </div>
            </div>
            {!waiting && hasNumber ? (
              <SummarySparkline color={card.chartColor} value={displayTotal} seed={seed} />
            ) : null}
          </div>

          <div className="mt-auto pt-5">
            <span className="text-4xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[2.65rem]">
              {waiting ? "…" : formatSbiNum(displayTotal)}
            </span>
            {showTrend ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {!waiting && (
                  <ChangePill
                    value={changePct}
                    invertTrend={invertTrend}
                    className="bg-white/95 shadow-sm"
                  />
                )}
                <span className="text-xs font-medium text-slate-400 sm:text-sm">vs last month</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {!waiting && hasNumber ? (
            <div className="pointer-events-none absolute right-2 top-2.5 z-20 sm:right-3 sm:top-3">
              <SummarySparkline
                color={card.chartColor}
                value={displayTotal}
                seed={seed}
                size="compact"
              />
            </div>
          ) : null}
          <div className="relative z-10 flex min-h-[9.25rem] flex-col justify-between p-4 pb-9 sm:min-h-[9.75rem] sm:p-4 sm:pb-10">
            <div className="flex min-w-0 items-center gap-2.5 pr-[5.25rem]">
              <div
                className={`shrink-0 rounded-xl p-2 text-white shadow-md shadow-black/10 ${card.iconSurface}`}
              >
                <Icon className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
              </div>
              <h2 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 sm:text-base">
                {title}
              </h2>
            </div>
            <div className="mt-2 min-w-0">
              <div className="flex flex-wrap items-end gap-2">
                <span className="text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-slate-900 sm:text-[2.125rem]">
                  {waiting ? "…" : formatSbiNum(displayTotal)}
                </span>
                {!waiting && showTrend ? (
                  <ChangePill
                    value={changePct}
                    invertTrend={invertTrend}
                    size="compact"
                    className="mb-0.5 bg-white/90"
                  />
                ) : null}
              </div>
              {card.countCaption ? (
                <p className="mt-2 text-sm font-bold leading-snug text-slate-800 sm:text-[0.9375rem]">
                  {card.countCaption}
                </p>
              ) : null}
            </div>
          </div>
        </>
      )}

      <CardWave color={card.chartColor} gradientId={`sbi-wave-${card.id}`} tall={isHub} />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} w-full text-left`}
        aria-pressed={active}
      >
        {inner}
      </button>
    );
  }

  if (card.href) {
    return (
      <Link href={card.href} className={className} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={className} role="group" aria-label={title}>
      {inner}
    </div>
  );
}