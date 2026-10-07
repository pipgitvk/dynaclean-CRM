// app/empcrm/admin-dashboard/attendance/page.jsx
"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Loader2, Search, Info, Pencil, Sun, History } from "lucide-react";
import AttendanceEditHistoryPanel from "@/components/AttendanceEditHistoryPanel";
import { getBrowserGeolocation } from "@/lib/browserGeolocation";
import ExcelJS from "exceljs";
import {
  DEFAULT_ATTENDANCE_RULES,
  getCheckinStatus as checkinStatusFromRules,
  getCheckoutStatus as checkoutStatusFromRules,
  getBreakStatus as breakStatusFromRules,
  isHalfDayByRules,
  isLateDaySummary,
  isHalfDayWithGrace,
} from "@/lib/attendanceRulesEngine";
import { rowHasMeaningfulCheckinOrCheckout } from "@/lib/attendanceMeaningfulPunch";
import { weeklyOffSundayCountsAsPaid } from "@/lib/salaryPayDaysFromAttendance";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";
import AttendanceRegularizeModal from "@/app/user-dashboard/attendance/AttendanceRegularizeModal";
import AttendanceBulkImportPanel from "@/components/AttendanceBulkImportPanel";
import AttendanceAddressMapModal, {
  ViewAddressLink,
} from "@/components/AttendanceAddressMapModal";

function attendanceDateYmd(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA");
}

/** HH:mm for <input type="time"> from a DB datetime string. */
function timeInputFromDbValue(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return "";
  const h = String(parseInt(m[1], 10)).padStart(2, "0");
  const min = String(parseInt(m[2], 10)).padStart(2, "0");
  return `${h}:${min}`;
}

function combineDateAndTimeForDb(dateYmd, timeHHmm) {
  if (!dateYmd || !timeHHmm || String(timeHHmm).trim() === "") return null;
  const t = String(timeHHmm).trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":");
  const hh = String(parseInt(h, 10)).padStart(2, "0");
  const mm = String(parseInt(m, 10)).padStart(2, "0");
  return `${dateYmd} ${hh}:${mm}:00`;
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toYmd(first), to: toYmd(now) };
}

function formatLeaveSummaryDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toFixed(1);
}

function isPaidLeaveRow(log) {
  return (
    log.type === "paidleave" ||
    log.leaveType === "Paid" ||
    log.leave_type === "paid"
  );
}

function logShowsAttendancePunchDetails(log) {
  if (log.type === "present") return true;
  if (log.has_punch_on_leave == 1) return true;
  if (
    (log.type === "leave" ||
      log.type === "paidleave" ||
      log.type === "unpaidleave") &&
    rowHasMeaningfulCheckinOrCheckout(log)
  ) {
    return true;
  }
  return false;
}

function LeaveDayStatusBlock({ log, className = "" }) {
  if (
    !(
      log.type === "leave" ||
      log.type === "paidleave" ||
      log.type === "unpaidleave"
    )
  ) {
    return null;
  }
  const alignLeft = className.includes("text-left");
  return (
    <div className={`${alignLeft ? "text-left" : "text-center"} ${className}`}>
      <p
        className={`${alignLeft ? "text-base" : "text-lg"} font-bold ${log.is_half_day == 1 ? "text-orange-600" : ""}`}
      >
        {log.is_half_day == 1
          ? "Half Day"
          : log.type === "unpaidleave"
            ? "Unpaid Leave"
            : "Leave"}
      </p>
      {log.is_half_day == 1 && (
        <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
          <Sun className="w-3 h-3" />
          {log.half_day_type === "2nd_half" ? "2nd Half" : "1st Half"}
        </span>
      )}
      {log.leaveType && (
        <p
          className={`text-sm text-gray-600 capitalize ${log.is_half_day == 1 ? "mt-2" : "mt-1"}`}
        >
          {log.leaveType} Leave
        </p>
      )}
    </div>
  );
}

