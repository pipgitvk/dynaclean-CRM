"use client";

import { useState, useEffect } from "react";
import { Users, UserCheck, UserX, TrendingUp } from "lucide-react";
import { User, FileText, Calendar, Clock, DollarSign, Receipt, Settings } from "lucide-react";

export default function EmpCrmDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    newJoinees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchUserData();
  }, []);


  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();
      if (data.success) {
        setUserData(data.user);
      } else if (data.username) {
        // API returns user data directly
        setUserData(data);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasAdminAccess = userData && (userData.userRole === "HR" || userData.userRole === "HR HEAD" || userData.userRole === "HR Executive");

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/empcrm/employees");
      const data = await response.json();

      if (data.success) {
        const employees = data.employees || [];
        setStats({
          totalEmployees: employees.length,
          activeEmployees: employees.filter(emp => emp.status == 1).length,
          inactiveEmployees: employees.filter(emp => emp.status == 0).length,
          newJoinees: employees.filter(emp => emp.status == 1 && emp.createdAt >= new Date(new Date().setMonth(new Date().getMonth() - 1))).length,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Employees",
      value: stats.totalEmployees,
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Active Employees",
      value: stats.activeEmployees,
      icon: UserCheck,
      color: "bg-green-500",
    },
    {
      title: "Inactive Employees",
      value: stats.inactiveEmployees,
      icon: UserX,
      color: "bg-red-500",
    },
    {
      title: "New Joinees (This Month)",
      value: stats.newJoinees,
      icon: TrendingUp,
      color: "bg-purple-500",
    },
  ];



  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Employee CRM Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage employee information, leave, attendance, and more</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-600 text-sm font-medium">{card.title}</h3>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-800">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Admin Access Button for HR and HR Head */}
      {hasAdminAccess && (
        <div className="mt-8">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                  <Settings className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">My Dashboard</h2>
                  <p className="text-indigo-100">Access your dashboard</p>
                </div>
              </div>
              <button
                onClick={() => window.location.href = "/empcrm/user-dashboard"}
                className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors duration-200 flex items-center space-x-2"
              >
                <Settings className="w-5 h-5" />
                <span>Go to User Panel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a
              href="/empcrm/admin-dashboard/profile"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <h3 className="font-semibold text-blue-900">Manage Profiles</h3>
              <p className="text-sm text-blue-700">Create and update employee profiles</p>
            </a>
            <a
              href="/empcrm/admin-dashboard/profile/approvals"
              className="block p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <h3 className="font-semibold text-green-900">Profile Approvals</h3>
              <p className="text-sm text-green-700">Review and approve employee profile submissions</p>
            </a>
            <a
              href="/empcrm/admin-dashboard/leave"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <h3 className="font-semibold text-blue-900">Leave Management</h3>
              <p className="text-sm text-blue-700">Approve and track employee leave requests</p>
            </a>
            <a
              href="/empcrm/admin-dashboard/attendance"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <h3 className="font-semibold text-blue-900">Attendance</h3>
              <p className="text-sm text-blue-700">Monitor employee attendance records</p>
            </a>
            <a
              href="/admin-dashboard/stats"
              className="block p-4 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 rounded-lg transition-colors border-2 border-purple-200"
            >
              <h3 className="font-semibold text-purple-900">📊 System Performance Dashboard</h3>
              <p className="text-sm text-purple-700">View comprehensive sales, delivery, payment & service metrics</p>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          </div>
        </div>
      </div>
    </div>
  );
}
