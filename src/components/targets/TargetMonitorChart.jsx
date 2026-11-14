"use client";

import { formatCrmDateOnly } from "@/lib/crmDateFormat";

import { useState, useEffect, useMemo } from "react";
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
import TargetChartOrdersModal from "./TargetChartOrdersModal";

const formatShortDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return formatCrmDateOnly(date);
};

const formatCompact = (n) => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};

/** Inclusive calendar months between YYYY-MM-DD bounds (filter range). */
function countFilteredCalendarMonths(dateFrom, dateTo) {
  const from = String(dateFrom || "").slice(0, 10);
  const to = String(dateTo || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return 0;
  }
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  const start = from <= to ? { y: y1, m: m1 } : { y: y2, m: m2 };
  const end = from <= to ? { y: y2, m: m2 } : { y: y1, m: m1 };
  return (end.y - start.y) * 12 + (end.m - start.m) + 1;
}

const buildLabel = (row, rows) => {
  const sameName = rows.filter((r) => r.username === row.username).length;
  if (sameName <= 1) return row.username;
  return `${row.username} (${formatShortDate(row.target_end_date)})`;
};

const APPROVED_BADGE_R = 13;

const XAxisTick = ({ x, y, payload, chartData, onSelectRow }) => {
  const row = chartData?.find((d) => d.label === payload?.value);
  const approved = row?.approvedOrderCount ?? 0;

  const handleBadgeSelect = (e) => {
    e.stopPropagation();
    if (row) onSelectRow?.(row);
  };

  const badgeCx = -6;
  const badgeCy = 50;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={8}
        textAnchor="end"
        fill="#374151"
        fontSize={10}
        transform="rotate(-35)"
        pointerEvents="none"
      >
        {payload?.value}
      </text>
      <g
        role="button"
        tabIndex={row ? 0 : -1}
        aria-label={`${payload?.value}: ${approved} approved orders. Click for details.`}
        style={{ cursor: row ? "pointer" : "default" }}
        onClick={handleBadgeSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleBadgeSelect(e);
          }
        }}
      >
        <circle
          cx={badgeCx}
          cy={badgeCy}
          r={APPROVED_BADGE_R}
          fill="#fef08a"
          stroke="#eab308"
          strokeWidth={1.25}
        />
        <text
          x={badgeCx}
          y={badgeCy + 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#dc2626"
          fontSize={11}
          fontWeight={700}
          pointerEvents="none"
        >
          {approved}
        </text>
      </g>
    </g>
  );
};

const TargetMonitorChart = ({
  rows,
  periodLabel,
  dateFrom,
  dateTo,
  onMonthlyAvgStatsChange,
}) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ordersModal, setOrdersModal] = useState(null);

  const rowsFingerprint =
    rows
      .map(
        (r) =>
          `${r.id}:${r.target}:${r.target_start_date}:${r.target_end_date}:${r.username}`
      )
      .join("|") + `|from:${dateFrom}|to:${dateTo}`;

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
              startDate: dateFrom,
              endDate: dateTo,
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
              targetId: row.id,
              username: row.username,
              target: s.value.target ?? 0,
              achieved: s.value.completed_amount ?? 0,
              approvedOrderCount: s.value.approved_order_count ?? 0,
              rejectedOrderCount: s.value.rejected_order_count ?? 0,
              cancelledOrderCount: s.value.cancelled_order_count ?? 0,
            };
          }
          return {
            label: buildLabel(row, rows),
            targetId: row.id,
            username: row.username,
            target: Number(row.target) || 0,
            achieved: 0,
            approvedOrderCount: 0,
            rejectedOrderCount: 0,
            cancelledOrderCount: 0,
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

  const monthlyAvgStats = useMemo(() => {
    const monthCount = countFilteredCalendarMonths(dateFrom, dateTo);
    if (!monthCount || !chartData.length) return null;
    const totalAchieved = chartData.reduce(
      (sum, row) => sum + (Number(row.achieved) || 0),
      0,
    );
    return {
      totalAchieved,
      monthCount,
      monthlyAvg: totalAchieved / monthCount,
    };
  }, [chartData, dateFrom, dateTo]);

  useEffect(() => {
    if (!onMonthlyAvgStatsChange) return;
    if (loading) {
      onMonthlyAvgStatsChange(null);
      return;
    }
    onMonthlyAvgStatsChange(monthlyAvgStats);
  }, [loading, monthlyAvgStats, onMonthlyAvgStatsChange]);

  if (!rows.length) {
    return null;
  }

  const chartWidth = Math.max(640, rows.length * 72);

  const openOrdersModal = (payload) => {
    if (!payload?.targetId && !payload?.username) return;
    setOrdersModal({
      targetId: payload.targetId ?? null,
      username: payload.username ?? null,
      label: payload.label || payload.username,
    });
  };

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-center text-lg font-semibold text-gray-800">
        Target vs achieved
      </h2>
      <p className="mb-3 text-center text-xs text-gray-500">
        {periodLabel
          ? `${periodLabel}: achieved ₹ = approved orders only. Click the yellow circle for the order list. Search applies.`
          : "Per assignment period; respects the current search filter. Click the yellow circle for order breakdown."}
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
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 16, left: 8, bottom: 96 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={108}
                  tick={(props) => (
                    <XAxisTick
                      {...props}
                      chartData={chartData}
                      onSelectRow={openOrdersModal}
                    />
                  )}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatCompact(v)}
                  width={56}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (typeof value !== "number") return value;
                    if (name === "Target" || name === "Target achieved") {
                      return `₹${value.toLocaleString("en-IN")}`;
                    }
                    return value;
                  }}
                  labelFormatter={(label) => {
                    const row = chartData.find((d) => d.label === label);
                    if (!row) return label;
                    return `${label} · Approved orders: ${
                      row.approvedOrderCount ?? 0
                    }`;
                  }}
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

      <TargetChartOrdersModal
        isOpen={Boolean(ordersModal)}
        onClose={() => setOrdersModal(null)}
        employeeLabel={ordersModal?.label || ""}
        targetId={ordersModal?.targetId}
        username={ordersModal?.username}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  );
};

export default TargetMonitorChart;
