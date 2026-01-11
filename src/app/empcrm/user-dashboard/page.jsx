"use client";

import { useState, useEffect } from "react";
import { User, FileText, Calendar, Clock, DollarSign, Receipt, Settings } from "lucide-react";
import AttendanceTracker from "@/components/empcrm/AttendanceTracker";

export default function UserEmpCrmDashboard() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  const modules = [
    {
      title: "My Profile",
      description: "View your employee profile and personal information",
      icon: User,
      color: "bg-blue-500",
      href: "/empcrm/user-dashboard/profile",
      available: true,
    },
    {
      title: "Leave",
      description: "Apply for leave and view leave balance",
      icon: Calendar,
      color: "bg-green-500",
      href: "/empcrm/user-dashboard/leave",
      available: true,
    },
    {
      title: "Attendance",
      description: "View your attendance records",
      icon: Clock,
      color: "bg-purple-500",
      href: "/empcrm/user-dashboard/attendance",
      available: true,
    },
    {
      title: "Documents",
      description: "Access your documents and certificates",
      icon: FileText,
      color: "bg-orange-500",
      href: "/empcrm/user-dashboard/documents",
      available: true,
    },
    {
      title: "Salary",
      description: "View salary details and structure",
      icon: DollarSign,
      color: "bg-teal-500",
      href: "/empcrm/user-dashboard/salary",
      available: true,
    },
    {
      title: "Payslip",
      description: "Download monthly payslips",
      icon: Receipt,
      color: "bg-pink-500",
      available: false,
    },
  ];

  // Check if user has HR or HR Head role for admin access
  const hasAdminAccess = userData && (userData.userRole === "HR" || userData.userRole === "HR HEAD" || userData.userRole === "HR Executive");

  // Debug logging
  console.log("User Data:", userData);
  console.log("User Role:", userData?.userRole);
  console.log("Has Admin Access:", hasAdminAccess);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Employee Portal</h1>
        {userData && (
          <p className="text-gray-600 mt-2">
            Welcome back, <span className="font-semibold">{userData.username}</span>
          </p>
        )}
        {/* Debug info - remove this later */}
        {/* {userData && (
          <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm">
            <strong>Debug:</strong> Role: "{userData.userRole}" | Has Admin Access: {hasAdminAccess ? "Yes" : "No"}
          </div>
        )} */}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <div
              key={index}
              className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${!module.available ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              onClick={() => module.available && module.href && (window.location.href = module.href)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${module.color} p-4 rounded-lg`}>
                  <module.icon className="w-8 h-8 text-white" />
                </div>
                {!module.available && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                    Coming Soon
                  </span>
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{module.title}</h3>
              <p className="text-sm text-gray-600">{module.description}</p>
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
                  <h2 className="text-2xl font-bold">Employee Management</h2>
                  <p className="text-indigo-100">Access employee profiles, leave management, and HR tools</p>
                </div>
              </div>
              <button
                onClick={() => window.location.href = "/empcrm/admin-dashboard"}
                className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors duration-200 flex items-center space-x-2"
              >
                <Settings className="w-5 h-5" />
                <span>Go to Admin Panel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Tracker Section */}
      {userData && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Today's Attendance</h2>
          <AttendanceTracker username={userData.username} />
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">📢 Announcements</h2>
        <p className="text-blue-700 text-sm">No new announcements at this time.</p>
      </div>
    </div>
  );
}
