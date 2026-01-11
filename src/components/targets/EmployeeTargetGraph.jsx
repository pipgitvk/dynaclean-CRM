"use client";
import { useState, useEffect } from "react";
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

const EmployeeTargetGraph = () => {
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

  if (loading)
    return <p className="text-center py-6 text-gray-600">Loading...</p>;
  if (error)
    return <p className="text-center py-6 text-red-500">Error: {error}</p>;

  const {
    target,
    completed_orders,
    target_start_date,
    target_end_date,
    message,
  } = data;

  const chartData = [
    {
      name: "Target",
      value: target,
      color: "#6366f1", // purple
    },
    {
      name: "Completed",
      value: completed_orders,
      color:
        target === 0
          ? "#6366f1"
          : completed_orders / target < 0.3
          ? "#f87171" // red
          : completed_orders / target < 0.7
          ? "#facc15" // yellow
          : "#22c55e", // green
    },
  ];

  return (
    <div className="bg-white p-4 rounded-xl shadow-md w-full max-w-sm mx-auto">
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-gray-700 text-sm mb-1">Month</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm"
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
          <label className="block text-gray-700 text-sm mb-1">Year</label>
          <input
            type="number"
            min="2000"
            max={now.getFullYear() + 5}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-green-100 text-green-700 text-sm text-center py-1 px-2 rounded mb-3">
          {message}
        </div>
      )}

      {/* Graph */}
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

      {/* Target Period */}
      {target_start_date && target_end_date && (
        <p className="text-gray-500 text-xs mt-3 text-center">
          Target: {new Date(target_start_date).toLocaleDateString()} –{" "}
          {new Date(target_end_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

export default EmployeeTargetGraph;
