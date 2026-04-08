"use client";

import { useCallback, useEffect, useState } from "react";

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
      const res = await fetch(
        `/api/empcrm/hr-target-chart?month=${month}&year=${year}`,
        { cache: "no-store" }
      );
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

  const target = data?.target ?? 0;
  const completed = data?.completed ?? 0;
  const maxVal = Math.max(target, completed, 1);
  const targetH = Math.round((target / maxVal) * 100);
  const completedH = Math.round((completed / maxVal) * 100);

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Target vs completed</h2>
      {data?.designation && (
        <p className="text-sm text-gray-500 mb-4">
          Designation: <span className="font-medium text-gray-700">{data.designation}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
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
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">Loading…</div>
      )}
      {!loading && error && (
        <div className="rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3">{error}</div>
      )}
      {!loading && !error && data?.message && (
        <div className="rounded-lg bg-amber-50 text-amber-900 text-sm px-4 py-3 mb-4">{data.message}</div>
      )}

      {!loading && !error && (
        <div className="flex justify-center gap-12 sm:gap-20 pt-2">
          <div className="flex flex-col items-center w-28">
            <span className="text-base font-bold text-gray-900 mb-3 tabular-nums">
              {formatAmount(target)}
            </span>
            <div className="w-full h-40 flex flex-col justify-end items-center">
              <div
                className="w-14 rounded-lg bg-[#6A6EFA] min-h-[4px] transition-all duration-300"
                style={{ height: `${targetH}%` }}
                title="Target"
              />
            </div>
            <span className="mt-3 text-sm text-gray-600">Target</span>
          </div>
          <div className="flex flex-col items-center w-28">
            <span className="text-base font-bold text-gray-900 mb-3 tabular-nums">
              {formatAmount(completed)}
            </span>
            <div className="w-full h-40 flex flex-col justify-end items-center">
              <div
                className="w-14 rounded-lg bg-emerald-500 min-h-[4px] transition-all duration-300"
                style={{ height: `${Math.max(completedH, completed > 0 ? 4 : 0)}%` }}
                title="Completed"
              />
            </div>
            <span className="mt-3 text-sm text-gray-600">Completed</span>
          </div>
        </div>
      )}

      {!loading && !error && data?.designation && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          Completed = sum of order amounts in this month for employees with the same designation.
        </p>
      )}
    </div>
  );
}
