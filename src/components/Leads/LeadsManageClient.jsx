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
  ArrowLeftRight,
  FileText,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserCog,
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
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { getCurrentMonthThroughTodayIso } from "@/lib/crmDateFormat";
import { getLeadsManageCards } from "@/lib/leadsManageHub";
import { LEADS_HUB_RANGE_OPTIONS, resolveLeadsHubRange } from "@/lib/leadsManageHubRange";
const CARD_ICONS = {
  social_media: Megaphone,
  google_ads: Globe,
  indiamart: Store,
  website_direct: MousePointerClick,
  manager_assigned: UserCheck,
  manager_assign: UserCog,
  meta_leads: FileText,
  bulk_reassign: ArrowLeftRight,
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold border ${
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

function SourceKpiCard({
  card,
  total,
  changePct,
  Icon,
  className = "",
  compact = false,
  compactHint = "",
}) {
  if (compact) {
    return (
      <Link
        href={card.href}
        className={`group relative flex min-h-0 items-stretch overflow-hidden rounded-xl border hover:shadow-md hover:-translate-y-px transition-all duration-200 ${card.surface} ${className}`}
      >
        <div
          className={`absolute -top-8 -left-8 h-20 w-20 rounded-full blur-2xl opacity-80 ${card.glow}`}
          aria-hidden
        />
        <div className="relative z-10 flex w-full items-center gap-2.5 px-3 py-2.5 sm:px-3.5">
          <div
            className={`shrink-0 rounded-lg p-1.5 text-white shadow-md shadow-black/10 ${card.iconSurface}`}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-slate-900">{card.title}</h2>
            {compactHint ? (
              <p className="truncate text-[10px] font-semibold text-violet-700/90">{compactHint}</p>
            ) : null}
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-2xl font-bold tabular-nums leading-none tracking-tight text-slate-900">
                {formatNum(total)}
              </span>
              {changePct != null ? (
                <ChangePill
                  value={changePct}
                  className="bg-white/95 px-2 py-0.5 text-xs shadow-sm"
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 h-8 w-full overflow-hidden opacity-60">
          <CardWave color={card.chartColor} gradientId={`wave-${card.id}-compact`} />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={card.href}
      className={`group relative block overflow-hidden rounded-2xl border hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 min-h-[11.5rem] ${card.surface} ${className}`}
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
            <h2 className="text-lg font-bold leading-snug text-slate-900 sm:text-xl">
              {card.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-base leading-snug text-slate-500 sm:text-[17px]">
              {card.subtitle}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-5">
          <span className="text-4xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[2.75rem]">
            {card.staticMetric != null ? card.staticMetric : formatNum(total)}
          </span>
          <Icon
            className="h-[3.25rem] w-[3.25rem] shrink-0 text-slate-900/[0.08] group-hover:text-slate-900/[0.12] transition-colors"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>

        <div className="relative z-20 mt-3">
          {card.noTrend ? (
            <span className="inline-flex items-center rounded-full border border-emerald-100 bg-white/95 px-2.5 py-1 text-sm font-semibold text-emerald-700 shadow-sm">
              Open tool →
            </span>
          ) : (
            <ChangePill value={changePct} className="bg-white/95 shadow-sm" />
          )}
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
  const manualAssignCard = useMemo(
    () => cards.find((c) => c.id === "manager_assigned"),
    [cards],
  );
  const sourceCards = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.id !== "manager_assigned" &&
          c.id !== "bulk_reassign" &&
          c.id !== "meta_leads",
      ),
    [cards],
  );
  const metaLeadsCard = useMemo(
    () => cards.find((c) => c.id === "meta_leads"),
    [cards],
  );
  const bulkReassignCard = useMemo(
    () => cards.find((c) => c.id === "bulk_reassign"),
    [cards],
  );
  const monthDefault = useMemo(() => getCurrentMonthThroughTodayIso(), []);
  const [range, setRange] = useState(initialDashboard?.range || "month");
  const [data, setData] = useState(initialDashboard);
  const [loading, setLoading] = useState(false);
  const [metaLeadsMonthTotal, setMetaLeadsMonthTotal] = useState(null);
  const [pendingReassignCount, setPendingReassignCount] = useState(null);
  const skipInitialFetch = useRef(Boolean(initialDashboard));
  const [customFrom, setCustomFrom] = useState(
    initialDashboard?.from || monthDefault.from,
  );
  const [customTo, setCustomTo] = useState(initialDashboard?.to || monthDefault.to);
  const [appliedCustom, setAppliedCustom] = useState({
    from: initialDashboard?.from || monthDefault.from,
    to: initialDashboard?.to || monthDefault.to,
  });
  const customDraftRef = useRef(appliedCustom);
  useEffect(() => {
    customDraftRef.current = { from: customFrom, to: customTo };
  }, [customFrom, customTo]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = { range, dashboardBase };
      if (range === "custom") {
        params.from = appliedCustom.from;
        params.to = appliedCustom.to;
      }
      const res = await axios.get("/api/leads-manage/hub", { params });
      if (res.data?.success) {
        const { success: _s, ...payload } = res.data;
        setData(payload);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range, dashboardBase, appliedCustom.from, appliedCustom.to]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    if (range === "custom") return;
    loadDashboard();
  }, [range, loadDashboard]);

  const metaMonthRange = useMemo(() => resolveLeadsHubRange("month"), []);

  useEffect(() => {
    let cancelled = false;
    axios
      .get("/api/leads-manage/meta-credential-stats", {
        params: { from: metaMonthRange.from, to: metaMonthRange.to },
      })
      .then((res) => {
        if (cancelled) return;
        const byId = res.data?.byCredentialId || {};
        const sum = Object.values(byId).reduce(
          (acc, row) => acc + (Number(row?.total) || 0),
          0,
        );
        setMetaLeadsMonthTotal(sum);
      })
      .catch(() => {
        if (!cancelled) setMetaLeadsMonthTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [metaMonthRange.from, metaMonthRange.to]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pending-lead-reassign?summary=1")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success) {
          setPendingReassignCount(Number(data.total || 0));
        } else {
          setPendingReassignCount(0);
        }
      })
      .catch(() => {
        if (!cancelled) setPendingReassignCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCustomRange = useCallback(() => {
    const { from, to } = customDraftRef.current;
    setAppliedCustom({ from, to });
    setLoading(true);
    axios
      .get("/api/leads-manage/hub", {
        params: { range: "custom", dashboardBase, from, to },
      })
      .then((res) => {
        if (res.data?.success) {
          const { success: _s, ...payload } = res.data;
          setData(payload);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dashboardBase]);

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
  const rangeLabel = data?.rangeLabel ||
    LEADS_HUB_RANGE_OPTIONS.find((o) => o.id === range)?.label ||
    "Current Month (till today)";

  return (
    <div className="min-h-screen w-full max-w-none bg-gradient-to-b from-violet-50/80 via-slate-50 to-white pb-6 pt-3 sm:pt-4 -mx-2 w-[calc(100%+1rem)] sm:-mx-3 sm:w-[calc(100%+1.5rem)] md:-mx-4 md:w-[calc(100%+2rem)] px-1 sm:px-2">
      <div className="w-full space-y-5">
        <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="shrink-0 rounded-[14px] bg-gradient-to-br from-violet-600 to-purple-600 p-3 shadow-md shadow-violet-500/30">
              <Target className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-indigo-950 sm:text-3xl">
                Leads Manage
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-snug text-slate-500 sm:text-base">
                All inquiry sources in one place — click a card to view filtered customers or
                assigned leads.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {metaLeadsCard ? (
              <SourceKpiCard
                compact
                card={metaLeadsCard}
                total={metaLeadsMonthTotal ?? 0}
                changePct={null}
                compactHint={
                  metaMonthRange.rangeLabel || "Current month (till today)"
                }
                Icon={FileText}
                className="w-full sm:w-auto sm:min-w-[11rem] sm:max-w-[15rem]"
              />
            ) : null}
            {bulkReassignCard ? (
              <SourceKpiCard
                compact
                card={bulkReassignCard}
                total={pendingReassignCount ?? 0}
                changePct={null}
                compactHint="Pending re-assign"
                Icon={ArrowLeftRight}
                className="w-full sm:w-auto sm:min-w-[11rem] sm:max-w-[15rem]"
              />
            ) : null}
            {manualAssignCard ? (
              <SourceKpiCard
                compact
                card={manualAssignCard}
                total={counts[manualAssignCard.countKey] ?? 0}
                changePct={changes[manualAssignCard.countKey]}
                Icon={CARD_ICONS.manager_assigned}
                className="w-full sm:w-auto sm:min-w-[11rem] sm:max-w-[15rem]"
              />
            ) : null}
            <HubDateRangeControl
              range={range}
              setRange={setRange}
              loading={loading}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
              onApplyCustom={applyCustomRange}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {sourceCards.map((card) => {
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

function HubDateRangeControl({
  range,
  setRange,
  loading,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
}) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="relative flex flex-wrap items-center justify-end gap-2">
        {loading && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-600" />}
        <div className="relative inline-flex items-center">
          <CalendarDays className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-violet-500" />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="min-w-[11.5rem] appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-base font-semibold text-slate-800 shadow-sm hover:border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
          >
            {LEADS_HUB_RANGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
      {range === "custom" ? (
        <div className="flex flex-wrap items-end justify-end gap-2 rounded-xl border border-violet-100 bg-white/95 p-3 shadow-sm">
          <div className="min-w-[9.5rem]">
            <label className="mb-1 block text-sm font-semibold text-slate-500">
              From
            </label>
            <TypeableDateFilterInput
              value={customFrom}
              onChange={onCustomFromChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            />
          </div>
          <div className="min-w-[9.5rem]">
            <label className="mb-1 block text-sm font-semibold text-slate-500">
              To
            </label>
            <TypeableDateFilterInput
              value={customTo}
              onChange={onCustomToChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            />
          </div>
          <button
            type="button"
            onClick={onApplyCustom}
            disabled={loading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            Apply
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LeadsTrendCard({ trend, trendTotal, trendChange, rangeLabel, loading }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Leads Trend</h3>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            Total leads from all sources ({rangeLabel})
          </p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-2 text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Total Leads
          </div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">{formatNum(trendTotal)}</div>
          <ChangePill value={trendChange} className="mt-1" />
        </div>
      </div>
      <div className="h-[300px] w-full mt-2">
        {loading && !trend.length ? (
          <div className="h-full flex items-center justify-center text-base text-slate-400">
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
                tick={{ fontSize: 12, fill: "#64748b" }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                width={40}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e9d5ff",
                  background: "#faf5ff",
                  fontSize: 13,
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
    <h3 className="mb-4 text-xl font-bold text-slate-900">Leads by Source</h3>
    <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 min-h-[300px]">
      <div className="relative w-full sm:w-[55%] h-[260px] shrink-0">
        {loading && !legend.length ? (
          <div className="h-full flex items-center justify-center text-base text-slate-400">
            Loading…
          </div>
        ) : legend.length === 0 ? (
          <div className="h-full flex items-center justify-center text-base text-slate-400">
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
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {formatNum(pieTotal)}
                </div>
                <div className="text-sm font-medium text-slate-500">Total Leads</div>
              </div>
            </div>
          </>
        )}
      </div>
      <ul className="w-full sm:flex-1 space-y-3 pr-1">
        {pieData.map((d) => {
          const pct = pieTotal ? Math.round((d.value / pieTotal) * 1000) / 10 : 0;
          return (
            <li key={d.id} className="flex items-start gap-2.5 text-base">
              <span
                className="w-3 h-3 rounded-full shrink-0 mt-1"
                style={{ backgroundColor: d.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate font-semibold text-slate-900">{d.name}</div>
                <div className="text-sm tabular-nums text-slate-500">
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
