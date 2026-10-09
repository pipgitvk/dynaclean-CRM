"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LeaveApprovalButton() {
  const [isReportingManager, setIsReportingManager] = useState(false);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const fetchReportingManagerStatus = async () => {
      try {
        const response = await fetch("/api/empcrm/reporting-manager-status");
        const data = await response.json();
        console.log("LeaveApprovalButton - API Response:", data);
        setDebugInfo(data);
        if (data.success) {
          setIsReportingManager(data.hasReportees);
          setPendingLeavesCount(data.pendingLeavesCount || 0);
        }
      } catch (error) {
        console.error("Error fetching reporting manager status:", error);
      }
    };

    fetchReportingManagerStatus();
  }, []);

  // Temporary debug: Show button for all users to test
  // Remove this after debugging
  if (process.env.NODE_ENV === 'development') {
    console.log("LeaveApprovalButton - Debug Info:", debugInfo);
  }

  if (!isReportingManager) {
    return null;
  }

  return (
    <Link href="/empcrm/user-dashboard/leave-approvals" className="relative inline-block flex-shrink-0">
      <button className="px-2 py-1.5 sm:px-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-[10px] sm:text-xs font-medium whitespace-nowrap">
        <span className="hidden sm:inline">Leave Approval</span>
        <span className="sm:hidden">Leaves</span>
      </button>
      {pendingLeavesCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">
          {pendingLeavesCount}
        </span>
      )}
    </Link>
  );
}
