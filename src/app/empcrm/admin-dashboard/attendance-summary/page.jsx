"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { Loader2, Search } from "lucide-react";
import { DEFAULT_ATTENDANCE_RULES } from "@/lib/attendanceRulesEngine";
import AttendanceSummaryGrid from "@/components/AttendanceSummaryGrid";

const ALL_USERS = "__all__";

export default function AdminAttendanceSummaryPage() {
  const [logs, setLogs] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [rules, setRules] = useState(DEFAULT_ATTENDANCE_RULES);
  const [rulesByUsername, setRulesByUsername] = useState({});
  const [loading, setLoading] = useState(true);
  /** Dropdown value (not applied until Search) */
  const [selectedUser, setSelectedUser] = useState("");
  /** null = no search yet; string username or ALL_USERS */
  const [appliedSelection, setAppliedSelection] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const normalizeUserKey = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  const rulesFor = (username) => {
    if (!username) return rules;
    if (rulesByUsername[username] != null) return rulesByUsername[username];
    const norm = normalizeUserKey(username);
    const matchedKey = Object.keys(rulesByUsername).find(
      (k) => normalizeUserKey(k) === norm
    );
    return matchedKey ? rulesByUsername[matchedKey] : rules;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/empcrm/attendance/fetch-all");
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to fetch attendance data.");
        }
        const data = await response.json();
        if (cancelled) return;
        setLogs(data.attendance || []);
        setHolidays(data.holidays || []);
        setLeaves(data.leaves || []);
        setRulesByUsername(data.rulesByUsername || {});
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message);
          setLogs([]);
          setHolidays([]);
          setLeaves([]);
          setRulesByUsername({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/empcrm/attendance-rules");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.rules) setRules(data.rules);
      } catch (e) {
        console.error("attendance-rules:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const usernames = useMemo(() => {
    const s = new Set();
    logs.forEach((l) => l.username && s.add(l.username));
    leaves.forEach((lv) => lv.username && s.add(lv.username));
    Object.keys(rulesByUsername).forEach((u) => s.add(u));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [logs, leaves, rulesByUsername]);

  const handleSearch = () => {
    if (!selectedUser) {
      toast.error("Please select an employee or All Users.");
      return;
    }
    setSearchLoading(true);
    setAppliedSelection(null);
    setTimeout(() => {
      setAppliedSelection(selectedUser === ALL_USERS ? ALL_USERS : selectedUser);
      setSearchLoading(false);
    }, 120);
  };

  const userLogs = useMemo(() => {
    if (!appliedSelection || appliedSelection === ALL_USERS) return [];
    return logs.filter((l) => l.username === appliedSelection);
  }, [logs, appliedSelection]);

  const userLeaves = useMemo(() => {
    if (!appliedSelection || appliedSelection === ALL_USERS) return [];
    return leaves.filter((lv) => lv.username === appliedSelection);
  }, [leaves, appliedSelection]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-lg text-gray-600">Loading attendance data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 md:px-8">
      <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">Attendance details</h1>

      {usernames.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-amber-900">
          No employees with attendance or leave records yet. Open Attendance details after logs exist, or add approved leaves.
        </p>
      ) : (
        <>
          <div className="mx-auto mb-6 flex max-w-2xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-center">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium text-gray-700">
              Employee
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select employee…</option>
                <option value={ALL_USERS}>All Users</option>
                {usernames.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {searchLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {searchLoading ? "Loading…" : "Search"}
            </button>
          </div>

          {searchLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 py-16 text-slate-600">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
              <p className="mt-4 text-sm font-medium">Loading attendance…</p>
              <p className="mt-1 text-xs text-slate-500">Preparing summary grid</p>
            </div>
          ) : appliedSelection === null ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 py-12 text-center text-sm text-slate-600">
              Select an employee or <span className="font-medium">All Users</span>, then click{" "}
              <span className="font-medium">Search</span> to load the grid below.
            </p>
          ) : appliedSelection === ALL_USERS ? (
            <div className="space-y-10">
              {usernames.map((u, idx) => (
                <div key={u}>
                  <h2 className="mb-3 text-lg font-semibold text-slate-800">{u}</h2>
                  <AttendanceSummaryGrid
                    className={idx === 0 ? "!mt-0" : "!mt-0"}
                    logs={logs.filter((l) => l.username === u)}
                    holidays={holidays}
                    leaves={leaves.filter((lv) => lv.username === u)}
                    rules={rulesFor(u)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <AttendanceSummaryGrid
              logs={userLogs}
              holidays={holidays}
              leaves={userLeaves}
              rules={rulesFor(appliedSelection)}
            />
          )}
        </>
      )}
    </div>
  );
}
