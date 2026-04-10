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

function formatAmount(n) {
  if (n == null || Number.isNaN(n)) return "0";
  return Math.round(Number(n)).toString();
}

/** One designation: two bars scaled with globalMax, inside the single shared chart row */
function DesignationBarGroup({ designation, target, completed, globalMax }) {
  const maxVal = Math.max(globalMax, 1);
  const targetH = Math.round((Number(target) / maxVal) * 100);
  const completedH = Math.round((Number(completed) / maxVal) * 100);

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
              style={{ height: `${Math.max(completedH, Number(completed) > 0 ? 4 : 0)}%` }}
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

/** Summary + bar row for one set of designation rows (one HR or single-HR view). */
function ItemsChartBlock({ items }) {
  const globalMax = useMemo(() => {
    if (!items.length) return 1;
    return Math.max(1, ...items.flatMap((r) => [Number(r.target) || 0, Number(r.completed) || 0]));
  }, [items]);

  if (!items.length) return null;

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-slate-50/90 px-4 py-3 mb-4 space-y-2.5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">By designation</p>
        {items.map((row, idx) => (
          <div
            key={`${row.designation}-${idx}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-b border-gray-200/80 pb-2 last:border-0 last:pb-0"
          >
            <span className="font-semibold text-gray-900 min-w-[6.5rem] sm:min-w-[8rem]">
              {row.designation || "—"}
            </span>
            <span className="text-gray-600">
              Target{" "}
              <span className="tabular-nums font-semibold text-[#5a5eef]">{formatAmount(row.target)}</span>
            </span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-gray-600">
              Completed{" "}
              <span className="tabular-nums font-semibold text-emerald-700">
                {formatAmount(row.completed)}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="flex overflow-x-auto pb-3 pt-1 justify-start">
          {items.map((row, idx) => (
            <DesignationBarGroup
              key={`${row.designation}-bar-${idx}`}
              designation={row.designation}
              target={row.target ?? 0}
              completed={row.completed ?? 0}
              globalMax={globalMax}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default function HrTargetVsCompletedChart() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
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
                <p className="text-sm font-semibold text-gray-900 mb-1">{g.hr_username}</p>
                <p className="text-xs text-gray-500 mb-4">Per-designation target and completed for the selected month.</p>
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
