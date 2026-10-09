"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Minus,
  Loader2,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Coins,
  Receipt,
  Percent,
  FileText,
  CalendarDays,
  Package,
  Landmark,
} from "lucide-react";

export function formatPatInr(value, isPercent = false) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  if (isPercent) return `${n.toFixed(1)}%`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

const ROW_VARIANT_CLASS = {
  totalBlue: "bg-blue-50/90 font-semibold text-slate-900",
  totalGreen: "bg-emerald-50/90 font-semibold text-slate-900",
  margin: "bg-emerald-50/60 font-medium text-slate-800",
};

function rowIcon(id) {
  const map = {
    A: TrendingUp,
    B: BarChart3,
    C: Coins,
    D: Package,
    E: TrendingUp,
    F: Receipt,
    G: BarChart3,
    H: Landmark,
    I: Coins,
    J: Percent,
    15: Percent,
    16: FileText,
    17: FileText,
  };
  const Icon = map[id] || FileText;
  return <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />;
}

function rowVariantForId(id) {
  if (id === "C" || id === "G" || id === "H") return "totalBlue";
  if (id === "E" || id === "I") return "totalGreen";
  if (id === "J") return "margin";
  return null;
}

function KpiCard({ tone, icon: Icon, label, value }) {
  const tones = {
    green: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white",
    blue: "border-blue-200/80 bg-gradient-to-br from-blue-50 to-white",
    purple: "border-violet-200/80 bg-gradient-to-br from-violet-50 to-white",
    teal: "border-teal-200/80 bg-gradient-to-br from-teal-50 to-white",
  };
  const iconTones = {
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-violet-100 text-violet-700",
    teal: "bg-teal-100 text-teal-700",
  };
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTones[tone] || iconTones.blue}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-600 leading-snug">{label}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 sm:text-xl">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function PatRow({
  row,
  bold = false,
  variant = null,
  expandedMap,
  onToggle,
  onLoadDrill,
  drill,
  indent = 0,
}) {
  const toggleKey = row.toggleKey || row.id;
  const expanded = Boolean(expandedMap[toggleKey]);
  const drillActive =
    drill.section === row.drillSection && drill.parentKey === toggleKey;
  const drillLoading = drill.loading && drillActive;
  const drillRows = drillActive ? drill.rows : [];
  const drillExpenseByMonth = drillActive ? drill.expenseByMonth : null;
  const canExpandChildren =
    Array.isArray(row.children) && row.children.length > 0;
  const canDrill = Boolean(row.drillSection);
  const canExpand = canExpandChildren || canDrill;

  const rowClass =
    variant && ROW_VARIANT_CLASS[variant]
      ? ROW_VARIANT_CLASS[variant]
      : bold
        ? "bg-slate-50 font-semibold text-slate-900"
        : "text-slate-800 bg-white";

  return (
    <>
      <tr className={`border-b border-slate-100 ${rowClass}`}>
        <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-600 sm:px-4 w-14">
          {row.id || "\u00a0"}
        </td>
        <td
          className="px-3 py-3 sm:px-4"
          style={{ paddingLeft: `${8 + indent * 18}px` }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {canExpand ? (
              <button
                type="button"
                onClick={() => {
                  if (canExpandChildren) {
                    onToggle(toggleKey);
                  } else if (canDrill) {
                    onLoadDrill(toggleKey, row.drillSection, !expanded);
                  }
                }}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <Minus size={16} /> : <Plus size={16} />}
              </button>
            ) : (
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
                {indent === 0 ? rowIcon(row.id) : null}
              </span>
            )}
            <span className="text-sm sm:text-[15px]">{row.label}</span>
            {row.expandHref ? (
              <Link
                href={row.expandHref}
                className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-200"
              >
                Open
              </Link>
            ) : null}
            {canExpandChildren && canDrill ? (
              <button
                type="button"
                onClick={() => onLoadDrill(toggleKey, row.drillSection, true)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Line detail
              </button>
            ) : null}
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-medium tabular-nums text-slate-900 sm:px-4">
          {formatPatInr(row.amount, row.isPercent)}
        </td>
      </tr>
      {expanded && Array.isArray(row.children)
        ? row.children.map((child) => (
            <PatRow
              key={child.toggleKey || child.id}
              row={child}
              indent={indent + 1}
              expandedMap={expandedMap}
              onToggle={onToggle}
              onLoadDrill={onLoadDrill}
              drill={drill}
            />
          ))
        : null}
      {expanded && row.drillSection && drillActive ? (
        <tr>
          <td colSpan={3} className="bg-slate-50/90 px-4 py-4 border-b border-slate-100">
            {drillLoading ? (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : row.drillSection === "expenses" && drillExpenseByMonth?.months?.length ? (
              <div className="space-y-4">
                {Array.isArray(drillExpenseByMonth.byHead) &&
                drillExpenseByMonth.byHead.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-slate-100/80 px-3 py-2">
                      <span className="text-sm font-semibold text-slate-800">
                        All expense heads ({drillExpenseByMonth.byHead.length})
                      </span>
                    </div>
                    <div className="max-h-[min(420px,50vh)] overflow-y-auto overflow-x-auto">
                      <table className="w-full min-w-[360px] text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="w-10 px-2 py-1.5">#</th>
                            <th className="px-2 py-1.5">Head</th>
                            <th className="px-2 py-1.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillExpenseByMonth.byHead.map((h) => (
                            <tr key={h.toggleKey || h.id} className="border-t border-slate-100">
                              <td className="px-2 py-1.5 font-medium text-slate-600">{h.id}</td>
                              <td className="px-2 py-1.5">{h.label}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {formatPatInr(h.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                    {drillExpenseByMonth.lineCount} expense
                    {drillExpenseByMonth.lineCount === 1 ? "" : "s"} across{" "}
                    {drillExpenseByMonth.months.length} month
                    {drillExpenseByMonth.months.length === 1 ? "" : "s"} · Total{" "}
                    <span className="font-semibold text-slate-800">
                      {formatPatInr(drillExpenseByMonth.grandTotal)}
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-slate-100 p-3">
                {drillExpenseByMonth.months.map((month) => (
                  <div
                    key={month.monthKey}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-100/80 px-3 py-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {month.label}
                      </span>
                      <span className="text-xs text-slate-600">
                        {month.rows.length} line{month.rows.length === 1 ? "" : "s"} ·{" "}
                        <span className="font-semibold tabular-nums text-teal-800">
                          {formatPatInr(month.total)}
                        </span>
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-2 py-1.5">Expense</th>
                            <th className="px-2 py-1.5">Client</th>
                            <th className="px-2 py-1.5">Head / Date</th>
                            <th className="px-2 py-1.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {month.rows.map((d) => (
                            <tr key={d.id} className="border-t border-slate-100">
                              <td className="px-2 py-1.5">{d.col1}</td>
                              <td className="px-2 py-1.5">{d.col2}</td>
                              <td className="px-2 py-1.5">{d.col3}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {formatPatInr(d.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                  </div>
                </details>
              </div>
            ) : drillRows?.length ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      {row.drillSection === "amc_service" ? (
                        <>
                          <th className="px-2 py-1.5">Order</th>
                          <th className="px-2 py-1.5">Quotation</th>
                          <th className="px-2 py-1.5">AMC/CAMC · By</th>
                          <th className="px-2 py-1.5 text-right">Taxable (ex-GST)</th>
                        </>
                      ) : row.drillSection === "machine_repair" ? (
                        <>
                          <th className="px-2 py-1.5">Order</th>
                          <th className="px-2 py-1.5">Quotation</th>
                          <th className="px-2 py-1.5">Spare / service line · By</th>
                          <th className="px-2 py-1.5 text-right">Taxable (ex-GST)</th>
                        </>
                      ) : row.drillSection === "spare_parts_sales" ? (
                        <>
                          <th className="px-2 py-1.5">Order</th>
                          <th className="px-2 py-1.5">Quotation</th>
                          <th className="px-2 py-1.5">Spare part · By</th>
                          <th className="px-2 py-1.5 text-right">Taxable (ex-GST)</th>
                        </>
                      ) : (
                        <>
                          <th className="px-2 py-1.5">Ref</th>
                          <th className="px-2 py-1.5">Detail</th>
                          <th className="px-2 py-1.5">Status / By</th>
                          <th className="px-2 py-1.5 text-right">Amount</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {drillRows.map((d) => (
                      <tr key={d.id} className="border-t border-slate-100">
                        <td className="px-2 py-1.5">{d.col1}</td>
                        <td className="px-2 py-1.5">{d.col2}</td>
                        <td className="px-2 py-1.5">{d.col3}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatPatInr(d.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No detail rows for this period.</p>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function defaultPatDateFrom() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function defaultPatDateTo() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function patPeriodQueryParams(dateFrom, dateTo) {
  const q = new URLSearchParams();
  q.set("dateFrom", dateFrom);
  q.set("dateTo", dateTo);
  return q;
}

export default function PatStatementView() {
  const [dateFrom, setDateFrom] = useState(defaultPatDateFrom);
  const [dateTo, setDateTo] = useState(defaultPatDateTo);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [drill, setDrill] = useState({
    section: null,
    parentKey: null,
    rows: [],
    expenseByMonth: null,
    loading: false,
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setExpanded({});
    setDrill({
      section: null,
      parentKey: null,
      rows: [],
      expenseByMonth: null,
      loading: false,
    });
    try {
      const q = patPeriodQueryParams(dateFrom, dateTo);
      const res = await fetch(`/api/admin-dashboard/pat-summary?${q}`);
      const data = await res.json();
      if (data.success) setSummary(data.summary);
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const tableRows = useMemo(() => {
    if (!summary?.lines) return [];
    const L = summary.lines;
    return [
      { ...L.revenueSales, toggleKey: "A", drillSection: "revenue_sales" },
      { ...L.otherOperatingIncome, toggleKey: "B" },
      { ...L.totalRevenue, bold: true, variant: rowVariantForId("C") },
      { ...L.purchaseCogs, toggleKey: "D" },
      { ...L.grossProfit, bold: true, variant: rowVariantForId("E") },
      { ...L.expenses, toggleKey: "F", drillSection: "expenses" },
      { ...L.ebit, bold: true, variant: rowVariantForId("G") },
      L.interest,
      { ...L.pbt, bold: true, variant: rowVariantForId("H") },
      L.currentTax,
      L.deferredTax,
      { ...L.pat, bold: true, variant: rowVariantForId("I") },
      { ...L.patMargin, bold: true, variant: rowVariantForId("J") },
    ];
  }, [summary]);

  const kpis = useMemo(() => {
    const L = summary?.lines;
    if (!L) return null;
    return {
      revenue: L.totalRevenue?.amount,
      expenses: L.expenses?.amount,
      pbt: L.pbt?.amount,
      margin: L.patMargin?.amount,
    };
  }, [summary]);

  const toggleRow = (key) => {
    const next = !expanded[key];
    setExpanded((prev) => ({ ...prev, [key]: next }));
    if (!next && drill.parentKey === key) {
      setDrill({
        section: null,
        parentKey: null,
        rows: [],
        expenseByMonth: null,
        loading: false,
      });
    }
  };

  const loadDrill = async (parentKey, drillSection, open = true) => {
    if (open) {
      setExpanded((prev) => ({ ...prev, [parentKey]: true }));
    }
    setDrill({
      section: drillSection,
      parentKey,
      rows: [],
      expenseByMonth: null,
      loading: true,
    });
    try {
      const q = patPeriodQueryParams(dateFrom, dateTo);
      q.set("section", drillSection);
      const res = await fetch(`/api/admin-dashboard/pat-summary?${q}`);
      const data = await res.json();
      if (data.success && data.expenseByMonth) {
        setDrill({
          section: drillSection,
          parentKey,
          rows: [],
          expenseByMonth: data.expenseByMonth,
          loading: false,
        });
      } else {
        setDrill({
          section: drillSection,
          parentKey,
          rows: data.success && Array.isArray(data.rows) ? data.rows : [],
          expenseByMonth: null,
          loading: false,
        });
      }
    } catch {
      setDrill({
        section: drillSection,
        parentKey,
        rows: [],
        expenseByMonth: null,
        loading: false,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin-dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Profit &amp; Loss (PAT)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              All data — without GST value
              {summary?.periodLabel ? ` · ${summary.periodLabel}` : ""}
            </p>
            {summary?.note ? (
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-amber-800/90">
                {summary.note}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:min-w-[280px]">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Period
          </span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase text-slate-400">From</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            <span className="hidden shrink-0 text-slate-400 sm:pt-5 sm:block" aria-hidden>
              –
            </span>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase text-slate-400">To</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>
        </div>
      </div>

      {!loading && kpis ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            tone="green"
            icon={TrendingUp}
            label="Total Revenue (A + B)"
            value={formatPatInr(kpis.revenue)}
          />
          <KpiCard
            tone="blue"
            icon={Receipt}
            label="Total Expenses (F)"
            value={formatPatInr(kpis.expenses)}
          />
          <KpiCard
            tone="purple"
            icon={Landmark}
            label="Profit Before Tax (G − 15)"
            value={formatPatInr(kpis.pbt)}
          />
          <KpiCard
            tone="teal"
            icon={Percent}
            label="PAT Margin"
            value={formatPatInr(kpis.margin, true)}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-sm font-medium">Loading PAT…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-100/90 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left w-14">#</th>
                  <th className="px-4 py-3 text-left">Particulars</th>
                  <th className="px-4 py-3 text-right w-44">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <PatRow
                    key={row.id}
                    row={row}
                    bold={row.bold}
                    variant={row.variant}
                    expandedMap={expanded}
                    onToggle={toggleRow}
                    onLoadDrill={loadDrill}
                    drill={drill}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
