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
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm">
        <p className="text-gray-300 font-semibold mb-2">{label}</p>
        <p className="text-blue-400">Rank : {data?.rank ?? "-"}</p>
        <p className="text-green-400">Page : {data?.page ?? "-"}</p>
      </div>
    );
  }
  return null;
};

export default function RankChart({ followups, keywordRank, keywordPage }) {
  // Latest followup values (sorted by date desc, then created_at desc)
  const sortedDesc = [...followups].sort((a, b) => {
    const d = new Date(b.followup_date) - new Date(a.followup_date);
    if (d !== 0) return d;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const latestRank = sortedDesc[0]?.rank != null ? Number(sortedDesc[0].rank) : keywordRank || "-";
  const latestPage = sortedDesc[0]?.page != null && sortedDesc[0]?.page !== "" ? sortedDesc[0].page : keywordPage || "-";
  // Each followup as its own point — use index + date as unique X label
  const chartData = [...followups]
    .sort((a, b) => {
      if (!a.followup_date || !b.followup_date) return 0;
      // sort by date asc, then created_at asc
      const d = new Date(a.followup_date) - new Date(b.followup_date);
      if (d !== 0) return d;
      return new Date(a.created_at) - new Date(b.created_at);
    })
    .map((followup, index) => ({
      label: followup.followup_date
        ? new Date(followup.followup_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          }) + (followups.filter(f => f.followup_date === followup.followup_date).length > 1 ? ` #${index + 1}` : "")
        : `Entry ${index + 1}`,
      rank: followup.rank !== null ? Number(followup.rank) : 0,
      page: followup.page !== null && followup.page !== "" ? Number(followup.page) : 0,
    }));

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
          Current Rank: <span className="font-semibold text-blue-600">{latestRank}</span> | 
          Page: <span className="font-semibold text-green-600">{latestPage}</span>
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
            dataKey="label"
            stroke="#9CA3AF"
            style={{ fontSize: "12px", fontWeight: "500" }}
            tick={{ fill: "#6B7280" }}
          />
          <YAxis
            stroke="#9CA3AF"
            style={{ fontSize: "13px", fontWeight: "500" }}
            tick={{ fill: "#6B7280" }}
            label={{ 
              value: "Value", 
              angle: -90, 
              position: "insideLeft",
              style: { fontSize: "13px", fill: "#6B7280" }
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#3B82F6", strokeWidth: 2 }} />
          <Legend 
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="rank"
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{ r: 4, fill: "#3B82F6" }}
            activeDot={{ r: 8, fill: "#3B82F6" }}
            name="Rank"
            isAnimationActive={true}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="page"
            stroke="#10B981"
            strokeWidth={3}
            dot={{ r: 4, fill: "#10B981" }}
            activeDot={{ r: 8, fill: "#10B981" }}
            name="Page"
            isAnimationActive={true}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
