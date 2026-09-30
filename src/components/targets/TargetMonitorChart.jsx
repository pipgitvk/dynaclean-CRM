"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const formatShortDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
};

const formatCompact = (n) => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};

const buildLabel = (row, rows) => {
  const sameName = rows.filter((r) => r.username === row.username).length;
  if (sameName <= 1) return row.username;
  return `${row.username} (${formatShortDate(row.target_end_date)})`;
};

const TargetMonitorChart = ({ rows, periodLabel, filterMonth, filterYear }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rowsFingerprint =
    rows
      .map(
        (r) =>
          `${r.id}:${r.target}:${r.target_start_date}:${r.target_end_date}:${r.username}`
      )
      .join("|") + `|m${filterMonth}|y${filterYear}`;

  useEffect(() => {
    if (!rows.length) {
      setChartData([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const settled = await Promise.allSettled(
          rows.map((row) => {
            const params = new URLSearchParams({
              targetId: String(row.id),
              month: String(filterMonth),
              year: String(filterYear),
            });
            return fetch(`/api/target-completion?${params.toString()}`).then((res) => {
              if (!res.ok) throw new Error("Failed to load");
              return res.json();
            });
          })
        );

        const next = rows.map((row, i) => {
          const s = settled[i];
          if (s.status === "fulfilled") {
            return {
              label: buildLabel(row, rows),
              target: s.value.target ?? 0,
              achieved: s.value.completed_amount ?? 0,
            };
          }
          return {
            label: buildLabel(row, rows),
            target: Number(row.target) || 0,
            achieved: 0,
          };
        });

        if (!cancelled) setChartData(next);
        const failed = settled.filter((s) => s.status === "rejected").length;
        if (failed && !cancelled) {
          setError(`${failed} row(s) could not load achievement data.`);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Could not load chart data.");
          setChartData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [rowsFingerprint]);

  if (!rows.length) {
    return null;
  }

  const chartWidth = Math.max(640, rows.length * 72);

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-center text-lg font-semibold text-gray-800">
        Target vs achieved
      </h2>
      <p className="mb-4 text-center text-xs text-gray-500">
        {periodLabel
          ? `${periodLabel}: assignments active this month; achieved = orders in this month (within assignment dates). Search applies.`
          : "Per assignment period; respects the current search filter."}
      </p>

      {loading && (
        <div className="flex h-[320px] items-center justify-center text-gray-500">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            <span className="text-sm">Loading chart…</span>
          </div>
        </div>
      )}

      {!loading && error && (
        <p className="mb-2 text-center text-sm text-amber-700">{error}</p>
      )}

      {!loading && chartData.length > 0 && (
        <div className="w-full overflow-x-auto pb-2">
          <div style={{ minWidth: chartWidth }}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 16, left: 8, bottom: 64 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatCompact(v)}
                  width={56}
                />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? `₹${value.toLocaleString("en-IN")}` : value
                  }
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ paddingTop: 8 }} />
                <Bar
                  dataKey="target"
                  name="Target"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="achieved"
                  name="Target achieved"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetMonitorChart;
