"use client";

import { useState, useEffect } from "react";
import { Trophy, Target, TrendingUp, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function TopAchieversCard({ timeRange, month, year }) {
  const [achievers, setAchievers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTopAchievers();
  }, [month, year]);

  const fetchTopAchievers = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin-dashboard-stats/top-achievers?month=${month}&year=${year}`
      );
      const data = await response.json();

      if (data.success) {
        setAchievers(data.data || []);
      } else {
        toast.error(data.error || "Failed to fetch top achievers");
      }
    } catch (error) {
      console.error("Error fetching top achievers:", error);
      toast.error("Error loading top achievers");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const val = parseFloat(amount);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(isNaN(val) ? 0 : val);
  };

  const getAchievementColor = (percent) => {
    if (percent >= 100) return "text-green-600";
    if (percent >= 75) return "text-blue-600";
    if (percent >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressBarColor = (percent) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 75) return "bg-blue-500";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusBadgeColor = (status) => {
    return status === "Achieved" 
      ? "bg-green-100 text-green-800" 
      : "bg-blue-100 text-blue-800";
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-6 h-6 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-800">Top Target Achievers</h3>
        </div>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-6 h-6 text-yellow-600" />
        <h3 className="text-lg font-semibold text-gray-800">Top Target Achievers</h3>
      </div>

      {achievers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No targets assigned for this period</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {achievers.map((achiever, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              {/* Header: Name and Achievement % */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-white flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{achiever.username}</p>
                    <p className="text-xs text-gray-500">
                      Target: {formatCurrency(achiever.target)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${getAchievementColor(achiever.achievement_percent)}`}>
                    {achiever.achievement_percent}%
                  </p>
                  <span className={`inline-block text-xs font-semibold px-2 py-1 rounded mt-1 ${getStatusBadgeColor(achiever.status)}`}>
                    {achiever.status}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(
                      achiever.achievement_percent
                    )}`}
                    style={{ width: `${Math.min(achiever.achievement_percent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Details Row */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-green-50 rounded p-2">
                  <p className="text-gray-600 text-xs">Achieved</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(achiever.achieved)}
                  </p>
                </div>
                {achiever.achievement_percent < 100 ? (
                  <div className="bg-red-50 rounded p-2">
                    <p className="text-gray-600 text-xs">Shortfall</p>
                    <p className="font-semibold text-red-700">
                      {formatCurrency(achiever.shortfall)}
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 rounded p-2">
                    <p className="text-gray-600 text-xs">Exceeded</p>
                    <p className="font-semibold text-green-700">
                      {formatCurrency(achiever.achieved - achiever.target)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
