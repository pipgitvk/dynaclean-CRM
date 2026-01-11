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
import { X, Calendar } from "lucide-react";

const TargetCompletionModal = ({ isOpen, onClose, targetData }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [completionData, setCompletionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize dates when modal opens
  useEffect(() => {
    if (isOpen && targetData) {
      const start = targetData.target_start_date
        ? new Date(targetData.target_start_date).toISOString().split("T")[0]
        : "";
      const end = targetData.target_end_date
        ? new Date(targetData.target_end_date).toISOString().split("T")[0]
        : "";
      setStartDate(start);
      setEndDate(end);
    }
  }, [isOpen, targetData]);

  // Fetch completion data
  const fetchCompletionData = async () => {
    if (!targetData || !startDate || !endDate) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/target-completion?username=${encodeURIComponent(
          targetData.username
        )}&startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch completion data");
      }

      const data = await response.json();
      setCompletionData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when dates change or modal opens
  useEffect(() => {
    if (isOpen && startDate && endDate) {
      fetchCompletionData();
    }
  }, [isOpen, startDate, endDate, targetData]);

  if (!isOpen) return null;

  const chartData = completionData
    ? [
        {
          name: "Target",
          value: completionData.target,
          color: "#6366f1",
        },
        {
          name: "Completed",
          value: completionData.completed_amount,
          color:
            completionData.target === 0
              ? "#6366f1"
              : completionData.completed_amount / completionData.target < 0.3
              ? "#f87171"
              : completionData.completed_amount / completionData.target < 0.7
              ? "#facc15"
              : "#22c55e",
        },
      ]
    : [];

  const completionPercentage = completionData
    ? completionData.target > 0
      ? ((completionData.completed_amount / completionData.target) * 100).toFixed(2)
      : 0
    : 0;

  return (
    <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            Target Completion - {targetData?.username}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Date Range Selector */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={20} className="text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-700">
                Select Date Range
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-600">Loading completion data...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">Error: {error}</p>
            </div>
          )}

          {/* Completion Data */}
          {!loading && !error && completionData && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">Target</p>
                  <p className="text-2xl font-bold text-blue-900">
                    ₹{completionData.target.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium">Completed</p>
                  <p className="text-2xl font-bold text-green-900">
                    ₹{completionData.completed_amount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-600 font-medium">
                    Completion %
                  </p>
                  <p className="text-2xl font-bold text-purple-900">
                    {completionPercentage}%
                  </p>
                </div>
              </div>

              {/* Success Message */}
              {completionData.completed_amount >= completionData.target &&
                completionData.target > 0 && (
                  <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                    <p className="text-green-800 font-semibold text-lg">
                      🎉 Congratulations! Target achieved!
                    </p>
                  </div>
                )}

              {/* Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Visual Progress
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.05)" }}
                      contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
                      formatter={(value) => `₹${value.toLocaleString()}`}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      <LabelList
                        dataKey="value"
                        position="top"
                        fill="#111827"
                        fontSize={14}
                        fontWeight={600}
                        formatter={(value) => `₹${value.toLocaleString()}`}
                      />
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Assigned By:</span>
                  <span className="font-semibold text-gray-800">
                    {targetData.created_by}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Target Period:</span>
                  <span className="font-semibold text-gray-800">
                    {new Date(
                      targetData.target_start_date
                    ).toLocaleDateString()}{" "}
                    - {new Date(targetData.target_end_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TargetCompletionModal;
