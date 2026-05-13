"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  TrendingUp,
  DollarSign,
  Award,
  XCircle,
  Clock,
  ShieldCheck,
  ShoppingCart,
  BarChart3,
  Users,
  Building2,
} from "lucide-react";
import toast from "react-hot-toast";

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function GemCrmDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch("/api/gem-crm/dashboard/stats");
      const result = await res.json();
      if (result.success) {
        setStats(result.data);
      } else {
        toast.error("Failed to fetch dashboard stats");
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast.error("Error fetching dashboard stats");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GEM CRM Dashboard</h1>
        <p className="text-gray-600 mt-1">Government Tender Management Overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Bids"
          value={stats.totalBids}
          icon={FileText}
          color="bg-blue-500"
        />
        <StatCard
          title="Participated"
          value={stats.participated}
          icon={Clock}
          color="bg-yellow-500"
        />
        <StatCard
          title="Won"
          value={stats.won}
          icon={Award}
          color="bg-green-500"
          subtitle={`Win Rate: ${stats.winLossRatio.winRate}%`}
        />
        <StatCard
          title="Lost"
          value={stats.lost}
          icon={XCircle}
          color="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Cancelled"
          value={stats.cancelled}
          icon={XCircle}
          color="bg-gray-500"
        />
        <StatCard
          title="Disqualified"
          value={stats.disqualified}
          icon={ShieldCheck}
          color="bg-orange-500"
        />
        <StatCard
          title="Total Bid Value"
          value={formatCurrency(stats.totalBidValue)}
          icon={DollarSign}
          color="bg-purple-500"
        />
        <StatCard
          title="Won Bid Value"
          value={formatCurrency(stats.wonBidValue)}
          icon={TrendingUp}
          color="bg-green-600"
        />
      </div>

      {/* Order & EMD/BG Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Orders from Bids"
          value={stats.orderCount}
          icon={ShoppingCart}
          color="bg-indigo-500"
          subtitle={formatCurrency(stats.orderAmount)}
        />
        <StatCard
          title="Active EMD"
          value={stats.activeEmdCount}
          icon={ShieldCheck}
          color="bg-teal-500"
        />
        <StatCard
          title="Active BG"
          value={stats.activeBgCount}
          icon={ShieldCheck}
          color="bg-cyan-500"
        />
        <StatCard
          title="Win/Loss Ratio"
          value={`${stats.winLossRatio.won}/${stats.winLossRatio.lost}`}
          icon={BarChart3}
          color="bg-pink-500"
          subtitle={`Total: ${stats.winLossRatio.total}`}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Bids Chart */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Bids Trend</h3>
          <div className="space-y-3">
            {stats.monthlyBids && stats.monthlyBids.length > 0 ? (
              stats.monthlyBids.map((item) => (
                <div key={item.month} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.month}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            (item.count / Math.max(...stats.monthlyBids.map((b) => b.count))) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8">{item.count}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No data available</p>
            )}
          </div>
        </div>

        {/* Platform-wise Bids */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform-wise Bids</h3>
          <div className="space-y-3">
            {stats.platformBids && stats.platformBids.length > 0 ? (
              stats.platformBids.slice(0, 5).map((item) => (
                <div key={item.platform} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.platform}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            (item.count / Math.max(...stats.platformBids.map((b) => b.count))) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8">{item.count}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Employee-wise Performance */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee-wise Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Employee</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Total Bids</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Won</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {stats.employeeBids && stats.employeeBids.length > 0 ? (
                stats.employeeBids.map((employee) => (
                  <tr key={employee.employee_name} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm text-gray-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      {employee.employee_name}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-900">{employee.bid_count}</td>
                    <td className="text-right py-3 px-4 text-sm text-green-600 font-medium">{employee.won_count}</td>
                    <td className="text-right py-3 px-4 text-sm text-gray-900">
                      {formatCurrency(employee.total_value)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-gray-500 text-sm">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
