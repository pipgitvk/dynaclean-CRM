"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function RankChart({ followups, keywordRank, keywordPage }) {
  // Prepare data for chart - sort by date
  const chartData = followups
    .map((followup, index) => ({
      date: followup.followup_date
        ? new Date(followup.followup_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          })
        : "N/A",
      rank: followup.rank !== null ? followup.rank : keywordRank || 0,
      // Page length as numeric (0-10 scale based on URL length)
      pageLength: keywordPage ? Math.min(Math.ceil((keywordPage.length / 50) * 10), 10) : 0,
      status: followup.status,
      fullDate: followup.followup_date,
      index: index,
    }))
    .sort((a, b) => {
      // Sort by date
      if (!a.fullDate || !b.fullDate) return 0;
      return new Date(a.fullDate) - new Date(b.fullDate);
    });

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
        No data available to display chart
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800">
          Rank & Page Progression
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Current Rank: <span className="font-semibold text-blue-600">{keywordRank || "-"}</span> | 
          Page: <span className="font-semibold text-green-600">{keywordPage || "-"}</span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart 
          data={chartData} 
          margin={{ top: 10, right: 40, left: 0, bottom: 20 }}
        >
          <defs>
            <linearGradient id="colorRank" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorPage" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="4 4" 
            stroke="#E5E7EB" 
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            style={{ fontSize: "13px", fontWeight: "500" }}
            tick={{ fill: "#6B7280" }}
          />
          <YAxis
            domain={[0, 10]}
            stroke="#9CA3AF"
            style={{ fontSize: "13px", fontWeight: "500" }}
            ticks={[0, 2, 4, 6, 8, 10]}
            tick={{ fill: "#6B7280" }}
            label={{ 
              value: "Score (0-10)", 
              angle: -90, 
              position: "insideLeft",
              style: { fontSize: "13px", fill: "#6B7280" }
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              padding: "12px",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "500",
            }}
            cursor={{ stroke: "#3B82F6", strokeWidth: 2, strokeDasharray: "0" }}
            formatter={(value, name) => {
              if (name === "rank") return [value.toFixed(1), "Rank"];
              if (name === "pageLength") return [value.toFixed(1), "Page Score"];
              return value;
            }}
            labelFormatter={(label) => (
              <span className="text-gray-300">{label}</span>
            )}
          />
          <ReferenceLine 
            y={5} 
            stroke="#D1D5DB" 
            strokeDasharray="5 5" 
            opacity={0.5}
          />
          <Legend 
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="line"
          />
          <Line
            type="natural"
            dataKey="rank"
            stroke="#3B82F6"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 8, fill: "#3B82F6" }}
            fill="url(#colorRank)"
            name="Rank"
            isAnimationActive={true}
            animationDuration={800}
          />
          <Line
            type="natural"
            dataKey="pageLength"
            stroke="#10B981"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 8, fill: "#10B981" }}
            fill="url(#colorPage)"
            name="Page Score"
            isAnimationActive={true}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
