"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  ChevronDown,
  Globe,
  Loader2,
  Megaphone,
  MousePointerClick,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getLeadsManageCards } from "@/lib/leadsManageHub";
import { LEADS_HUB_RANGE_OPTIONS } from "@/lib/leadsManageHubRange";

const CARD_ICONS = {
  social_media: Megaphone,
  google_ads: Globe,
  indiamart: Store,
  website_direct: MousePointerClick,
  manager_assigned: UserCheck,
};

function formatNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function ChangePill({ value, className = "" }) {
  const n = Number(value) || 0;
  const up = n >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${
        up
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-rose-50 text-rose-700 border-rose-100"
      } ${className}`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {up ? "+" : ""}
      {n}%
    </span>
  );
}

function CardWave({ color = "#8b5cf6", gradientId = "hub-wave" }) {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full h-[4.5rem] pointer-events-none"
      viewBox="0 0 400 72"
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
        d="M0,40 C60,58 130,18 210,38 S330,58 400,28 L400,72 L0,72 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M0,50 C90,30 150,56 250,42 S340,22 400,48 L400,72 L0,72 Z"
        fill={color}
        fillOpacity="0.14"
      />
      <path
        d="M0,58 C100,44 180,62 280,48 S360,36 400,54 L400,72 L0,72 Z"
        fill={color}
        fillOpacity="0.08"
      />
    </svg>
  );
}

function SourceKpiCard({ card, total, changePct, Icon }) {
  return (
    <Link
      href={card.href}
      className={`group relative block overflow-hidden rounded-2xl border hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 min-h-[11.5rem] ${card.surface}`}
    >
      <div
        className={`absolute -top-10 -left-10 h-28 w-28 rounded-full blur-3xl ${card.glow}`}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/40 to-transparent pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[11.5rem] flex-col p-4 sm:p-5 pb-7">
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 rounded-xl p-2.5 text-white shadow-lg shadow-black/10 ${card.iconSurface}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[15px] sm:text-base font-extrabold leading-snug text-slate-900">
              {card.title}
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-slate-500 line-clamp-2">
              {card.subtitle}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-5">
          <span className="text-[1.65rem] sm:text-[1.85rem] font-bold tabular-nums tracking-tight text-slate-900">
            {formatNum(total)}
          </span>
          <Icon
            className="h-[3.25rem] w-[3.25rem] shrink-0 text-slate-900/[0.08] group-hover:text-slate-900/[0.12] transition-colors"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>

        <div className="relative z-20 mt-3">
          <ChangePill value={changePct} className="bg-white/95 shadow-sm" />
        </div>
      </div>

      <CardWave color={card.chartColor} gradientId={`wave-${card.id}`} />
    </Link>
  );
}

export default function LeadsManageClient({
  dashboardBase = "admin-dashboard",
  initialDashboard,
}) {
  const cards = useMemo(() => getLeadsManageCards(dashboardBase), [dashboardBase]);
  const [range, setRange] = useState(initialDashboard?.range || "month");
  const [data, setData] = useState(initialDashboard);
  const [loading, setLoading] = useState(false);
  const skipInitialFetch = useRef(Boolean(initialDashboard));

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/leads-manage/hub", {
        params: { range, dashboardBase },
      });
      if (res.data?.success) {
        const { success: _s, ...payload } = res.data;
        setData(payload);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range, dashboardBase]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    loadDashboard();
  }, [range, loadDashboard]);

  const counts = data?.counts || {};
  const changes = data?.changes || {};
  const trend = data?.trend || [];

  const pieData = useMemo(
    () =>
      cards.map((card) => ({
        id: card.id,
        name: card.title,
        value: counts[card.countKey] ?? 0,
        color: card.chartColor || "#6366f1",
      })),
    [cards, counts],
  );

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
  const rangeLabel =
    LEADS_HUB_RANGE_OPTIONS.find((o) => o.id === range)?.label || data?.rangeLabel;

  return (
    <div className="min-h-0 bg-gradient-to-b from-slate-100/90 via-slate-50 to-violet-50/30 px-1 sm:px-2 pb-4 sm:pb-6 pt-3 sm:pt-4">
      <div className="max-w-[1440px] mx-auto space-y-5">
        <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="shrink-0 rounded-[14px] bg-gradient-to-br from-violet-600 to-purple-600 p-3 shadow-md shadow-violet-500/30">
              <Target className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-950">
                Leads Manage
              </h1>
              <p className="mt-1 text-[13px] sm:text-sm text-slate-500 max-w-xl leading-snug">
                Inquiry sources ek jagah se — card par click karke filtered customers ya assigned
                leads dekhein.
              </p>
            </div>
          </div>
          <RangeSelect range={range} setRange={setRange} loading={loading} />
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
          {cards.map((card) => {
            const Icon = CARD_ICONS[card.id] || Megaphone;
            return (
              <SourceKpiCard
                key={card.id}
                card={card}
                total={counts[card.countKey] ?? 0}
                changePct={changes[card.countKey]}
                Icon={Icon}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <CardPanel className="xl:col-span-7">
            <LeadsTrendCard
              trend={trend}
              trendTotal={data?.trendTotal ?? 0}
              trendChange={changes.trend}
              rangeLabel={rangeLabel}
              loading={loading}
            />
          </CardPanel>
          <CardPanel className="xl:col-span-5">
            <LeadsSourcePie pieData={pieData} pieTotal={pieTotal} loading={loading} />
          </CardPanel>
        </div>
      </div>
    </div>
  );
}

function CardPanel({ className, children }) {
  return (
    <div className={className}>
      <div className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-sm p-5 sm:p-6 shadow-sm h-full">
        {children}
      </div>
    </div>
  );
}

function RangeSelect({ range, setRange, loading }) {
  return (
    <div className="relative flex items-center gap-2">
      {loading && <Loader2 className="w-5 h-5 animate-spin text-violet-600 shrink-0" />}
      <div className="relative inline-flex items-center">
        <CalendarDays className="absolute left-3.5 w-4 h-4 text-violet-500 pointer-events-none z-10" />
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/25 min-w-[11.5rem]"
        >
          {LEADS_HUB_RANGE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
}

function LeadsTrendCard({ trend, trendTotal, trendChange, rangeLabel, loading }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Leads Trend</h3>
          <p className="text-xs text-slate-500 mt-1">
            Total leads from all sources ({rangeLabel})
          </p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-2 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">
            Total Leads
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatNum(trendTotal)}</div>
          <ChangePill value={trendChange} className="mt-1" />
        </div>
      </div>
      <div className="h-[300px] w-full mt-2">
        {loading && !trend.length ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            Loading…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="leadsTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                width={40}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e9d5ff",
                  background: "#faf5ff",
                  fontSize: 12,
                  boxShadow: "0 4px 14px rgba(124,58,237,0.12)",
                }}
                formatter={(val) => [`${formatNum(val)} Leads`, ""]}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#6d28d9"
                strokeWidth={2.5}
                fill="url(#leadsTrendFill)"
                dot={false}
                activeDot={{ r: 5, fill: "#6d28d9", strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

function LeadsSourcePie({ pieData, pieTotal, loading }) {
  const legend = pieData.filter((d) => d.value > 0);

  return (
  <div className="h-full flex flex-col">
    <h3 className="text-lg font-bold text-slate-900 mb-4">Leads by Source</h3>
    <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 min-h-[300px]">
      <div className="relative w-full sm:w-[55%] h-[260px] shrink-0">
        {loading && !legend.length ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            Loading…
          </div>
        ) : legend.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            No leads in this range
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={legend}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={3}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {legend.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${formatNum(value)} (${pieTotal ? Math.round((value / pieTotal) * 1000) / 10 : 0}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {formatNum(pieTotal)}
                </div>
                <div className="text-[11px] font-medium text-slate-500">Total Leads</div>
              </div>
            </div>
          </>
        )}
      </div>
      <ul className="w-full sm:flex-1 space-y-3 pr-1 max-h-[260px] overflow-y-auto">
        {pieData.map((d) => {
          const pct = pieTotal ? Math.round((d.value / pieTotal) * 1000) / 10 : 0;
          return (
            <li key={d.id} className="flex items-start gap-2.5 text-sm">
              <span
                className="w-3 h-3 rounded-full shrink-0 mt-1"
                style={{ backgroundColor: d.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">{d.name}</div>
                <div className="text-xs text-slate-500 tabular-nums">
                  {pct}% ({formatNum(d.value)})
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  </div>
  );
}
