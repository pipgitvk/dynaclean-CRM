"use client";

import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";

const months = [
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

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getRingColor(percent) {
  if (percent >= 100) return "#22c55e";
  if (percent >= 70) return "#7c3aed";
  if (percent >= 30) return "#f59e0b";
  return "#f97316";
}

function ProgressRing({ percent, hasTarget = true, hideLabel = false }) {
  const radius = 52;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const size = radius * 2;

  const safePercent = Math.max(percent, 0);
  const ringFill = Math.min(safePercent, 100);
  const strokeDashoffset =
    circumference - (ringFill / 100) * circumference;
  const strokeColor = getRingColor(safePercent);
  const textColor =
    safePercent >= 100
      ? "text-emerald-600"
      : safePercent >= 70
        ? "text-violet-700"
        : "text-amber-600";

  return (
    <div
      className="relative mx-auto shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        height={size}
        width={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block -rotate-90"
        aria-hidden
      >
        <circle
          stroke="#e2e8f0"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {hasTarget && (
          <circle
            stroke={strokeColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {hasTarget ? (
          <>
            <p
              className={`text-2xl font-bold leading-none tabular-nums ${textColor}`}
            >
              {safePercent}%
            </p>
            {!hideLabel && (
              <p className="mt-1 text-xs font-medium text-slate-500">Achieved</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xl font-bold leading-none text-slate-400">—</p>
            {!hideLabel && (
              <p className="mt-1 text-xs font-medium text-slate-500">Achieved</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SalesTargetBoard({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  target,
  completed_orders,
  target_start_date,
  target_end_date,
  message,
  now,
}) {
  const hasTarget = target > 0;
  const achievedPercent = hasTarget
    ? Math.round((completed_orders / target) * 100)
    : 0;
  const completedBarWidth = hasTarget
    ? Math.min((completed_orders / target) * 100, 100)
    : 0;
  const isAchieved = hasTarget && completed_orders >= target;

  const bannerText =
    message ||
    (!hasTarget
      ? "No target set for this period."
      : isAchieved
        ? "🎉 Congratulations! Target achieved! 🎊"
        : null);

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-semibold text-slate-800 md:text-lg">
          Monthly Target Progress
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
            value={selectedMonth}
            onChange={(e) => onMonthChange(Number(e.target.value))}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="2000"
            max={now.getFullYear() + 5}
            className="w-[72px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
          />
        </div>
      </div>

      {bannerText && (
        <div
          className={`mb-4 rounded-xl px-4 py-2.5 text-center text-sm font-medium ${
            !hasTarget
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {bannerText}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Target
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 md:text-2xl">
              {formatAmount(target)}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: hasTarget ? "100%" : "0%" }}
              />
            </div>
            <p className="mt-1 text-right text-xs font-semibold text-violet-600">
              {hasTarget ? "100%" : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Completed
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 md:text-2xl">
              {formatAmount(completed_orders)}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${completedBarWidth}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs font-semibold text-emerald-600">
              {hasTarget ? `${achievedPercent}%` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Achieved
            </p>
            <div className="mt-2 flex items-center justify-center py-1">
              <ProgressRing
                percent={achievedPercent}
                hasTarget={hasTarget}
                hideLabel
              />
            </div>
          </div>
        </div>

        {target_start_date && target_end_date && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays size={16} className="shrink-0 text-slate-400" />
            <span>
              Target: {formatDisplayDate(target_start_date)} -{" "}
              {formatDisplayDate(target_end_date)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const EmployeeTargetGraph = ({ variant = "default" }) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [data, setData] = useState({
    target: 0,
    completed_orders: 0,
    message: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async (month, year) => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/employee-target?month=${month}&year=${year}`
      );
      if (!res.ok) throw new Error("Failed to fetch data");
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  if (loading) {
    return (
      <p className="py-6 text-center text-gray-600">
        Loading target progress...
      </p>
    );
  }
  if (error) {
    return <p className="py-6 text-center text-red-500">Error: {error}</p>;
  }

  const {
    target,
    completed_orders,
    target_start_date,
    target_end_date,
    message,
  } = data;

  if (variant === "sales") {
    return (
      <SalesTargetBoard
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
        target={target}
        completed_orders={completed_orders}
        target_start_date={target_start_date}
        target_end_date={target_end_date}
        message={message}
        now={now}
      />
    );
  }

  const chartData = [
    { name: "Target", value: target, color: "#6366f1" },
    {
      name: "Completed",
      value: completed_orders,
      color:
        target === 0
          ? "#6366f1"
          : completed_orders / target < 0.3
            ? "#f87171"
            : completed_orders / target < 0.7
              ? "#facc15"
              : "#22c55e",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-4 shadow-md">
      <div className="mb-4 flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm text-gray-700">Month</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm text-gray-700">Year</label>
          <input
            type="number"
            min="2000"
            max={now.getFullYear() + 5}
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          />
        </div>
      </div>

      {message && (
        <div className="mb-3 rounded bg-green-100 px-2 py-1 text-center text-sm text-green-700">
          {message}
        </div>
      )}

      <ResponsiveContainer width="100%" height={150}>
        <BarChart
          data={chartData}
          margin={{ top: 15, right: 15, left: 0, bottom: 15 }}
        >
          <XAxis dataKey="name" axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
            contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
          />
          <Bar dataKey="value" radius={[5, 5, 5, 5]}>
            <LabelList
              dataKey="value"
              position="top"
              fill="#111827"
              fontSize={12}
              fontWeight={600}
            />
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {target_start_date && target_end_date && (
        <p className="mt-3 text-center text-xs text-gray-500">
          Target: {new Date(target_start_date).toLocaleDateString()} –{" "}
          {new Date(target_end_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

export default EmployeeTargetGraph;
