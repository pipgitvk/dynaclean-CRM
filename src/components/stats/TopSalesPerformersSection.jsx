"use client";

import { Eye, Medal, Package, ShoppingBag, Users, Wrench } from "lucide-react";

const RANK_RING = [
  "ring-2 ring-amber-400/80 bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-200/60",
  "ring-2 ring-slate-300/80 bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-md shadow-slate-200/50",
  "ring-2 ring-orange-300/80 bg-gradient-to-br from-orange-300 to-orange-600 text-white shadow-md shadow-orange-200/50",
];

function formatPeriod(meta) {
  if (!meta?.dateFrom || !meta?.dateTo) return "Selected period";
  const fmt = (ymd) => {
    const d = new Date(`${ymd}T12:00:00`);
    if (Number.isNaN(d.getTime())) return ymd;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  if (meta.dateFrom === meta.dateTo) return fmt(meta.dateFrom);
  return `${fmt(meta.dateFrom)} – ${fmt(meta.dateTo)}`;
}

function RankBadge({ index }) {
  const rank = index + 1;
  const className =
    index < 3
      ? `flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${RANK_RING[index]}`
      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800";

  return (
    <div className={className} aria-label={`Rank ${rank}`}>
      {index < 3 ? <Medal className="h-5 w-5" aria-hidden /> : rank}
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/90 px-4 py-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function SplitChip({ icon: Icon, label, amount, widthPct, tone }) {
  const tones =
    tone === "indigo"
      ? "border-indigo-100 bg-indigo-50/80 text-indigo-900"
      : "border-rose-100 bg-rose-50/80 text-rose-900";
  const bar = tone === "indigo" ? "bg-indigo-400" : "bg-rose-400";

  return (
    <div className={`min-w-[8.5rem] flex-1 rounded-lg border px-2.5 py-2 ${tones}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </div>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{amount}</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/60">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, widthPct)}%` }} />
      </div>
    </div>
  );
}

export default function TopSalesPerformersSection({
  performers = [],
  meta = null,
  loading = false,
  formatCurrency,
  onViewQuotations,
}) {
  const revenueTotal = performers.reduce((s, p) => s + (Number(p.revenue) || 0), 0);
  const maxRevenue = Math.max(...performers.map((p) => Number(p.revenue) || 0), 1);
  const orderTotal = performers.reduce((s, p) => s + (Number(p.orders_count) || 0), 0);

  if (loading) {
    return (
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50/90 via-white to-indigo-50/80 px-6 py-5">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
        </div>
      </div>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50/90 via-white to-indigo-50/80 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-6 w-6 text-violet-600" aria-hidden />
              <h3 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                Top Sales Performers
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">{formatPeriod(meta)}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Approved orders · quotation line taxable in period
            </p>
          </div>
          {performers.length > 0 ? (
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <StatPill label="Team revenue" value={formatCurrency(revenueTotal)} accent="text-emerald-700" />
              <StatPill
                label="Orders"
                value={orderTotal.toLocaleString("en-IN")}
                accent="text-violet-700"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-6">
          {performers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-14 text-center">
              <ShoppingBag className="mb-2 h-10 w-10 text-slate-300" aria-hidden />
              <p className="text-sm font-medium text-slate-600">No sales data for this period</p>
            </div>
          ) : (
            <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {performers.map((performer, index) => {
                const revenue = Number(performer.revenue) || 0;
                const products = Number(performer.products_taxable) || 0;
                const spares = Number(performer.spares_taxable) || 0;
                const barPct = Math.min(100, (revenue / maxRevenue) * 100);
                const prodPct = revenue > 0 ? (products / revenue) * 100 : 0;
                const sparePct = revenue > 0 ? (spares / revenue) * 100 : 0;

                return (
                  <li
                    key={performer.salesperson}
                    className="group rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-violet-200 hover:shadow-md hover:shadow-violet-100/40"
                  >
                    <div className="flex items-start gap-3">
                      <RankBadge index={index} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-900">
                              {performer.salesperson}
                            </p>
                            <p className="text-xs text-slate-500">
                              {performer.orders_count}{" "}
                              {performer.orders_count === 1 ? "order" : "orders"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-bold tabular-nums text-emerald-700">
                              {formatCurrency(revenue)}
                            </p>
                            <button
                              type="button"
                              onClick={() => onViewQuotations?.(performer.salesperson)}
                              className="rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-700 transition hover:bg-violet-100"
                              title="View quotations"
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <SplitChip
                            icon={Package}
                            label="Products"
                            amount={formatCurrency(products)}
                            widthPct={prodPct}
                            tone="indigo"
                          />
                          <SplitChip
                            icon={Wrench}
                            label="Spares"
                            amount={formatCurrency(spares)}
                            widthPct={sparePct}
                            tone="rose"
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </section>
  );
}