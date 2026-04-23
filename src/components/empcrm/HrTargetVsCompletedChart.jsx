"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

/** Year dropdown range (matches hiring-style dashboards). */
const YEAR_OPTIONS = (() => {
  const y = new Date().getFullYear();
  return Array.from({ length: 14 }, (_, i) => y + 1 - i);
})();

const filterControlClass =
  "h-10 w-full min-w-0 cursor-pointer rounded-lg border border-slate-800/25 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-800/50 focus:ring-2 focus:ring-slate-900/10";

function formatAmount(n) {
  if (n == null || Number.isNaN(n)) return "0";
  return Math.round(Number(n)).toString();
}

/** One designation: target column is always full height (the bar *is* the goal); done scales vs that row's target. */
function DesignationBarGroup({ designation, target, completed }) {
  const t = Number(target);
  const hasTarget = Number.isFinite(t) && t > 0;
  const targetH = hasTarget ? 100 : 0;
  const doneNum = Number(completed);
  const doneRawPct = hasTarget ? Math.round((doneNum / t) * 100) : 0;
  const completedH = hasTarget ? Math.min(100, Math.max(doneRawPct, doneNum > 0 ? 4 : 0)) : 0;

  return (
    <div className="flex flex-col items-center min-w-[108px] flex-shrink-0 px-2 border-r border-gray-100 last:border-r-0">
      <div className="flex items-end justify-center gap-2 w-full mb-2">
        <div className="flex flex-col items-center gap-1 w-11">
          <span className="text-xs font-bold text-gray-900 tabular-nums leading-none">
            {formatAmount(target)}
          </span>
          <div className="w-full h-28 flex flex-col justify-end rounded-md bg-gray-100/80 overflow-hidden">
            <div
              className="w-full rounded-b-md bg-[#6A6EFA] min-h-[3px] transition-all"
              style={{ height: `${targetH}%` }}
              title="Target"
            />
          </div>
          <span className="text-[10px] uppercase tracking-wide text-gray-500">Target</span>
        </div>
        <div className="flex flex-col items-center gap-1 w-11">
          <span className="text-xs font-bold text-gray-900 tabular-nums leading-none">
            {formatAmount(completed)}
          </span>
          <div className="w-full h-28 flex flex-col justify-end rounded-md bg-gray-100/80 overflow-hidden">
            <div
              className="w-full rounded-b-md bg-emerald-500 min-h-[3px] transition-all"
              style={{ height: `${completedH}%` }}
              title="Completed"
            />
          </div>
          <span className="text-[10px] uppercase tracking-wide text-gray-500">Done</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-center text-gray-800 leading-tight px-1">{designation || "—"}</p>
    </div>
  );
}

/** Bar row per designation (one HR or single-HR view). */
function ItemsChartBlock({ items }) {
  if (!items.length) return null;

  const labelForRow = (row) => {
    const d = String(row?.designation || "").trim();
    const c = String(row?.city || "").trim();
    if (!d) return "—";
    return c ? `${d} (${c})` : d;
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <div className="flex overflow-x-auto pb-3 pt-1 justify-start">
        {items.map((row, idx) => (
          <DesignationBarGroup
            key={`${row.designation}-bar-${idx}`}
            designation={labelForRow(row)}
            target={row.target ?? 0}
            completed={row.completed ?? 0}
          />
        ))}
      </div>
    </div>
  );
}

export default function HrTargetVsCompletedChart() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const yearOptions = useMemo(() => {
    if (YEAR_OPTIONS.includes(year)) return YEAR_OPTIONS;
    return [...YEAR_OPTIONS, year].sort((a, b) => b - a);
  }, [year]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/empcrm/hr-target-chart?month=${month}&year=${year}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not load chart");
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e.message || "Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const isAllHrView = data?.view === "all_hr";
  const groups = isAllHrView && Array.isArray(data?.groups) ? data.groups : null;
  const singleItems = !isAllHrView && Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-5 w-full min-w-0 h-full">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        {isAllHrView ? "All HR — target vs completed" : "Target vs completed"}
      </h2>

      <div className="mb-4 flex flex-wrap items-end gap-4 sm:gap-6">
        <div className="min-w-[10.5rem] flex-1 sm:flex-initial sm:min-w-[11rem]">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="hr-target-month">
            Month
          </label>
          <select
            id="hr-target-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={filterControlClass}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[8rem] flex-1 sm:flex-initial sm:min-w-[9rem]">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="hr-target-year">
            Year
          </label>
          <select
            id="hr-target-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={filterControlClass}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">Loading…</div>
      )}
      {!loading && error && (
        <div className="rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3">{error}</div>
      )}
      {!loading && !error && data?.message && (
        <div className="rounded-lg bg-amber-50 text-amber-900 text-sm px-4 py-3 mb-4">{data.message}</div>
      )}

      {!loading &&
        !error &&
        groups !== null &&
        (groups.length > 0 ? (
          <div className="space-y-8">
            {groups.map((g) => (
              <div
                key={g.hr_username}
                className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 sm:p-5"
              >
                <p className="text-sm font-semibold text-gray-900 mb-4">{g.hr_username}</p>
                <ItemsChartBlock items={g.items || []} />
              </div>
            ))}
          </div>
        ) : (
          !data?.message && (
            <p className="text-sm text-gray-500">No per-HR targets for this month.</p>
          )
        ))}

      {!loading && !error && groups === null && singleItems.length > 0 && (
        <ItemsChartBlock items={singleItems} />
      )}

      {!loading && !error && groups === null && singleItems.length === 0 && !data?.message && (
        <p className="text-sm text-gray-500">No targets for this month.</p>
      )}
    </div>
  );
}
