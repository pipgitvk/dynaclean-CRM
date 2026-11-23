"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  getOpenCompletionsComplaintKpiCards,
  openCompletionsBucketFromKpiCardId,
  openCompletionsKpiCardIdFromFilter,
} from "@/lib/serviceBeforeInstallationHub";
import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

const PIE_SEGMENTS = [
  { field: "pending_complaint", name: "Pending", color: "#eab308" },
  { field: "planned_complaint", name: "Planned", color: "#8b5cf6" },
  { field: "completed_complaint", name: "Completed", color: "#10b981" },
  { field: "pending_for_spares", name: "PENDING FOR US", color: "#f97316" },
  { field: "pending_by_customer", name: "Pending by Customer", color: "#f43f5e" },
  { field: "pending_over_48h_no_plan", name: "Pending > 48h (no plan)", color: "#dc2626" },
];

function cardHasSettledCount(value) {
  if (value == null || value === "") return false;
  return Number.isFinite(Number(value));
}

export default function ServiceBeforeInstallationOpenCompletionsKpiSection({
  openCompletionsBucket = "total_registered",
  totals = {},
  loading = false,
  onCardSelect,
}) {
  const cards = useMemo(() => getOpenCompletionsComplaintKpiCards(), []);
  const activeCardId = openCompletionsKpiCardIdFromFilter(openCompletionsBucket);

  const pieData = useMemo(
    () =>
      PIE_SEGMENTS.map((seg) => ({
        name: seg.name,
        value: Number(totals[seg.field] || 0),
        fill: seg.color,
      })).filter((d) => d.value > 0),
    [totals],
  );

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const cardRows = useMemo(() => [cards.slice(0, 4), cards.slice(4, 7)], [cards]);

  const renderCard = (card) => {
    const value = totals[card.field];
    const settled = cardHasSettledCount(value);
    const cardLoading = Boolean(loading) && !(settled && Number(value) > 0);
    return (
      <ServiceBeforeInstallationKpiCard
        key={card.id}
        card={card}
        total={settled ? Number(value) : null}
        loading={cardLoading}
        active={card.id === activeCardId}
        variant="compact"
        showTrend={false}
        onClick={
          onCardSelect
            ? () => {
                const next = openCompletionsBucketFromKpiCardId(card.id) || "total_registered";
                const current = String(openCompletionsBucket || "total_registered").trim();
                if (next === current) return;
                onCardSelect(next);
              }
            : undefined
        }
      />
    );
  };

  return (
    <div className="mb-5 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cardRows[0].map(renderCard)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(17.5rem,26rem)] lg:items-stretch xl:grid-cols-[1fr_minmax(20rem,30rem)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cardRows[1].map(renderCard)}
        </div>

        <div className="flex min-h-[10.5rem] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4 lg:min-h-0">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
            <h4 className="text-sm font-semibold text-slate-800">Complaints overview</h4>
            <p className="text-[10px] text-slate-500 sm:text-xs">
              {pieTotal > 0
                ? `${pieTotal.toLocaleString("en-IN")} in chart`
                : "No data"}
            </p>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            </div>
          ) : pieData.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
              No data to chart
            </p>
          ) : (
            <div className="h-44 w-full min-h-[11rem] flex-1 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="42%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={62}
                    paddingAngle={2}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [Number(value).toLocaleString("en-IN"), "Count"]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px", lineHeight: "1.25rem", paddingLeft: "4px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}