// app/empcrm/user-dashboard/attendance/page.jsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
  DEFAULT_ATTENDANCE_RULES,
  getCheckinStatus as checkinStatusFromRules,
  getCheckoutStatus as checkoutStatusFromRules,
  getBreakStatus as breakStatusFromRules,
  isHalfDayByRules,
  isLateDaySummary,
} from "@/lib/attendanceRulesEngine";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";
import AttendanceRegularizeModal from "@/app/user-dashboard/attendance/AttendanceRegularizeModal";

const AttendancePage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [isHolidayModalOpen, setHolidayModalOpen] = useState(false);
  const [rules, setRules] = useState(DEFAULT_ATTENDANCE_RULES);
  const [myRegRequests, setMyRegRequests] = useState([]);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regModalLog, setRegModalLog] = useState(null);
  const [regModalDateKey, setRegModalDateKey] = useState("");

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const [response, rulesRes] = await Promise.all([
        fetch("/api/empcrm/attendance/fetch"),
        fetch("/api/empcrm/attendance-rules"),
      ]);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Unknown error" }));
        throw new Error(
          errorData.message || "Failed to fetch attendance logs."
        );
      }

      const data = await response.json();
      setLogs(data.attendance);
      setHolidays(data.holidays || []);
      setLeaves(data.leaves || []);

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json().catch(() => ({}));
        if (rulesData.rules) setRules(rulesData.rules);
      }
    } catch (err) {
      toast.error(err.message);
      setLogs([]);
      setHolidays([]);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshRegularization = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/regularization?scope=mine");
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.success) setMyRegRequests(d.requests || []);
      }
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, []);

  useEffect(() => {
    if (!loading) refreshRegularization();
  }, [loading, refreshRegularization]);

  const logDateKeyForReg = (log) =>
    log?.date ? new Date(log.date).toLocaleDateString("en-CA") : "";

  const rowNeedsRegularization = (log) => {
    if (log.type !== "present") return false;
    const checkinOk = getCheckinStatus(log.checkin_time) === "onTime";
    const checkoutOk = getCheckoutStatus(log.checkout_time) === "onTime";
    return !checkinOk || !checkoutOk;
  };

  const pendingRegByDate = useMemo(() => {
    const m = new Map();
    for (const r of myRegRequests) {
      if (r.status !== "pending") continue;
      let k = r.log_date;
      if (k == null) continue;
      if (typeof k === "string") k = k.slice(0, 10);
      else if (k instanceof Date) k = k.toISOString().slice(0, 10);
      else k = String(k).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) m.set(k, r);
    }
    return m;
  }, [myRegRequests]);

  const openRegularizeModal = (log) => {
    setRegModalLog(log);
    setRegModalDateKey(logDateKeyForReg(log));
    setRegModalOpen(true);
  };

  const openHolidayModal = async () => {
    try {
      const res = await fetch("/api/holidays");
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || "Failed to load holidays");
      }
      const data = await res.json();
      setHolidays(data.holidays || []);
      setHolidayModalOpen(true);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const getCheckinStatus = (logTime) => checkinStatusFromRules(logTime, rules);

  const getCheckoutStatus = (logTime) => checkoutStatusFromRules(logTime, rules);

  const getBreakStatus = (startTime, endTime, breakType) =>
    breakStatusFromRules(startTime, endTime, breakType, rules);

  const isHalfDay = (log) => isHalfDayByRules(log, rules);

  const handleShowAll = () => {
    setFilterStatus("all");
    setFromDate("");
    setToDate("");
  };

  // Generate a list of all dates from the first log to the current date (or date range if specified)
  const allDates = [];

  // Determine end date: use toDate if specified, otherwise use today
  const endDate = toDate ? new Date(toDate) : new Date();
  endDate.setHours(0, 0, 0, 0);

  // Determine start date: use fromDate if specified, otherwise use earliest log or 30 days ago
  let startDate;
  if (fromDate) {
    startDate = new Date(fromDate);
  } else if (logs.length > 0) {
    startDate = new Date(logs[logs.length - 1].date);
  } else {
    startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
  }
  startDate.setHours(0, 0, 0, 0);

  const dateMap = new Map(
    logs.map((log) => [new Date(log.date).toLocaleDateString("en-CA"), log])
  );

  // Create a map of holiday dates for quick lookup
  const holidayMap = new Map(
    holidays.map((h) => [new Date(h.holiday_date).toLocaleDateString("en-CA"), h])
  );

  // Create a map of leave dates for quick lookup
  const leaveMap = new Map();
  leaves.forEach((leave) => {
    const fromDate = new Date(leave.from_date);
    const toDate = new Date(leave.to_date);
    // Add all dates in the leave range
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      leaveMap.set(d.toLocaleDateString("en-CA"), leave);
    }
  });

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateString = d.toLocaleDateString("en-CA");
    const existingLog = dateMap.get(dateString);
    const isWeekend = d.getDay() === 0; // Sunday
    const isHoliday = holidayMap.has(dateString);
    const isOnLeave = leaveMap.has(dateString);

    if (existingLog) {
      allDates.push({ ...existingLog, type: "present" });
    } else {
      if (isWeekend) {
        // Sunday - separate from holidays
        allDates.push({
          date: d.toISOString(),
          type: "sunday",
          holidayTitle: "Sunday",
          holidayDescription: null
        });
      } else if (isHoliday) {
        // Official holiday
        const holidayInfo = holidayMap.get(dateString);
        allDates.push({
          date: d.toISOString(),
          type: "holiday",
          holidayTitle: holidayInfo?.title || "Holiday",
          holidayDescription: holidayInfo?.description || null
        });
      } else if (isOnLeave) {
        const leaveInfo = leaveMap.get(dateString);
        allDates.push({
          date: d.toISOString(),
          type: "leave",
          leaveType: leaveInfo?.leave_type || "Leave",
          leaveReason: leaveInfo?.reason || null
        });
      } else {
        allDates.push({ date: d.toISOString(), type: "absent" });
      }
    }
  }
  allDates.reverse();

  // Calculate summary statistics
  const summary = allDates.reduce(
    (acc, log) => {
      if (log.type === "absent") acc.absents++;
      if (log.type === "leave") acc.leaves++;
      if (log.type === "holiday") acc.holidays++;
      if (log.type === "sunday") acc.sundays++;
      if (log.type === "present") {
        acc.present++;
        if (isHalfDay(log)) acc.halfDays++;
        if (isLateDaySummary(log, rules)) {
          acc.lateDays++;
        }
      }
      return acc;
    },
    { present: 0, absents: 0, leaves: 0, holidays: 0, sundays: 0, halfDays: 0, lateDays: 0 }
  );

  // Filter the complete list of dates based on user selection
  const filteredLogs = allDates.filter((log) => {
    // Date range filter is already applied in date generation

    if (filterStatus === "all") {
      return true;
    } else if (filterStatus === "late") {
      // Show only RED late status (09:46-09:59 or 18:14), NOT grace period or half day
      const checkinStatus = getCheckinStatus(log.checkin_time);
      const checkoutStatus = getCheckoutStatus(log.checkout_time);
      return (
        log.type === "present" &&
        (checkinStatus === 'late' || checkoutStatus === 'late')
      );
    } else if (filterStatus === "onTime") {
      // Show green on time AND orange grace period (NOT red late or yellow half day)
      const checkinStatus = getCheckinStatus(log.checkin_time);
      const checkoutStatus = getCheckoutStatus(log.checkout_time);
      return (
        log.type === "present" &&
        checkinStatus !== 'late' &&
        checkinStatus !== 'halfDay' &&
        checkoutStatus !== 'late' &&
        checkoutStatus !== 'halfDay'
      );
    } else if (filterStatus === "halfDay") {
      return log.type === "present" && isHalfDay(log);
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600 text-lg">Loading attendance data...</p>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 text-center flex-1">
            Attendance details
          </h1>
          <button
            onClick={() => setFilterStatus("regularize")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-md shrink-0"
          >
            Regularize Attendance
          </button>
        </div>

        {/* Summary Statistics Section */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-8 text-center">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
            <p className="text-sm text-gray-500">Present</p>
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
            <p className="text-2xl font-bold text-purple-600">
              {summary.sundays}
            </p>
            <p className="text-sm text-gray-500">Sundays</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-2xl font-bold text-indigo-600">
              {summary.holidays}
            </p>
            <p className="text-sm text-gray-500">Holidays</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-2xl font-bold text-yellow-500">
              {summary.halfDays}
            </p>
            <p className="text-sm text-gray-500">Half-Days</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-2xl font-bold text-red-600">{summary.lateDays}</p>
            <p className="text-sm text-gray-500">Late Days</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-red-500 mr-2"></span>
              <p className="text-sm text-gray-700">Late</p>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-yellow-400 mr-2"></span>
              <p className="text-sm text-gray-700">Half Day</p>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-green-500 mr-2"></span>
              <p className="text-sm text-gray-700">On Time / Early</p>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-orange-300 mr-2"></span>
              <p className="text-sm text-gray-700">Absent</p>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-blue-300 mr-2"></span>
              <p className="text-sm text-gray-700">Leave</p>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-purple-300 mr-2"></span>
              <p className="text-sm text-gray-700">Sunday</p>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-indigo-300 mr-2"></span>
              <p className="text-sm text-gray-700">Holiday</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleShowAll}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors duration-200 ${filterStatus === "all" && !fromDate && !toDate
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              Show All
            </button>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="From Date"
              className="px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="To Date"
              className="px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setFilterStatus("late")}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors duration-200 ${filterStatus === "late"
                ? "bg-red-500 text-white shadow-md"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              Show Late
            </button>
            <button
              onClick={() => setFilterStatus("halfDay")}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors duration-200 ${filterStatus === "halfDay"
                ? "bg-yellow-400 text-white shadow-md"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              Show Half Day
            </button>
            <button
              onClick={() => setFilterStatus("onTime")}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors duration-200 ${filterStatus === "onTime"
                ? "bg-green-500 text-white shadow-md"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              Show On Time
            </button>
            <button
              onClick={() => setFilterStatus("regularize")}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors duration-200 ${filterStatus === "regularize"
                ? "bg-teal-600 text-white shadow-md"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              Regularize attendance
            </button>
            <button
              onClick={openHolidayModal}
              className="px-4 py-2 rounded-md font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Holiday List
            </button>
          </div>
        </div>

        {/* Card View for Mobile (md and below) */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`rounded-lg shadow-md p-4 space-y-2 ${log.type === "absent"
                  ? "bg-orange-50"
                  : log.type === "leave"
                    ? "bg-blue-50"
                    : log.type === "sunday"
                      ? "bg-purple-50"
                      : log.type === "holiday"
                        ? "bg-indigo-50"
                        : "bg-white"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Date:
                  </span>
                  <span className="text-sm text-gray-700">
                    {new Date(log.date).toLocaleDateString()}
                  </span>
                </div>
                {log.type === "present" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Check-in:
                      </span>
                      <span
                        className={`text-sm ${(() => {
                          const status = getCheckinStatus(log.checkin_time);
                          if (status === 'halfDay') return 'text-yellow-600';
                          if (status === 'late') return 'text-red-600';
                          if (status === 'onTime') return 'text-green-600';
                          if (status === 'grace') return 'text-yellow-600';
                          return 'text-green-600';
                        })()
                          }`}
                      >
                        {formatTime(log.checkin_time)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Morning Break:
                      </span>
                      <span className="text-sm text-gray-700">
                        {formatTime(log.break_morning_start)}{" "}
                        {formatTime(log.break_morning_end) &&
                          `- ${formatTime(log.break_morning_end)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Lunch Break:
                      </span>
                      <span className="text-sm text-gray-700">
                        {formatTime(log.break_lunch_start)}{" "}
                        {formatTime(log.break_lunch_end) &&
                          `- ${formatTime(log.break_lunch_end)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Evening Break:
                      </span>
                      <span className="text-sm text-gray-700">
                        {formatTime(log.break_evening_start)}{" "}
                        {formatTime(log.break_evening_end) &&
                          `- ${formatTime(log.break_evening_end)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Check-out:
                      </span>
                      <span
                        className={`text-sm ${(() => {
                          const status = getCheckoutStatus(log.checkout_time);
                          if (status === 'halfDay') return 'text-yellow-600';
                          if (status === 'late') return 'text-red-600';
                          if (status === 'grace') return 'text-orange-600';
                          return 'text-green-600';
                        })()
                          }`}
                      >
                        {formatTime(log.checkout_time)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-lg font-bold">
                      {log.type === "absent" ? "Absent" : log.type === "leave" ? "Leave" : log.type === "sunday" ? "Sunday" : "Holiday"}
                    </p>
                    {log.leaveType && (
                      <p className="text-sm text-gray-600 mt-1 capitalize">{log.leaveType} Leave</p>
                    )}
                    {log.leaveReason && (
                      <p className="text-xs text-gray-500 mt-1">{log.leaveReason}</p>
                    )}
                    {log.holidayTitle && log.holidayTitle !== "Weekend" && log.holidayTitle !== "Sunday" && (
                      <p className="text-sm text-gray-600 mt-1">{log.holidayTitle}</p>
                    )}
                    {log.holidayDescription && (
                      <p className="text-xs text-gray-500 mt-1">{log.holidayDescription}</p>
                    )}
                    {log.type === "absent" && (
                      <div className="mt-3">
                        {pendingRegByDate.get(logDateKeyForReg(log)) ? (
                          <span className="text-amber-700 font-medium text-sm">
                            Pending approval
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openRegularizeModal(log)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                          >
                            Regularize
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">
              No attendance logs found for the selected filter.
            </div>
          )}
        </div>

        {/* Table View for Desktop (md and up) */}
        <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Morning Break
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lunch Break
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Evening Break
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-out
                </th>
                {filterStatus === "regularize" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(log.date).toLocaleDateString()}
                    </td>
                    {log.type === "present" ? (
                      <>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${(() => {
                            const status = getCheckinStatus(log.checkin_time);
                            if (status === 'halfDay') return 'bg-yellow-100';
                            if (status === 'late') return 'bg-red-100';
                            if (status === 'onTime') return 'bg-green-100';
                            if (status === 'grace') return 'bg-yellow-100';
                            return '';
                          })()
                            }`}
                        >
                          {formatTime(log.checkin_time)}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${(() => {
                            const status = getBreakStatus(log.break_morning_start, log.break_morning_end, 'morning');
                            return status === 'green' ? 'bg-green-100' : status === 'yellow' ? 'bg-yellow-100' : status === 'red' ? 'bg-red-100' : '';
                          })()
                            }`}
                        >
                          {formatTime(log.break_morning_start)}
                          {formatTime(log.break_morning_end) &&
                            `- ${formatTime(log.break_morning_end)}`}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${(() => {
                            const status = getBreakStatus(log.break_lunch_start, log.break_lunch_end, 'lunch');
                            return status === 'green' ? 'bg-green-100' : status === 'yellow' ? 'bg-yellow-100' : status === 'red' ? 'bg-red-100' : '';
                          })()
                            }`}
                        >
                          {formatTime(log.break_lunch_start)}
                          {formatTime(log.break_lunch_end) &&
                            `- ${formatTime(log.break_lunch_end)}`}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${(() => {
                            const status = getBreakStatus(log.break_evening_start, log.break_evening_end, 'evening');
                            return status === 'green' ? 'bg-green-100' : status === 'yellow' ? 'bg-yellow-100' : status === 'red' ? 'bg-red-100' : '';
                          })()
                            }`}
                        >
                          {formatTime(log.break_evening_start)}
                          {formatTime(log.break_evening_end) &&
                            `- ${formatTime(log.break_evening_end)}`}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${(() => {
                            const status = getCheckoutStatus(log.checkout_time);
                            if (status === 'halfDay') return 'bg-yellow-100';
                            if (status === 'late') return 'bg-red-100';
                            if (status === 'grace') return 'bg-orange-100';
                            if (status === 'onTime') return 'bg-green-100';
                            return '';
                          })()
                            }`}
                        >
                          {formatTime(log.checkout_time)}
                        </td>
                        {filterStatus === "regularize" && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {rowNeedsRegularization(log) ? (
                              pendingRegByDate.get(logDateKeyForReg(log)) ? (
                                <span className="text-amber-700 font-medium">Pending</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openRegularizeModal(log)}
                                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                                >
                                  Regularize
                                </button>
                              )
                            ) : null}
                          </td>
                        )}
                      </>
                    ) : (
                      <td
                        colSpan={filterStatus === "regularize" ? 6 : 5}
                        className={`px-6 py-4 text-center ${log.type === "absent"
                          ? "bg-orange-50 text-orange-700"
                          : log.type === "leave"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-green-50 text-green-700"
                          }`}
                      >
                        <p className="font-bold text-lg">
                          {log.type === "absent" ? "Absent" : log.type === "leave" ? "Leave" : log.type === "sunday" ? "Sunday" : "Holiday"}
                        </p>
                        {log.leaveType && (
                          <p className="text-sm mt-1 capitalize">{log.leaveType} Leave</p>
                        )}
                        {log.leaveReason && (
                          <p className="text-xs text-gray-500 mt-1">{log.leaveReason}</p>
                        )}
                        {log.holidayTitle && log.holidayTitle !== "Weekend" && log.holidayTitle !== "Sunday" && (
                          <p className="text-sm mt-1">{log.holidayTitle}</p>
                        )}
                        {log.holidayDescription && (
                          <p className="text-xs text-gray-500 mt-1">{log.holidayDescription}</p>
                        )}
                        {log.type === "absent" && (
                          <div className="mt-3 flex justify-center">
                            {pendingRegByDate.get(logDateKeyForReg(log)) ? (
                              <span className="text-amber-700 font-medium text-sm">
                                Pending approval
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openRegularizeModal(log)}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                              >
                                Regularize
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={filterStatus === "regularize" ? 7 : 6} className="px-6 py-4 text-center text-gray-500">
                    No attendance logs found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AttendanceRegularizeModal
        open={regModalOpen}
        log={regModalLog}
        logDateKey={regModalDateKey}
        onClose={() => {
          setRegModalOpen(false);
          setRegModalLog(null);
          setRegModalDateKey("");
        }}
        onSubmitted={() => {
          refreshRegularization();
        }}
      />

      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Holidays</h3>
              <button
                onClick={() => setHolidayModalOpen(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>
            {holidays.length === 0 ? (
              <p className="text-gray-500">No holidays found.</p>
            ) : (
              <ul className="divide-y max-h-80 overflow-y-auto">
                {holidays.map((h) => (
                  <li key={h.id} className="py-2">
                    <p className="font-medium">{h.title}</p>
                    <p className="text-sm text-gray-600">{new Date(h.holiday_date).toLocaleDateString()} {h.is_optional ? "(Optional)" : ""}</p>
                    {h.description ? (
                      <p className="text-sm text-gray-500">{h.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AttendancePage;
