"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { DEFAULT_ATTENDANCE_RULES } from "@/lib/attendanceRulesEngine";
import { computeAttendanceDetailsCardSummaryForMonth } from "@/lib/attendanceDetailsCardSummary";
import { formatPresentSummaryCount } from "@/lib/attendanceLogForPayroll";
import AttendanceSummaryGrid from "@/components/AttendanceSummaryGrid";

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function attendanceRowsForSessionUser(attendance, username) {
  const rows = Array.isArray(attendance) ? attendance : [];
  const me = String(username || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!me) return rows;
  return rows.filter((row) => {
    const who = String(row?.username || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    return !who || who === me;
  });
}

/**
 * Logged-in employee only — uses /api/empcrm/attendance/fetch (session user).
 */
export default function UserAttendanceSummaryPage() {
  const [logs, setLogs] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [rules, setRules] = useState(DEFAULT_ATTENDANCE_RULES);
  const [loading, setLoading] = useState(true);
  const [summaryMonth, setSummaryMonth] = useState(currentMonthStr);
  const [sessionUsername, setSessionUsername] = useState("");

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
        setSessionUsername(data.username || "");
        setLogs(attendanceRowsForSessionUser(data.attendance, data.username));
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

  const monthOptions = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-IN", { month: "long", year: "numeric" });
      out.push({ value: v, label });
    }
    return out;
  }, []);

  const summary = useMemo(() => {
    const username =
      sessionUsername ||
      leaves.find((l) => l.username)?.username ||
      "";
    return computeAttendanceDetailsCardSummaryForMonth({
      monthStr: summaryMonth,
      username,
      logs,
      holidaysAll: holidays,
      leavesAll: leaves,
      rules,
    });
  }, [summaryMonth, sessionUsername, logs, holidays, leaves, rules]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-lg text-gray-600">Loading attendance data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 md:px-8">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-900">
        Attendance Summary
      </h1>

      <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <label className="text-sm font-medium text-gray-700">
          Month
          <select
            value={summaryMonth}
            onChange={(e) => setSummaryMonth(e.target.value)}
            className="ml-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8 text-center">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-2xl font-bold text-green-600">
            {formatPresentSummaryCount(summary.present)}
          </p>
          <p className="text-sm text-gray-500">Present</p>
          <p className="text-[11px] text-gray-400 mt-1 leading-tight">
            Automatic check-out = half-day until SUPERADMIN approves
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-2xl font-bold text-orange-600">{summary.absents}</p>
          <p className="text-sm text-gray-500">Absent</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-2xl font-bold text-blue-600">{summary.leaves}</p>
          <p className="text-sm text-gray-500">Leaves</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-2xl font-bold text-purple-600">{summary.sundays}</p>
          <p className="text-sm text-gray-500">Sundays</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-2xl font-bold text-indigo-600">{summary.holidays}</p>
          <p className="text-sm text-gray-500">Holidays</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-2xl font-bold text-yellow-500">{summary.halfDays}</p>
          <p className="text-sm text-gray-500">Half-Days</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-2xl font-bold text-red-600">{summary.lateDays}</p>
          <p className="text-sm text-gray-500">LOP</p>
        </div>
      </div>

      <AttendanceSummaryGrid
        logs={logs}
        holidays={holidays}
        leaves={leaves}
        rules={rules}
      />
    </div>
  );
}
