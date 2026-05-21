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
  Plus,
  CalendarDays,
  User,
  ClipboardList,
} from "lucide-react";
import toast from "react-hot-toast";
import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";
import { getGradientColor } from "@/utils/getGradientColor";

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

// Helper function to format number with Indian comma system
const formatIndianNumber = (num) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

export default function GemCrmDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
    fetchCurrentUser();
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

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        if (user.username) {
          fetchTasks(user.username);
          fetchLeads(user.username);
        }
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchTasks = async (username) => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/tasks?username=${username}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchLeads = async (username) => {
    setLeadsLoading(true);
    try {
      const res = await fetch(`/api/gem-crm/leads?username=${username}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setNewLeadsCount(data.newLeadsCount);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLeadsLoading(false);
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

      {/* Welcome, Profile Pic & Attendance */}
      {currentUser && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <ProfilePicUploader user={currentUser} />
              <div className="space-y-2 flex-1">
                <h1 className="text-3xl font-semibold">
                  Welcome, <span className="text-blue-600">{currentUser.username}</span>
                </h1>
                <p className="text-gray-500 text-sm">Role: {currentUser.userRole || currentUser.role}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <AttendanceTracker username={currentUser.username} role={currentUser.userRole || currentUser.role} />
          </div>
        </div>
      )}

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
          value={`₹${(stats.totalBidValue / 100000).toFixed(2)}L`}
          icon={DollarSign}
          color="bg-purple-500"
        />
        <StatCard
          title="Won Bid Value"
          value={`₹${formatIndianNumber(stats.wonBidValue)}`}
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
          subtitle={`₹${(stats.orderAmount / 100000).toFixed(2)}L`}
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

      {/* Upcoming Tasks */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Tasks ({tasks.length})</h3>
          <a href="/user-dashboard/task-manager" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2">
            View All
          </a>
        </div>
        {tasksLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No upcoming tasks
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 flex-nowrap">
              {tasks.map((task) => {
                const nextDate = task.next_followup_date;
                const hours = nextDate
                  ? (new Date(nextDate).getTime() - Date.now()) / 1000 / 60 / 60
                  : null;

                const bgColor = getGradientColor(hours);

                return (
                  <div
                    key={task.task_id}
                    className="flex flex-col justify-between rounded-2xl shadow-md min-w-[250px] max-w-[320px] p-5 text-gray-700 border border-gray-200 hover:shadow-lg transition duration-300 bg-white"
                    style={{ backgroundColor: bgColor }}
                  >
                    <div>
                      <h3 className="text-xl font-semibold mb-1 line-clamp-1">{task.taskname}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-700 mb-3">
                        <User size={14} className="text-white" />
                        <span className="font-medium">Assigned to:</span>
                        <span className="truncate">{task.taskassignto}</span>
                      </div>
                      {task.notes && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{task.notes}</p>
                      )}
                      <div className="space-y-2 text-xs text-gray-600 font-medium">
                        <div className="flex items-center gap-2">
                          <ClipboardList size={14} className="text-white" />
                          <span>Assigned on: {task.followed_date ? new Date(task.followed_date).toLocaleDateString('en-IN') : '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-white" />
                          <span>Due: {nextDate ? new Date(nextDate).toLocaleDateString('en-IN') : '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                          <span>Status: {task.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-6">
                      <a
                        href={`/user-dashboard/view-task/${task.task_id}`}
                        className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg transition hover:bg-gray-200"
                      >
                        View
                      </a>
                      <a
                        href={`/user-dashboard/followup_task/${task.task_id}`}
                        className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg transition hover:bg-gray-200"
                      >
                        Follow
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Enquiry */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Enquiry</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-600">New Leads</span>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-red-500 px-3 text-sm font-bold text-white shadow">
                {newLeadsCount}
              </span>
            </div>
          </div>
          <a href="/user-dashboard/customers" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2">
            View All
          </a>
        </div>
        {leadsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No upcoming enquiries
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 flex-nowrap">
              {leads.slice(0, 10).map((lead) => {
                const nextDate = lead.next_followup_date;
                const hours = nextDate
                  ? (new Date(nextDate).getTime() - Date.now()) / 1000 / 60 / 60
                  : null;

                const bgColor = getGradientColor(hours);

                return (
                  <div
                    key={lead.customer_id}
                    className="flex flex-col justify-between rounded-2xl shadow-md min-w-[250px] max-w-[320px] p-5 text-gray-700 border border-gray-200 hover:shadow-lg transition duration-300 bg-white"
                    style={{ backgroundColor: bgColor }}
                  >
                    <div>
                      <h3 className="text-xl font-semibold mb-1 line-clamp-1">{lead.first_name || 'Unknown'}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-700 mb-3">
                        <User size={14} className="text-white" />
                        <span className="font-medium">Company:</span>
                        <span className="truncate">{lead.company || '-'}</span>
                      </div>
                      {lead.products_interest && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{lead.products_interest}</p>
                      )}
                      <div className="space-y-2 text-xs text-gray-600 font-medium">
                        <div className="flex items-center gap-2">
                          <ClipboardList size={14} className="text-white" />
                          <span>Assigned on: {lead.followed_date ? new Date(lead.followed_date).toLocaleDateString('en-IN') : '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-white" />
                          <span>Due: {nextDate ? new Date(nextDate).toLocaleDateString('en-IN') : '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                          <span>Status: {lead.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-6">
                      <a
                        href={`/user-dashboard/view-customer/${lead.customer_id}`}
                        className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg transition hover:bg-gray-200"
                      >
                        View
                      </a>
                      <a
                        href={`/user-dashboard/view-customer/${lead.customer_id}`}
                        className="flex items-center justify-center gap-1 text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg transition hover:bg-gray-200"
                      >
                        Follow
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
