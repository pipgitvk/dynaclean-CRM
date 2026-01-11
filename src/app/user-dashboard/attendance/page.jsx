// app/user-dashboard/attendance/page.jsx
"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

const attendanceRules = {
  checkin: "09:30:00",
  checkout: "18:30:00",
  halfDayCheckin: "10:00:00",        // Half-day after 10:00
  lateCheckin: "09:46:00",           // Late window starts at 09:46
  halfDayCheckout: "18:14:00",
  break_morning_start: "11:15:00",
  break_lunch_start: "13:30:00",
  break_evening_start: "16:15:00",
  gracePeriodMinutes: 15, // 15-min grace for check-in/out
  breakDurations: {
    morning: 15, // Morning break: 15 minutes
    lunch: 30,   // Lunch break: 30 minutes  
    evening: 15, // Evening break: 15 minutes
  },
  breakGracePeriodMinutes: 5, // 5-min grace for breaks
};

const AttendancePage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [isHolidayModalOpen, setHolidayModalOpen] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/attendance/fetch");

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
    } catch (err) {
      toast.error(err.message);
      setLogs([]);
      setHolidays([]);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

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

  const formatTime = (timeString) => {
    if (!timeString) return "";
    const date = new Date(timeString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get check-in status: 'onTime', 'grace', 'late', or 'halfDay'
  const getCheckinStatus = (logTime) => {
    if (!logTime) return null;
    const logDate = new Date(logTime);
    const logTimeInMinutes = logDate.getHours() * 60 + logDate.getMinutes();

    const standardMinutes = 9 * 60 + 30;  // 09:30
    const graceEndMinutes = 9 * 60 + 45;  // 09:45 (09:30 + 15)
    const lateEndMinutes = 9 * 60 + 46;   // 09:46
    const halfDayMinutes = 10 * 60;       // 10:00

    if (logTimeInMinutes <= standardMinutes) return 'onTime';           // 🟢 ≤ 09:30
    if (logTimeInMinutes <= graceEndMinutes) return 'grace';            // 🟠 09:31-09:45
    if (logTimeInMinutes < halfDayMinutes) return 'late';               // 🔴 09:46-09:59
    return 'halfDay';                                                   // 🟡 ≥ 10:00
  };

  // Check if check-in is late (after grace period) - for backward compatibility
  const isCheckinLate = (logTime) => {
    const status = getCheckinStatus(logTime);
    return status === 'late' || status === 'halfDay';
  };

  // Get checkout status: 'onTime', 'grace', 'late', or 'halfDay'
  const getCheckoutStatus = (logTime) => {
    if (!logTime) return null;
    const logDate = new Date(logTime);
    const logTimeInMinutes = logDate.getHours() * 60 + logDate.getMinutes();

    const standardMinutes = 18 * 60 + 30;  // 18:30
    const graceStartMinutes = 18 * 60 + 15; // 18:15 (18:30 - 15)
    const halfDayMinutes = 18 * 60 + 14;   // 18:14

    if (logTimeInMinutes < halfDayMinutes) return 'halfDay';            // 🟡 < 18:14
    if (logTimeInMinutes < graceStartMinutes) return 'late';            // 🔴 18:14
    if (logTimeInMinutes < standardMinutes) return 'grace';             // 🟠 18:15-18:29
    return 'onTime';                                                    // 🟢 ≥ 18:30
  };

  // Check if checkout is early (before grace period) - for backward compatibility
  const isCheckoutEarly = (logTime) => {
    const status = getCheckoutStatus(logTime);
    return status === 'late' || status === 'halfDay';
  };

  // Calculate break duration color: green (within time), yellow (grace period), red (late)
  const getBreakStatus = (startTime, endTime, breakType) => {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.floor((end - start) / (1000 * 60));
    const allowedDuration = attendanceRules.breakDurations[breakType];
    const graceLimit = allowedDuration + attendanceRules.breakGracePeriodMinutes;

    if (durationMinutes <= allowedDuration) return 'green';
    if (durationMinutes <= graceLimit) return 'yellow';
    return 'red';
  };

  const isLate = (logTime, ruleTime) => {
    if (!logTime || !ruleTime) return false;
    const logDate = new Date(logTime);
    const [ruleHour, ruleMinute] = ruleTime.split(":").map(Number);
    const logTimeInMinutes = logDate.getHours() * 60 + logDate.getMinutes();
    const ruleTimeInMinutes = ruleHour * 60 + ruleMinute;
    return logTimeInMinutes > ruleTimeInMinutes;
  };

  const isEarly = (logTime, ruleTime) => {
    if (!logTime || !ruleTime) return false;
    const logDate = new Date(logTime);
    const [ruleHour, ruleMinute] = ruleTime.split(":").map(Number);
    const logTimeInMinutes = logDate.getHours() * 60 + logDate.getMinutes();
    const ruleTimeInMinutes = ruleHour * 60 + ruleMinute;
    return logTimeInMinutes < ruleTimeInMinutes;
  };

  const isHalfDay = (log) => {
    if (!log.checkin_time || !log.checkout_time) return false;
    return (
      isLate(log.checkin_time, attendanceRules.halfDayCheckin) ||
      isEarly(log.checkout_time, attendanceRules.halfDayCheckout)
    );
  };

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
    // Fallback: If no logs and no fromDate, show the last 30 days
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
        if (isCheckinLate(log.checkin_time) || isCheckoutEarly(log.checkout_time)) {
          acc.lateDays++;
        }
      }
      return acc;
    },
    { present: 0, absents: 0, leaves: 0, holidays: 0, sundays: 0, halfDays: 0, lateDays: 0 }
  );

  // Filter the complete list of dates based on user selection
  const filteredLogs = allDates.filter((log) => {
    // Date range filter is already applied in date generation, so no need to filter again
    // All dates in allDates are within the selected range

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
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          My Attendance Logs
        </h1>

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
                          if (status === 'grace') return 'text-orange-600';
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
                            if (status === 'grace') return 'bg-orange-100';
                            if (status === 'onTime') return 'bg-green-100';
                            return '';
                          })()
                            }`}
                        >
                          {formatTime(log.checkin_time)}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${getBreakStatus(log.break_morning_start, log.break_morning_end, 'morning') === 'green'
                            ? "bg-green-100"
                            : getBreakStatus(log.break_morning_start, log.break_morning_end, 'morning') === 'yellow'
                              ? "bg-yellow-100"
                              : getBreakStatus(log.break_morning_start, log.break_morning_end, 'morning') === 'red'
                                ? "bg-red-100"
                                : ""
                            }`}
                        >
                          {formatTime(log.break_morning_start)}
                          {formatTime(log.break_morning_end) &&
                            `- ${formatTime(log.break_morning_end)}`}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${getBreakStatus(log.break_lunch_start, log.break_lunch_end, 'lunch') === 'green'
                            ? "bg-green-100"
                            : getBreakStatus(log.break_lunch_start, log.break_lunch_end, 'lunch') === 'yellow'
                              ? "bg-yellow-100"
                              : getBreakStatus(log.break_lunch_start, log.break_lunch_end, 'lunch') === 'red'
                                ? "bg-red-100"
                                : ""
                            }`}
                        >
                          {formatTime(log.break_lunch_start)}
                          {formatTime(log.break_lunch_end) &&
                            `- ${formatTime(log.break_lunch_end)}`}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${getBreakStatus(log.break_evening_start, log.break_evening_end, 'evening') === 'green'
                            ? "bg-green-100"
                            : getBreakStatus(log.break_evening_start, log.break_evening_end, 'evening') === 'yellow'
                              ? "bg-yellow-100"
                              : getBreakStatus(log.break_evening_start, log.break_evening_end, 'evening') === 'red'
                                ? "bg-red-100"
                                : ""
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
                      </>
                    ) : (
                      <td
                        colSpan="5"
                        className={`px-6 py-4 text-center ${log.type === "absent"
                          ? "bg-orange-50 text-orange-700"
                          : log.type === "leave"
                            ? "bg-blue-50 text-blue-700"
                            : log.type === "sunday"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-indigo-50 text-indigo-700"
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
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No attendance logs found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
