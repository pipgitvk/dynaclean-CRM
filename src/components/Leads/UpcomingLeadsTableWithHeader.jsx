"use client";
import { useEffect, useState } from "react";
import UpcomingLeadsTable from "./UpcomingLeadsTable";

export default function UpcomingLeadsTableWithHeader({
  leadSource,
  userRole = "",
  dashboardPrefix = "/user-dashboard",
  showHeaderOnly = false,
}) {
  const [tableCount, setTableCount] = useState(0);

  useEffect(() => {
    // Listen for count updates from the table component
    const handleCountUpdate = (event) => {
      setTableCount(event.detail.count);
    };

    window.addEventListener('tableCountUpdate', handleCountUpdate);
    return () => window.removeEventListener('tableCountUpdate', handleCountUpdate);
  }, []);

  if (showHeaderOnly) {
    return (
      <p className="text-xs text-slate-400 mt-0.5">
        {tableCount > 0 ? `Showing ${tableCount} of ${tableCount} leads for selected date` : "Select a date range to filter"}
      </p>
    );
  }

  return (
    <UpcomingLeadsTable
      leadSource={leadSource}
      userRole={userRole}
      dashboardPrefix={dashboardPrefix}
      onCountChange={(count) => setTableCount(count)}
    />
  );
}
