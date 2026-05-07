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
    <Link href="/empcrm/user-dashboard/leave-approvals" className="relative inline-block">
      <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
        Leave Approval
      </button>
      {pendingLeavesCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
          {pendingLeavesCount}
        </span>
      )}
    </Link>
  );
}