const AttendancePage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialRange = currentMonthRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  /** Set only after clicking Search; drives summary + table */
  const [appliedUserSelection, setAppliedUserSelection] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [uniqueUsers, setUniqueUsers] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [isHolidayModalOpen, setHolidayModalOpen] = useState(false);
  const [breakEditLog, setBreakEditLog] = useState(null);
  /** Snapshot when modal opens — detect check-in/out changes for GPS. */
  const [breakEditBaseline, setBreakEditBaseline] = useState(null);
  const [breakEditForm, setBreakEditForm] = useState({
    checkin_time: "",
    checkout_time: "",
    break_morning_start: "",
    break_morning_end: "",
    break_lunch_start: "",
    break_lunch_end: "",
    break_evening_start: "",
    break_evening_end: "",
  });
  const [breakEditSaving, setBreakEditSaving] = useState(false);
  const [rules, setRules] = useState(DEFAULT_ATTENDANCE_RULES);
  /** Merged company + per-employee rules from fetch-all (keyed by username) */
  const [rulesByUsername, setRulesByUsername] = useState({});
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regModalLog, setRegModalLog] = useState(null);
  const [regModalDateKey, setRegModalDateKey] = useState("");
  const [regForUsername, setRegForUsername] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalLog, setEditModalLog] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteModalLog, setDeleteModalLog] = useState(null);
  const [addressMapOpen, setAddressMapOpen] = useState(false);
  const [addressMapPayload, setAddressMapPayload] = useState(null);
  const [historyModalLog, setHistoryModalLog] = useState(null);
  const [editHistoryRefresh, setEditHistoryRefresh] = useState(0);

  const openAddressMap = (payload) => {
    setAddressMapPayload(payload);
    setAddressMapOpen(true);
  };

  const logDateKeyForReg = (log) =>
    log?.date ? new Date(log.date).toLocaleDateString("en-CA") : "";

  const openEditModal = (log) => {
    setEditModalLog({ ...log });
    setEditModalOpen(true);
  };

  const openDeleteDialog = (log) => {
    setDeleteModalLog(log);
    setDeleteDialogOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const dateKey = new Date(editModalLog.date).toLocaleDateString("en-CA");
      const response = await fetch("/api/empcrm/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editModalLog, date: dateKey }),
      });

      if (!response.ok) {
        throw new Error("Failed to update log");
      }

      toast.success("Attendance log updated successfully!");
      setEditHistoryRefresh((n) => n + 1);
      setEditModalOpen(false);
      setEditModalLog(null);
      fetchAttendance();
    } catch (error) {
      toast.error(error.message || "Failed to update attendance log");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const dateKey = new Date(deleteModalLog.date).toLocaleDateString("en-CA");
      const response = await fetch(`/api/empcrm/attendance?username=${deleteModalLog.username}&date=${dateKey}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete log");
      }

      toast.success("Attendance log deleted successfully!");
      setDeleteDialogOpen(false);
      setDeleteModalLog(null);
      fetchAttendance();
    } catch (error) {
      toast.error(error.message || "Failed to delete attendance log");
    }
  };

  const openAbsentRegularizeModal = (log) => {
    setRegModalLog({ ...log, type: "absent" });
    setRegModalDateKey(logDateKeyForReg(log));
    setRegForUsername(log.username || "");
    setRegModalOpen(true);
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/empcrm/attendance/fetch-all");

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
      setRulesByUsername(data.rulesByUsername || {});

      const users = [
        ...new Set(data.attendance.map((log) => log.username)),
      ].sort();
      setUniqueUsers(["all", ...users]);
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

  const getCheckinStatus = (logTime, username) =>
    checkinStatusFromRules(logTime, rulesFor(username));

  const getCheckoutStatus = (logTime, username) =>
    checkoutStatusFromRules(logTime, rulesFor(username));

  const isCheckinLate = (logTime) => {
    const status = getCheckinStatus(logTime);
    return status === "late" || status === "halfDay";
  };

  const isCheckoutEarly = (logTime) => {
    const status = getCheckoutStatus(logTime);
    return status === "late" || status === "halfDay";
  };

  const getBreakStatus = (startTime, endTime, breakType, username) =>
    breakStatusFromRules(startTime, endTime, breakType, rulesFor(username));

  const isHalfDay = (log) => isHalfDayByRules(log, rulesFor(log.username));

  const handleShowAll = () => {
    setFilterStatus("all");
    const { from, to } = currentMonthRange();
    setFromDate(from);
    setToDate(to);
  };

  const handleSearch = () => {
    setSearchLoading(true);
    setAppliedUserSelection(null);
    setTimeout(() => {
      setAppliedUserSelection(selectedUser);
      setSearchLoading(false);
    }, 120);
  };

  const openAttendanceHistoryModal = (log) => {
    setHistoryModalLog(log);
  };

  const openBreakEditModal = (log) => {
    setBreakEditLog(log);
    const form = {
      checkin_time: timeInputFromDbValue(log.checkin_time),
      checkout_time: timeInputFromDbValue(log.checkout_time),
      break_morning_start: timeInputFromDbValue(log.break_morning_start),
      break_morning_end: timeInputFromDbValue(log.break_morning_end),
      break_lunch_start: timeInputFromDbValue(log.break_lunch_start),
      break_lunch_end: timeInputFromDbValue(log.break_lunch_end),
      break_evening_start: timeInputFromDbValue(log.break_evening_start),
      break_evening_end: timeInputFromDbValue(log.break_evening_end),
    };
    setBreakEditForm(form);
    setBreakEditBaseline(form);
  };

  const closeBreakEditModal = () => {
    setBreakEditLog(null);
    setBreakEditBaseline(null);
    setBreakEditSaving(false);
  };

  const saveBreakEdits = async () => {
    if (!breakEditLog) return;
    const dateYmd = attendanceDateYmd(breakEditLog.date);
    if (!dateYmd || !breakEditLog.username) {
      toast.error("Invalid row.");
      return;
    }
    setBreakEditSaving(true);
    try {
      const baseline = breakEditBaseline || breakEditForm;
      const checkinChanged =
        breakEditForm.checkin_time !== baseline.checkin_time;
      const checkoutChanged =
        breakEditForm.checkout_time !== baseline.checkout_time;
      const needsCheckinGps =
        Boolean(breakEditForm.checkin_time) && checkinChanged;
      const needsCheckoutGps =
        checkoutChanged && Boolean(breakEditForm.checkout_time);

      const payload = {
        username: breakEditLog.username,
        date: dateYmd,
        checkin_time: combineDateAndTimeForDb(
          dateYmd,
          breakEditForm.checkin_time
        ),
        checkout_time: combineDateAndTimeForDb(
          dateYmd,
          breakEditForm.checkout_time
        ),
        break_morning_start: combineDateAndTimeForDb(
          dateYmd,
          breakEditForm.break_morning_start
        ),
        break_morning_end: combineDateAndTimeForDb(
          dateYmd,
          breakEditForm.break_morning_end
        ),
        break_lunch_start: combineDateAndTimeForDb(
          dateYmd,
          breakEditForm.break_lunch_start
        ),
        break_lunch_end: combineDateAndTimeForDb(
          dateYmd,
          breakEditForm.break_lunch_end
        ),
        break_evening_start: combineDateAndTimeForDb(
          dateYmd,
          breakEditForm.break_evening_start
        ),
        break_evening_end: combineDateAndTimeForDb(
          dateYmd,
          breakEditForm.break_evening_end
        ),
      };

      if (needsCheckinGps || needsCheckoutGps) {
        try {
          const { latitude, longitude } = await getBrowserGeolocation();
          if (needsCheckinGps) {
            payload.checkin_latitude = latitude;
            payload.checkin_longitude = longitude;
          }
          if (needsCheckoutGps) {
            payload.checkout_latitude = latitude;
            payload.checkout_longitude = longitude;
          }
        } catch (locErr) {
          throw new Error(
            locErr.message ||
              "Allow location access to set check-in or check-out times."
          );
        }
      }

      const res = await fetch("/api/empcrm/attendance/admin-edit-breaks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to save");
      }
      toast.success("Attendance times updated.");
      setEditHistoryRefresh((n) => n + 1);
      await fetchAttendance();
      closeBreakEditModal();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBreakEditSaving(false);
    }
  };

  const generateAttendanceTimeline = (userLogs, user) => {
    const allDates = [];

    // Helper: derive half_day_type from start_time / end_time using standard lunch break (13:00).
    const deriveHalfDayType = (startTime, endTime) => {
      const toMin = (t) => {
        if (!t) return null;
        const s = String(t).trim();
        const m = s.match(/^(\d{1,2}):(\d{2})/);
        if (!m) return null;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      };
      const LUNCH_MIN = 13 * 60; // 13:00 = standard lunch reference
      const startMin = toMin(startTime);
      const endMin = toMin(endTime);
      if (startMin !== null) return startMin >= LUNCH_MIN ? "2nd_half" : "1st_half";
      if (endMin !== null) return endMin <= LUNCH_MIN ? "1st_half" : "2nd_half";
      return null;
    };

    // Determine end date: use toDate if specified, otherwise use today
    const endDate = toDate ? new Date(toDate) : new Date();
    endDate.setHours(0, 0, 0, 0);

    // Determine start date: use fromDate if specified, otherwise use earliest log or 30 days ago
    let startDate;
    if (fromDate) {
      startDate = new Date(fromDate);
    } else if (userLogs.length > 0) {
      startDate = new Date(userLogs[userLogs.length - 1].date);
    } else {
      startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);
    }
    startDate.setHours(0, 0, 0, 0);

    const dateMap = new Map(
      userLogs.map((log) => [
        new Date(log.date).toLocaleDateString("en-CA"),
        log,
      ])
    );

    // Create a map of holiday dates for quick lookup
    const holidayMap = new Map(
      holidays.map((h) => [new Date(h.holiday_date).toLocaleDateString("en-CA"), h])
    );

    // Create a map of leave dates for the specific user
    const leaveMap = new Map();
    leaves.filter(leave => leave.username === user).forEach((leave) => {
      const fromDate = new Date(leave.from_date);
      const toDate = new Date(leave.to_date);
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        leaveMap.set(d.toLocaleDateString("en-CA"), leave);
      }
    });

    // Create a separate map of APPROVED half-day leaves (attendance-page only display)
    // Key: "yyyy-mm-dd" | Value: { is_half_day, half_day_type, leave_type, reason }
    const halfDayLeaveMap = new Map();
    leaves
      .filter(leave => leave.username === user && (leave.is_half_day == 1 || leave.leave_type === 'half-day'))
      .forEach((leave) => {
        const fromDate = new Date(leave.from_date);
        const toDate = new Date(leave.to_date);
        const derived = deriveHalfDayType(leave.start_time, leave.end_time);
        for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
          halfDayLeaveMap.set(d.toLocaleDateString("en-CA"), {
            is_half_day: leave.is_half_day,
            half_day_type: leave.half_day_type || derived,
            leave_type: leave.leave_type,
            reason: leave.reason,
          });
        }
      });

    // Create a map of paid leaves (both full-day and half-day) — used to override timing display
    const paidLeaveMap = new Map();
    leaves
      .filter(leave => leave.username === user && leave.leave_type === 'paid')
      .forEach((leave) => {
        const fromD = new Date(leave.from_date);
        const toD = new Date(leave.to_date);
        for (let d = new Date(fromD); d <= toD; d.setDate(d.getDate() + 1)) {
          paidLeaveMap.set(d.toLocaleDateString("en-CA"), leave);
        }
      });

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateString = d.toLocaleDateString("en-CA");
      const existingLog = dateMap.get(dateString);
      const isWeekend = d.getDay() === 0;
      const isHoliday = holidayMap.has(dateString);
      const isOnLeave = leaveMap.has(dateString);
      const approvedHalfDay = halfDayLeaveMap.get(dateString) || null;
      const approvedPaidLeave = paidLeaveMap.get(dateString) || null;

      const hasRealPunch =
        existingLog && rowHasMeaningfulCheckinOrCheckout(existingLog);

      // If paid leave exists for this date — display logic:
      //   If attendance punch logs exist → Half-Day Leave (worked half-day + leave half).
      //   No punches → Full leave as usual.
      if (approvedPaidLeave) {
        const leaveIsHalfDay = approvedPaidLeave.is_half_day == 1 || approvedPaidLeave.leave_type === 'half-day';
        const treatAsHalfDay = hasRealPunch || leaveIsHalfDay;
        const derivedType = deriveHalfDayType(approvedPaidLeave.start_time, approvedPaidLeave.end_time);
        const finalHalfType = approvedPaidLeave.half_day_type || derivedType || (hasRealPunch ? "1st_half" : "1st_half");
        allDates.push({
          ...(existingLog ? { ...existingLog } : {}),
          username: existingLog?.username || user,
          date: d.toISOString(),
          type: "paidleave",
          leaveType: "Paid",
          leaveReason: approvedPaidLeave.reason || null,
          is_half_day: treatAsHalfDay ? 1 : 0,
          half_day_type: treatAsHalfDay ? finalHalfType : null,
          has_punch_on_leave: hasRealPunch ? 1 : 0,
        });
      } else if (hasRealPunch) {
        allDates.push({ ...existingLog, type: "present", workedSunday: isWeekend, approvedHalfDay });
      } else {
        const base = existingLog
          ? { ...existingLog, username: existingLog.username || user }
          : { username: user };
        if (isOnLeave) {
          const leaveInfo = leaveMap.get(dateString);
          const isUnpaid = leaveInfo?.leave_type === "unpaid";
          const leaveIsHalfDay = leaveInfo?.is_half_day == 1 || leaveInfo?.leave_type === 'half-day';
          const derivedType = deriveHalfDayType(leaveInfo?.start_time, leaveInfo?.end_time);
          const finalHalfType = leaveInfo?.half_day_type || derivedType;
          allDates.push({
            ...base,
            date: d.toISOString(),
            type: isUnpaid ? "unpaidleave" : "leave",
            leaveType: leaveInfo?.leave_type || "Leave",
            leaveReason: leaveInfo?.reason || null,
            is_half_day: leaveIsHalfDay ? 1 : 0,
            half_day_type: leaveIsHalfDay ? finalHalfType : null,
            has_punch_on_leave: 0,
          });
        } else if (isHoliday) {
          const holidayInfo = holidayMap.get(dateString);
          allDates.push({
            ...base,
            date: d.toISOString(),
            type: "holiday",
            holidayTitle: holidayInfo?.title || "Holiday",
            holidayDescription: holidayInfo?.description || null,
          });
        } else if (isWeekend) {
          const paidWeeklyOff = weeklyOffSundayCountsAsPaid(dateString, {
            holidayMap,
            dateMap,
          });
          if (paidWeeklyOff) {
            allDates.push({
              ...base,
              date: d.toISOString(),
              type: "sunday",
              holidayTitle: "Sunday",
              holidayDescription: null,
            });
          } else {
            allDates.push({
              ...base,
              date: d.toISOString(),
              type: "absent",
            });
          }
        } else {
          allDates.push({
            ...base,
            date: d.toISOString(),
            type: "absent",
          });
        }
      }
    }
    return allDates;
  };

  // Generate the full attendance timeline based on the last Search (applied selection)
  let fullTimeline = [];
  if (appliedUserSelection == null) {
    fullTimeline = [];
  } else if (appliedUserSelection === "all") {
    const allUsersAttendance = uniqueUsers
      .filter((user) => user !== "all")
      .flatMap((user) => {
        const userLogs = logs.filter((log) => log.username === user);
        return generateAttendanceTimeline(userLogs, user);
      });
    fullTimeline = allUsersAttendance.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  } else {
    const userLogs = logs.filter((log) => log.username === appliedUserSelection);
    fullTimeline = generateAttendanceTimeline(userLogs, appliedUserSelection).reverse();
  }

  const timelineLogKey = (log) =>
    `${log.username}|${toYmd(new Date(log.date))}`;

  const inSelectedDateRange = (log) => {
    const logYmd = toYmd(new Date(log.date));
    if (fromDate && logYmd < fromDate) return false;
    if (toDate && logYmd > toDate) return false;
    return true;
  };

  const dateRangedTimeline = fullTimeline.filter(inSelectedDateRange);

  const { summary, halfDayKeys } = (() => {
    const sorted = [...dateRangedTimeline].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    const halfDayKeys = new Set();
    const acc = {
      present: 0,
      absents: 0,
      leaves: 0,
      holidays: 0,
      sundays: 0,
      halfDays: 0,
      lateDays: 0,
    };
    const graceCounters = {};

    for (const log of sorted) {
      if (log.type === "absent") acc.absents++;
      if (
        log.type === "leave" ||
        log.type === "paidleave" ||
        log.type === "unpaidleave"
      ) {
        if (log.is_half_day == 1) {
          if (isPaidLeaveRow(log)) {
            acc.leaves += 0.5;
            acc.present += 0.5;
            if (
              logShowsAttendancePunchDetails(log) &&
              isLateDaySummary(log, rulesFor(log.username))
            ) {
              acc.lateDays++;
            }
          } else {
            acc.halfDays++;
            halfDayKeys.add(timelineLogKey(log));
          }
        } else {
          acc.leaves += 1;
        }
      }
      if (log.type === "holiday") acc.holidays++;
      if (log.type === "sunday") acc.sundays++;
      if (log.type === "present") {
        acc.present++;
        const username = log.username;
        if (!graceCounters[username]) {
          graceCounters[username] = 0;
        }
        const { isHalfDay: halfDayFlag, graceUsed } = isHalfDayWithGrace(
          log,
          rulesFor(username),
          graceCounters[username],
        );
        graceCounters[username] = graceUsed;
        if (halfDayFlag) {
          acc.halfDays++;
          halfDayKeys.add(timelineLogKey(log));
        }
        if (isLateDaySummary(log, rulesFor(log.username))) {
          acc.lateDays++;
        }
      }
    }

    return { summary: acc, halfDayKeys };
  })();

  const filteredLogs = dateRangedTimeline.filter((log) => {
    if (filterStatus === "late") {
      const checkinStatus = getCheckinStatus(log.checkin_time, log.username);
      const checkoutStatus = getCheckoutStatus(log.checkout_time, log.username);
      return (
        logShowsAttendancePunchDetails(log) &&
        (checkinStatus === "late" || checkoutStatus === "late")
      );
    }
    if (filterStatus === "onTime") {
      const checkinStatus = getCheckinStatus(log.checkin_time, log.username);
      const checkoutStatus = getCheckoutStatus(log.checkout_time, log.username);
      return (
        logShowsAttendancePunchDetails(log) &&
        checkinStatus !== "late" &&
        checkinStatus !== "halfDay" &&
        checkoutStatus !== "late" &&
        checkoutStatus !== "halfDay"
      );
    }
    if (filterStatus === "halfDay") {
      return halfDayKeys.has(timelineLogKey(log));
    }
    return true;
  });

  const handleDownload = async () => {
    if (appliedUserSelection == null) {
      toast.error("Please click Search to load data first.");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Attendance Report");

      // Define columns to match your data structure
      worksheet.columns = [
        { header: "Date", key: "Date", width: 15 },
        { header: "User", key: "User", width: 20 },
        { header: "Type", key: "Type", width: 12 },
        { header: "Checkin", key: "Checkin", width: 12 },
        { header: "Checkin Photo", key: "CheckinPhoto", width: 30 },
        { header: "Checkout", key: "Checkout", width: 12 },
        { header: "Morning Break", key: "MorningBreak", width: 20 },
        { header: "Lunch Break", key: "LunchBreak", width: 20 },
        { header: "Evening Break", key: "EveningBreak", width: 20 },
        { header: "Checkin Address", key: "CheckinAddress", width: 30 },
        { header: "Checkout Address", key: "CheckoutAddress", width: 30 },
      ];

      // Map and add rows
      filteredLogs.forEach((log) => {
        worksheet.addRow({
          Date: new Date(log.date).toLocaleDateString(),
          User: log.username,
          Type: log.type === "present" ? "Present" : log.type === "absent" ? "Absent" : log.type === "leave" ? "Leave" : "Holiday",
          Checkin: log.checkin_time ? formatTime(log.checkin_time) : "",
          CheckinPhoto: log.checkin_photo || "",
          Checkout: log.checkout_time ? formatTime(log.checkout_time) : "",
          MorningBreak: log.break_morning_start
            ? `${formatTime(log.break_morning_start)} - ${formatTime(log.break_morning_end)}`
            : "",
          LunchBreak: log.break_lunch_start
            ? `${formatTime(log.break_lunch_start)} - ${formatTime(log.break_lunch_end)}`
            : "",
          EveningBreak: log.break_evening_start
            ? `${formatTime(log.break_evening_start)} - ${formatTime(log.break_evening_end)}`
            : "",
          CheckinAddress: log.checkin_address || "",
          CheckoutAddress: log.checkout_address || "",
        });
      });

      // Style the header row to make it look professional
      worksheet.getRow(1).font = { bold: true };

      // Generate the buffer and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "attendance_report.xlsx";
      anchor.click();
      window.URL.revokeObjectURL(url);

      toast.success("Download successful!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to generate Excel file.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600 text-lg">Loading attendance data...</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full py-2 sm:py-4">
        <div className="bg-white shadow-md rounded-lg p-4 sm:p-5 mb-4 sm:mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            Attendance details
          </h1>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center sm:gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:min-w-[200px]">
              Employee
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {uniqueUsers.map((user) => (
                  <option key={user} value={user}>
                    {user === "all" ? "All Users" : user}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {searchLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {searchLoading ? "Loading…" : "Search"}
            </button>
            <button
              type="button"
              onClick={openHolidayModal}
              className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Holiday List
            </button>
            <AttendanceBulkImportPanel onComplete={fetchAttendance} />
          </div>

          {searchLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 py-16 text-slate-600">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
              <p className="mt-4 text-sm font-medium">Loading attendance…</p>
              <p className="mt-1 text-xs text-slate-500">Preparing summary and records</p>
            </div>
          ) : appliedUserSelection === null ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-sm text-slate-600">
              Default is <span className="font-medium">All Users</span>. Pick an employee if needed, then click{" "}
              <span className="font-medium">Search</span> to load the summary and table.
            </p>
          ) : (
            <>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-8 text-center">
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-green-600">
                {formatLeaveSummaryDays(summary.present)}
              </p>
              <p className="text-sm text-gray-500">Present</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Full day punch = 1; paid half-day work = 0.5
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-orange-600">{summary.absents}</p>
              <p className="text-sm text-gray-500">Absent</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-blue-600">
                {formatLeaveSummaryDays(summary.leaves)}
              </p>
              <p className="text-sm text-gray-500">Leaves</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Full day = 1, paid half-day = 0.5
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-purple-600">
                {summary.sundays}
              </p>
              <p className="text-sm text-gray-500">Sundays</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-indigo-600">
                {summary.holidays}
              </p>
              <p className="text-sm text-gray-500">Holidays</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-yellow-500">
                {summary.halfDays}
              </p>
              <p className="text-sm text-gray-500">Half-Days</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-red-600">
                {summary.lateDays}
              </p>
              <p className="text-sm text-gray-500">Late Days</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
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

            <div className="flex flex-col items-stretch gap-2 w-full md:w-auto md:items-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={handleShowAll}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-colors duration-200 ${filterStatus === "all"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                Show All
              </button>
              <div className="flex flex-row items-center gap-2 shrink-0">
              <TypeableDateFilterInput
                value={fromDate}
                onChange={setFromDate}
                placeholder="From Date"
                wrapperClassName="relative flex w-[10.5rem] sm:w-36 shrink-0 items-stretch"
                className="px-3 py-2 w-full border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <TypeableDateFilterInput
                value={toDate}
                onChange={setToDate}
                placeholder="To Date"
                wrapperClassName="relative flex w-[10.5rem] sm:w-36 shrink-0 items-stretch"
                className="px-3 py-2 w-full border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                onClick={handleDownload}
                className="px-4 py-2 rounded-md font-medium text-sm bg-blue-500 text-white shadow-md hover:bg-blue-600 transition-colors duration-200"
              >
                Download
              </button>
              </div>
            </div>
          </div>
            </>
          )}
        </div>

        {appliedUserSelection !== null && (
        <div className="h-[70vh] overflow-y-auto">
          {/* Card View for Mobile (md and below) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={`rounded-lg shadow-md p-4 space-y-2 ${log.type === "absent"
                    ? "bg-orange-50"
                    : log.type === "leave" || log.type === "paidleave" || log.type === "unpaidleave"
                      ? "bg-blue-50"
                      : log.type === "sunday"
                        ? "bg-purple-50"
                        : log.type === "holiday"
                          ? "bg-indigo-50"
                          : log.workedSunday
                            ? "bg-pink-200"
                            : "bg-white"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      Date:
                    </span>
                    <span className="text-sm text-gray-700 flex flex-col items-end gap-1.5">
                      <span className="flex items-center gap-1.5">
                        {new Date(log.date).toLocaleDateString()}
                        {log.workedSunday && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                            Working Sunday
                          </span>
                        )}
                      </span>
                      {log.approvedHalfDay && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                          <Sun className="w-3 h-3" />
                          Half-Day · {log.approvedHalfDay.half_day_type === "1st_half" ? "1st Half" : "2nd Half"}
                        </span>
                      )}
                    </span>
                  </div>
                  {(log.type === "leave" ||
                    log.type === "paidleave" ||
                    log.type === "unpaidleave") && (
                    <div className="rounded-md bg-blue-50/80 px-3 py-2">
                      <LeaveDayStatusBlock log={log} className="text-left" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      User:
                    </span>
                    <span className="text-sm text-gray-700">{log.username}</span>
                  </div>
                  {logShowsAttendancePunchDetails(log) ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">
                          Check-in:
                        </span>
                        <span
                          className={`text-sm ${(() => {
                            const status = getCheckinStatus(log.checkin_time, log.username);
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
                          Check-in Address:
                        </span>
                        <ViewAddressLink
                          title={`Check-in — ${log.username}`}
                          address={log.checkin_address}
                          latitude={log.checkin_latitude}
                          longitude={log.checkin_longitude}
                          onOpen={openAddressMap}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">
                          Check-in Photo:
                        </span>
                        {log.checkin_photo ? (
                          <a
                            href={log.checkin_photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <img
                              src={log.checkin_photo}
                              alt="Checkin Photo"
                              className="h-12 w-12 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                              title="Click to view full image"
                            />
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm italic">No photo</span>
                        )}
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
                            const status = getCheckoutStatus(log.checkout_time, log.username);
                            // Early checkout or missing checkout always shows as half-day for display
                            const isHalfDayStatus = isHalfDay(log);
                            if (isHalfDayStatus) return 'text-yellow-600';
                            if (status === 'late') return 'text-red-600';
                            if (status === 'grace') return 'text-orange-600';
                            return 'text-green-600';
                          })()
                            }`}
                        >
                          {formatTime(log.checkout_time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 shrink-0">
                          Check-out Address:
                        </span>
                        <span className="text-sm text-gray-700 flex items-center gap-1.5 justify-end text-right min-w-0">
                          <ViewAddressLink
                            title={`Check-out — ${log.username}`}
                            address={log.checkout_address}
                            latitude={log.checkout_latitude}
                            longitude={log.checkout_longitude}
                            onOpen={openAddressMap}
                            className="text-sm"
                          />
                          {log.regularization ? (
                            <span className="relative inline-flex shrink-0 group/regm">
                              <Info
                                className="w-4 h-4 text-teal-600 cursor-help"
                                aria-label="Regularization details"
                              />
                              <span className="absolute right-0 bottom-full mb-2 z-30 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover/regm:opacity-100 group-hover/regm:visible transition-all pointer-events-none">
                                <div className="space-y-1.5 text-left whitespace-normal">
                                  <p>
                                    <span className="text-gray-400">
                                      Username (created request):{" "}
                                    </span>
                                    {log.regularization.createdBy}
                                  </p>
                                  <p>
                                    <span className="text-gray-400">
                                      Reviewed by:{" "}
                                    </span>
                                    {log.regularization.approvedBy}
                                  </p>
                                  <p>
                                    <span className="text-gray-400">
                                      Reason:{" "}
                                    </span>
                                    {log.regularization.reason}
                                  </p>
                                </div>
                              </span>
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-gray-100 space-y-2">
                            {/* <button
                              type="button"
                              onClick={() => openEditModal(log)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                              Edit Log
                            </button> */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openBreakEditModal(log)}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                                Edit times
                              </button>
                              <button
                                type="button"
                                onClick={() => openAttendanceHistoryModal(log)}
                                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50"
                                title="View edit history"
                                aria-label="View edit history"
                              >
                                <History className="h-4 w-4" aria-hidden />
                              </button>
                            </div>
                            {/* <button
                              type="button"
                              onClick={() => openDeleteDialog(log)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete Log
                            </button> */}
                          </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      {(log.type === "leave" || log.type === "paidleave" || log.type === "unpaidleave") ? (
                        <>
                          <p className={`text-lg font-bold ${log.is_half_day == 1 ? "text-orange-600" : ""}`}>
                            {log.is_half_day == 1
                              ? "Half Day"
                              : log.type === "unpaidleave"
                                ? "Unpaid Leave"
                                : "Leave"}
                          </p>
                          {log.is_half_day == 1 && (
                            <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                              <Sun className="w-3 h-3" />
                              {log.half_day_type === "2nd_half" ? "2nd Half" : "1st Half"}
                            </span>
                          )}
                          {log.leaveType && (
                            <p className="text-sm text-gray-600 mt-2 capitalize">{log.leaveType} Leave</p>
                          )}
                        </>
                      ) : (
                        <p className="text-lg font-bold">
                          {log.type === "absent" ? "Absent" : log.type === "sunday" ? "Sunday" : "Holiday"}
                        </p>
                      )}
                      {!(log.type === "leave" || log.type === "paidleave" || log.type === "unpaidleave") && log.leaveType && (
                        <p className="text-sm text-gray-600 mt-1 capitalize">{log.leaveType} Leave</p>
                      )}
                      {log.holidayTitle && log.holidayTitle !== "Weekend" && log.holidayTitle !== "Sunday" && (
                        <p className="text-sm text-gray-600 mt-1">{log.holidayTitle}</p>
                      )}
                      {log.holidayDescription && (
                        <p className="text-xs text-gray-500 mt-1">{log.holidayDescription}</p>
                      )}
                      {log.type === "absent" && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => openAbsentRegularizeModal(log)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                          >
                            Regularize
                          </button>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                    Leave / Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in Photo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in Address
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-out Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log, index) => (
                    <tr
                      key={index}
                      className={`transition-colors duration-150 ${log.workedSunday ? "bg-pink-200 hover:bg-pink-300" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(log.date).toLocaleDateString()}
                        {log.workedSunday && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                            Working Sunday
                          </span>
                        )}
                        {log.approvedHalfDay && (
                          <span className="ml-2 mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                            <Sun className="w-3 h-3" />
                            Half-Day · {log.approvedHalfDay.half_day_type === "1st_half" ? "1st Half" : "2nd Half"}
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-4 text-sm align-top max-w-xs ${
                          log.type === "leave" ||
                          log.type === "paidleave" ||
                          log.type === "unpaidleave"
                            ? "bg-blue-50/80"
                            : ""
                        }`}
                      >
                        <LeaveDayStatusBlock log={log} className="text-left" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.username}
                      </td>
                      {logShowsAttendancePunchDetails(log) ? (
                        <>
                          <td
                            className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${(() => {
                              const status = getCheckinStatus(log.checkin_time, log.username);
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
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {log.checkin_photo ? (
                              <a
                                href={log.checkin_photo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block"
                              >
                                <img
                                  src={log.checkin_photo}
                                  alt="Checkin Photo"
                                  className="h-16 w-16 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                  title="Click to view full image"
                                />
                              </a>
                            ) : (
                              <span className="text-gray-400 italic">No photo</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <ViewAddressLink
                              title={`Check-in — ${log.username} (${attendanceDateYmd(log.date)})`}
                              address={log.checkin_address}
                              latitude={log.checkin_latitude}
                              longitude={log.checkin_longitude}
                              onOpen={openAddressMap}
                            />
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${(() => {
                              const status = getBreakStatus(log.break_morning_start, log.break_morning_end, 'morning', log.username);
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
                              const status = getBreakStatus(log.break_lunch_start, log.break_lunch_end, 'lunch', log.username);
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
                              const status = getBreakStatus(log.break_evening_start, log.break_evening_end, 'evening', log.username);
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
                              const status = getCheckoutStatus(log.checkout_time, log.username);
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
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <ViewAddressLink
                                title={`Check-out — ${log.username} (${attendanceDateYmd(log.date)})`}
                                address={log.checkout_address}
                                latitude={log.checkout_latitude}
                                longitude={log.checkout_longitude}
                                onOpen={openAddressMap}
                              />
                              {log.regularization ? (
                                <span className="relative inline-flex group/coreg">
                                  <Info
                                    className="w-4 h-4 text-teal-600 cursor-help shrink-0"
                                    aria-label="Regularization details"
                                  />
                                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover/coreg:opacity-100 group-hover/coreg:visible transition-all pointer-events-none">
                                    <div className="space-y-1.5 text-left whitespace-normal">
                                      <p>
                                        <span className="text-gray-400">
                                          Username (created request):{" "}
                                        </span>
                                        {log.regularization.createdBy}
                                      </p>
                                      <p>
                                        <span className="text-gray-400">
                                          Reviewed by:{" "}
                                        </span>
                                        {log.regularization.approvedBy}
                                      </p>
                                      <p>
                                        <span className="text-gray-400">
                                          Reason:{" "}
                                        </span>
                                        {log.regularization.reason}
                                      </p>
                                    </div>
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex flex-wrap gap-2">
                              {/* <button
                                type="button"
                                onClick={() => openEditModal(log)}
                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                title="Edit attendance log"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                Edit Log
                              </button> */}
                              <button
                                type="button"
                                onClick={() => openBreakEditModal(log)}
                                className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                                title="Edit check-in, check-out, and break times"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => openAttendanceHistoryModal(log)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                title="View edit history"
                                aria-label="View edit history"
                              >
                                <History className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {/* <button
                                type="button"
                                onClick={() => openDeleteDialog(log)}
                                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                title="Delete attendance log"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button> */}
                            </div>
                          </td>
                        </>
                      ) : (
                        <td
                          colSpan="9"
                          className={`px-6 py-4 text-center ${log.type === "absent"
                            ? "bg-orange-50 text-orange-700"
                            : log.type === "leave"
                              ? "bg-blue-50 text-blue-700"
                              : log.type === "paidleave" || log.type === "unpaidleave"
                                ? "bg-blue-50 text-blue-700"
                              : log.type === "sunday"
                                ? "bg-purple-50 text-purple-700"
                                : "bg-indigo-50 text-indigo-700"
                            }`}
                        >
                          {(log.type === "leave" ||
                            log.type === "paidleave" ||
                            log.type === "unpaidleave") ? (
                            <span className="text-sm text-gray-400">—</span>
                          ) : (
                          <p className="font-bold text-lg">
                            {log.type === "absent"
                              ? "Absent"
                              : log.type === "sunday"
                                  ? "Sunday"
                                  : "Holiday"}
                          </p>
                          )}
                          {log.holidayTitle && log.holidayTitle !== "Weekend" && log.holidayTitle !== "Sunday" && (
                            <p className="text-sm mt-1">{log.holidayTitle}</p>
                          )}
                          {log.holidayDescription && (
                            <p className="text-xs text-gray-500 mt-1">{log.holidayDescription}</p>
                          )}
                          {log.type === "absent" && (
                            <div className="mt-3 flex justify-center">
                              <button
                                type="button"
                                onClick={() => openAbsentRegularizeModal(log)}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                              >
                                Regularize
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="12"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No attendance logs found for the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
      {breakEditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-4"
            role="dialog"
            aria-labelledby="break-edit-title"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 id="break-edit-title" className="text-lg font-semibold">
                Edit attendance times
              </h3>
              <button
                type="button"
                onClick={closeBreakEditModal}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {breakEditLog.username} ·{" "}
              {new Date(breakEditLog.date).toLocaleDateString()}
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Leave a field empty to clear that time. Times use the attendance
              date (IST). If you change check-in or check-out, this device&apos;s
              current location is saved (required for checkout GPS).
            </p>
            <div className="space-y-4">
              {[
                {
                  section: null,
                  fields: [
                    ["Check-in", "checkin_time"],
                    ["Check-out", "checkout_time"],
                  ],
                },
                {
                  section: "Morning break",
                  fields: [
                    ["Start", "break_morning_start"],
                    ["End", "break_morning_end"],
                  ],
                },
                {
                  section: "Lunch break",
                  fields: [
                    ["Start", "break_lunch_start"],
                    ["End", "break_lunch_end"],
                  ],
                },
                {
                  section: "Evening break",
                  fields: [
                    ["Start", "break_evening_start"],
                    ["End", "break_evening_end"],
                  ],
                },
              ].map(({ section, fields }) => (
                <div key={section ?? "punch"}>
                  {section ? (
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {section}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map(([label, key]) => (
                      <label
                        key={key}
                        className="flex flex-col gap-1 text-sm font-medium text-gray-700 min-w-0"
                      >
                        {label}
                        <input
                          type="time"
                          step={60}
                          value={breakEditForm[key]}
                          onChange={(e) =>
                            setBreakEditForm((f) => ({
                              ...f,
                              [key]: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <AttendanceEditHistoryPanel
              className="mt-5 pt-4 border-t border-gray-200"
              username={breakEditLog.username}
              logDate={attendanceDateYmd(breakEditLog.date)}
              refreshToken={editHistoryRefresh}
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeBreakEditModal}
                disabled={breakEditSaving}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveBreakEdits}
                disabled={breakEditSaving}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                {breakEditSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {historyModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-4"
            role="dialog"
            aria-labelledby="attendance-history-title"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 id="attendance-history-title" className="text-lg font-semibold">
                Edit history
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalLog(null)}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {historyModalLog.username} ·{" "}
              {new Date(historyModalLog.date).toLocaleDateString()}
            </p>
            <AttendanceEditHistoryPanel
              username={historyModalLog.username}
              logDate={attendanceDateYmd(historyModalLog.date)}
              refreshToken={editHistoryRefresh}
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalLog(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <AttendanceAddressMapModal
        open={addressMapOpen}
        payload={addressMapPayload}
        onClose={() => {
          setAddressMapOpen(false);
          setAddressMapPayload(null);
        }}
      />
      <AttendanceRegularizeModal
        open={regModalOpen}
        log={regModalLog}
        logDateKey={regModalDateKey}
        forUsername={regForUsername || undefined}
        onClose={() => {
          setRegModalOpen(false);
          setRegModalLog(null);
          setRegModalDateKey("");
          setRegForUsername("");
        }}
        onSubmitted={() => {
          fetchAttendance();
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

      {/* Edit Modal */}
      {editModalOpen && editModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Attendance Log</h3>
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditModalLog(null);
                }}
                className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={editModalLog.date ? new Date(editModalLog.date).toISOString().split('T')[0] : ''}
                  disabled
                  className="w-full px-3 py-2 border rounded-md bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editModalLog.username || ''}
                  disabled
                  className="w-full px-3 py-2 border rounded-md bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-in Time
                </label>
                <input
                  type="time"
                  step="1"
                  value={editModalLog.checkin_time ? editModalLog.checkin_time.slice(0, 8) : ''}
                  onChange={(e) => setEditModalLog({ ...editModalLog, checkin_time: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Morning Break Start
                </label>
                <input
                  type="time"
                  step="1"
                  value={editModalLog.break_morning_start ? editModalLog.break_morning_start.slice(0, 8) : ''}
                  onChange={(e) => setEditModalLog({ ...editModalLog, break_morning_start: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Morning Break End
                </label>
                <input
                  type="time"
                  step="1"
                  value={editModalLog.break_morning_end ? editModalLog.break_morning_end.slice(0, 8) : ''}
                  onChange={(e) => setEditModalLog({ ...editModalLog, break_morning_end: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lunch Break Start
                </label>
                <input
                  type="time"
                  step="1"
                  value={editModalLog.break_lunch_start ? editModalLog.break_lunch_start.slice(0, 8) : ''}
                  onChange={(e) => setEditModalLog({ ...editModalLog, break_lunch_start: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lunch Break End
                </label>
                <input
                  type="time"
                  step="1"
                  value={editModalLog.break_lunch_end ? editModalLog.break_lunch_end.slice(0, 8) : ''}
                  onChange={(e) => setEditModalLog({ ...editModalLog, break_lunch_end: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evening Break Start
                </label>
                <input
                  type="time"
                  step="1"
                  value={editModalLog.break_evening_start ? editModalLog.break_evening_start.slice(0, 8) : ''}
                  onChange={(e) => setEditModalLog({ ...editModalLog, break_evening_start: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evening Break End
                </label>
                <input
                  type="time"
                  step="1"
                  value={editModalLog.break_evening_end ? editModalLog.break_evening_end.slice(0, 8) : ''}
                  onChange={(e) => setEditModalLog({ ...editModalLog, break_evening_end: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-out Time
                </label>
                <input
                  type="time"
                  step="1"
                  value={editModalLog.checkout_time ? editModalLog.checkout_time.slice(0, 8) : ''}
                  onChange={(e) => setEditModalLog({ ...editModalLog, checkout_time: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditModalLog(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && deleteModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Delete Attendance Log</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the attendance log for {deleteModalLog.username} on {new Date(deleteModalLog.date).toLocaleDateString()}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteModalLog(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AttendancePage;
