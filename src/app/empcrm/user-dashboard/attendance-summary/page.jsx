"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { DEFAULT_ATTENDANCE_RULES } from "@/lib/attendanceRulesEngine";
import AttendanceSummaryGrid from "@/components/AttendanceSummaryGrid";

/**
 * Logged-in employee only — uses /api/empcrm/attendance/fetch (session user).
 */
export default function UserAttendanceSummaryPage() {
  const [logs, setLogs] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [rules, setRules] = useState(DEFAULT_ATTENDANCE_RULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [response, rulesRes] = await Promise.all([
          fetch("/api/empcrm/attendance/fetch"),
          fetch("/api/empcrm/attendance-rules"),
        ]);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to fetch attendance data.");
        }
        const data = await response.json();
        if (cancelled) return;
        setLogs(data.attendance || []);
        setHolidays(data.holidays || []);
        setLeaves(data.leaves || []);
        if (rulesRes.ok) {
          const rulesData = await rulesRes.json().catch(() => ({}));
          if (rulesData.rules) setRules(rulesData.rules);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e.message);
          setLogs([]);
          setHolidays([]);
          setLeaves([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-lg text-gray-600">Loading attendance data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 md:px-8">
      <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">Attendance Summary</h1>
      <AttendanceSummaryGrid logs={logs} holidays={holidays} leaves={leaves} rules={rules} />
    </div>
  );
}
