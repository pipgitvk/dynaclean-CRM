"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Minus, Loader2 } from "lucide-react";

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

function PatRow({
  row,
  bold = false,
  expandedMap,
  onToggle,
  drill,
  indent = 0,
}) {
  const toggleKey = row.toggleKey || row.id;
  const expanded = Boolean(expandedMap[toggleKey]);
  const drillLoading = drill.loading && drill.section === row.drillSection;
  const drillRows = drill.section === row.drillSection ? drill.rows : [];
  const drillExpenseByMonth =
    drill.section === row.drillSection ? drill.expenseByMonth : null;
  const canExpandChildren =
    Array.isArray(row.children) && row.children.length > 0;
  const canDrill = Boolean(row.drillSection);
  const canExpand = canExpandChildren || canDrill;

  return (
    <>
      <tr className={bold ? "bg-slate-50 font-semibold text-slate-900" : "text-slate-800"}>
        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 sm:px-4">
          {row.id}
        </td>
        <td
          className="px-3 py-2 sm:px-4"
          style={{ paddingLeft: `${12 + indent * 16}px` }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {canExpand ? (
              <button
                type="button"
                onClick={() => onToggle(toggleKey, row.drillSection)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <Minus size={14} /> : <Plus size={14} />}
              </button>
            ) : (
              <span className="inline-block w-7 shrink-0" />
            )}
            <span>{row.label}</span>
            {row.expandHref ? (
              <Link
                href={row.expandHref}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Open
              </Link>
            ) : null}
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums sm:px-4">
          {formatPatInr(row.amount, row.isPercent)}
        </td>
      </tr>
      {expanded && Array.isArray(row.children)
        ? row.children.map((child) => (
            <PatRow
              key={child.id}
              row={child}
              indent={indent + 1}
              expandedMap={expandedMap}
              onToggle={onToggle}
              drill={drill}
            />
          ))
        : null}
      {expanded && row.drillSection ? (
        <tr>
          <td colSpan={3} className="bg-slate-50/80 px-4 py-3">
            {drillLoading ? (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : row.drillSection === "expenses" && drillExpenseByMonth?.months?.length ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  {drillExpenseByMonth.lineCount} expense
                  {drillExpenseByMonth.lineCount === 1 ? "" : "s"} across{" "}
                  {drillExpenseByMonth.months.length} month
                  {drillExpenseByMonth.months.length === 1 ? "" : "s"} · Total{" "}
                  <span className="font-semibold text-slate-800">
                    {formatPatInr(drillExpenseByMonth.grandTotal)}
                  </span>
                </p>
                {drillExpenseByMonth.months.map((month) => (
                  <div
                    key={month.monthKey}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white"
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
            ) : drillRows?.length ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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

export default function PatStatementView({ initialRange = "thisMonth" }) {
  const [range, setRange] = useState(initialRange);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [drill, setDrill] = useState({
    section: null,
    rows: [],
    expenseByMonth: null,
    loading: false,
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setExpanded({});
    setDrill({ section: null, rows: [], expenseByMonth: null, loading: false });
    try {
      const res = await fetch(`/api/admin-dashboard/pat-summary?range=${range}`);
      const data = await res.json();
      if (data.success) setSummary(data.summary);
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const tableRows = useMemo(() => {
    if (!summary?.lines) return [];
    const L = summary.lines;
    return [
      { ...L.revenueSales, toggleKey: "A", drillSection: "revenue_sales" },
      { ...L.otherOperatingIncome, toggleKey: "B" },
      { ...L.totalRevenue, bold: true },
      { ...L.purchaseCogs, toggleKey: "D" },
      { ...L.grossProfit, bold: true },
      { ...L.expenses, toggleKey: "F", drillSection: "expenses" },
      { ...L.ebit, bold: true },
      L.interest,
      { ...L.pbt, bold: true },
      L.currentTax,
      L.deferredTax,
      { ...L.pat, bold: true },
      { ...L.patMargin, bold: true },
    ];
  }, [summary]);

  const toggleRow = async (key, drillSection) => {
    const next = !expanded[key];
    setExpanded((prev) => ({ ...prev, [key]: next }));
    if (!next || !drillSection) return;
    setDrill({
      section: drillSection,
      rows: [],
      expenseByMonth: null,
      loading: true,
    });
    try {
      const q = new URLSearchParams({ section: drillSection, range });
      const res = await fetch(`/api/admin-dashboard/pat-summary?${q}`);
      const data = await res.json();
      if (data.success && data.expenseByMonth) {
        setDrill({
          section: drillSection,
          rows: [],
          expenseByMonth: data.expenseByMonth,
          loading: false,
        });
      } else {
        setDrill({
          section: drillSection,
          rows: data.success && Array.isArray(data.rows) ? data.rows : [],
          expenseByMonth: null,
          loading: false,
        });
      }
    } catch {
      setDrill({
        section: drillSection,
        rows: [],
        expenseByMonth: null,
        loading: false,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Profit &amp; Loss (PAT)
          </h1>
          <p className="text-sm text-slate-600">
            All data — without GST value
            {summary?.periodLabel ? ` · ${summary.periodLabel}` : ""}
          </p>
          {summary?.note ? (
            <p className="mt-1 text-xs text-amber-800">{summary.note}</p>
          ) : null}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Period
          </span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="thisMonth">This month</option>
            <option value="thisYear">This year</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading PAT…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 text-left sm:px-4 w-12">#</th>
                  <th className="px-3 py-2.5 text-left sm:px-4">Particulars</th>
                  <th className="px-3 py-2.5 text-right sm:px-4 w-40">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRows.map((row) => (
                  <PatRow
                    key={row.id}
                    row={row}
                    bold={row.bold}
                    expandedMap={expanded}
                    onToggle={toggleRow}
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
