"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiLogOut } from "react-icons/fi";
import { MdFastfood } from "react-icons/md";
import { FaBuildingCircleCheck } from "react-icons/fa6";
import { SiGitea } from "react-icons/si";
import toast from "react-hot-toast";
import {
  getNowISTClockMinutes,
  parseAttendanceDateTime,
} from "@/lib/istDateTime";
import {
  formatScheduleTimeLabel,
  scheduleTimeToMinutes,
} from "@/lib/employeeAttendanceScheduleUtils";

const PRE_BREAK_SHOW_MINUTES = 1;

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function AttendanceStatusTracker({ username }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [actionLoading, setActionLoading] = useState(false);
  const [breakRemainingSec, setBreakRemainingSec] = useState(null);

  const refreshData = useCallback(async () => {
    try {
      const [attendanceRes, rulesRes] = await Promise.all([
        fetch(`/api/attendance/today?username=${encodeURIComponent(username)}`),
        fetch(
          `/api/attendance/rules?username=${encodeURIComponent(username)}`
        ),
      ]);

      if (attendanceRes.ok) {
        const data = await attendanceRes.json();
        setStatus(data.attendance);
      }
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData.rules);
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    refreshData();
    const refreshInterval = setInterval(refreshData, 30000);
    return () => clearInterval(refreshInterval);
  }, [refreshData]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentMinutes = useMemo(() => getNowISTClockMinutes(), [nowMs]);

  const getBreakDurationMinutes = useCallback(
    (type) => {
      switch (type) {
        case "break_morning":
          return rules?.morning_duration_minutes || 15;
        case "break_lunch":
          return rules?.lunch_duration_minutes || 30;
        case "break_evening":
          return rules?.evening_duration_minutes || 15;
        default:
          return 15;
      }
    },
    [rules]
  );

  const getBreakStartField = (type) => {
    switch (type) {
      case "break_morning":
        return status?.break_morning_start;
      case "break_lunch":
        return status?.break_lunch_start;
      case "break_evening":
        return status?.break_evening_start;
      default:
        return null;
    }
  };

  /** Icon: schedule se 1 min pehle (11:15 → 11:14), usse pehle nahi */
  const shouldShowBreakIcon = useCallback((breakStartStr) => {
    const breakStartMin = scheduleTimeToMinutes(breakStartStr);
    if (breakStartMin == null) return false;
    return currentMinutes >= breakStartMin - PRE_BREAK_SHOW_MINUTES;
  }, [currentMinutes]);

  /** Start: scheduled time ke baad kabhi bhi (miss ho to bhi dikhega) */
  const canStartBreak = useCallback((breakStartStr) => {
    const breakStartMin = scheduleTimeToMinutes(breakStartStr);
    if (breakStartMin == null) return false;
    return currentMinutes >= breakStartMin;
  }, [currentMinutes]);

  const evaluateBreakSlot = useCallback(
    (type, startStr, startField, endField, label) => {
      if (status?.[startField] && !status?.[endField]) {
        return { type, status: "in_progress", label: `${label} (In Progress)` };
      }
      if (status?.[endField]) {
        return null;
      }

      if (!shouldShowBreakIcon(startStr)) {
        return null;
      }
      if (canStartBreak(startStr)) {
        return { type, status: "ready", label: `Start ${label}` };
      }
      return {
        type,
        status: "pending",
        label: `${label} at ${formatScheduleTimeLabel(startStr)}`,
      };
    },
    [status, shouldShowBreakIcon, canStartBreak]
  );

  const canCheckIn = useCallback(() => {
    const checkinMin = scheduleTimeToMinutes(rules?.checkin_time);
    if (checkinMin == null) return true;
    const grace = rules?.grace_period_minutes ?? 15;
    return currentMinutes >= checkinMin - grace;
  }, [rules, currentMinutes]);

  const getBreakStatus = useCallback(() => {
    if (!rules) return { type: "loading", status: "pending", label: "Loading" };

    const checkinTime = status?.checkin_time;
    const checkoutTime = status?.checkout_time;

    if (!checkinTime) {
      if (!canCheckIn()) {
        return {
          type: "waiting",
          status: "pending",
          label: `Check-in at ${formatScheduleTimeLabel(rules.checkin_time)}`,
        };
      }
      return { type: "checkin", status: "pending", label: "Check In" };
    }

    if (checkoutTime) {
      return { type: "checkout", status: "completed", label: "Day Completed" };
    }

    // Step 4: Evening break khatam → turant checkout
    if (status?.break_evening_end) {
      return { type: "checkout", status: "ready", label: "Check Out" };
    }

    // Step 1: Subah tea break
    const morning = evaluateBreakSlot(
      "break_morning",
      rules.break_morning,
      "break_morning_start",
      "break_morning_end",
      "Tea Break"
    );
    if (morning) return morning;

    // Step 2: Tea break khatam ke baad hi lunch
    if (status?.break_morning_end) {
      const lunch = evaluateBreakSlot(
        "break_lunch",
        rules.break_lunch,
        "break_lunch_start",
        "break_lunch_end",
        "Lunch Break"
      );
      if (lunch) return lunch;
    }

    // Step 3: Lunch khatam ke baad hi evening break
    if (status?.break_lunch_end) {
      const evening = evaluateBreakSlot(
        "break_evening",
        rules.break_evening,
        "break_evening_start",
        "break_evening_end",
        "Evening Break"
      );
      if (evening) return evening;
    }

    // Evening skip ho to scheduled checkout time par
    const checkoutMin = scheduleTimeToMinutes(rules.checkout_time);
    if (checkoutMin != null && currentMinutes >= checkoutMin) {
      return { type: "checkout", status: "ready", label: "Check Out" };
    }

    return { type: "working", status: "completed", label: "Checked In" };
  }, [rules, status, evaluateBreakSlot, currentMinutes, canCheckIn]);

  const breakInfo = useMemo(() => getBreakStatus(), [getBreakStatus]);

  useEffect(() => {
    if (breakInfo.status !== "in_progress" || !breakInfo.type.startsWith("break_")) {
      setBreakRemainingSec(null);
      return;
    }

    const startedAt = parseAttendanceDateTime(getBreakStartField(breakInfo.type));
    if (!startedAt) {
      setBreakRemainingSec(null);
      return;
    }

    const durationMin = getBreakDurationMinutes(breakInfo.type);
    const endMs = startedAt.getTime() + durationMin * 60 * 1000;
    const remaining = Math.ceil((endMs - nowMs) / 1000);
    setBreakRemainingSec(Math.max(0, remaining));
  }, [breakInfo, nowMs, getBreakDurationMinutes, status]);

  const isBreakReadyToStart =
    breakInfo.status === "ready" && breakInfo.type.startsWith("break_");
  const isBreakInProgress =
    breakInfo.status === "in_progress" && breakInfo.type.startsWith("break_");

  const getBreakIconColor = (state) => {
    switch (state) {
      case "pending":
        return "text-red-500";
      case "ready":
        return "text-white";
      case "in_progress":
        return "text-green-500";
      default:
        return "text-gray-400";
    }
  };

  const renderIcon = () => {
    switch (breakInfo.type) {
      case "checkin":
        return (
          <FaBuildingCircleCheck size={20} className="text-white" />
        );
      case "waiting":
        return (
          <FaBuildingCircleCheck size={20} className="text-slate-400" />
        );
      case "checkout":
        return (
          <FiLogOut
            size={20}
            className={
              breakInfo.status === "ready" ? "text-white" : "text-green-500"
            }
          />
        );
      case "break_morning":
      case "break_evening":
        return (
          <SiGitea size={20} className={getBreakIconColor(breakInfo.status)} />
        );
      case "break_lunch":
        return (
          <MdFastfood size={20} className={getBreakIconColor(breakInfo.status)} />
        );
      case "working":
        return <FaBuildingCircleCheck size={20} className="text-white" />;
      default:
        return null;
    }
  };

  const getLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });

  const handleAction = async () => {
    if (actionLoading) return;

    const currentBreakInfo = getBreakStatus();
    if (
      currentBreakInfo.type === "working" ||
      currentBreakInfo.type === "waiting"
    ) {
      return;
    }
    const needsGps =
      (currentBreakInfo.type === "checkin" &&
        currentBreakInfo.status === "pending") ||
      (currentBreakInfo.type === "checkout" &&
        currentBreakInfo.status === "ready");

    setActionLoading(true);
    try {
      let latitude;
      let longitude;

      if (needsGps) {
        try {
          const coords = await getLocation();
          latitude = coords.latitude;
          longitude = coords.longitude;
        } catch (err) {
          toast.error(
            err?.message ||
              "Location permission required for check-in/check-out."
          );
          return;
        }
      }

      const response = await fetch("/api/attendance/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          action: currentBreakInfo.type,
          status: currentBreakInfo.status,
          latitude,
          longitude,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.error || "Attendance action failed.");
        return;
      }

      await refreshData();

      if (
        currentBreakInfo.type === "checkin" &&
        currentBreakInfo.status === "pending"
      ) {
        toast.success("Checked in successfully.");
      } else if (
        currentBreakInfo.type === "checkout" &&
        currentBreakInfo.status === "ready"
      ) {
        toast.success("Checked out successfully.");
      } else if (
        currentBreakInfo.status === "ready" &&
        currentBreakInfo.type.startsWith("break_")
      ) {
        toast.success("Break started.");
      } else if (
        currentBreakInfo.status === "in_progress" &&
        currentBreakInfo.type.startsWith("break_")
      ) {
        toast.success("Break ended.");
      }
    } catch (error) {
      console.error("Error performing action:", error);
      toast.error("Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-gray-500">Loading...</div>;
  }

  if (!rules) {
    return <div className="text-xs text-gray-500">Rules not configured</div>;
  }

  const warnAtSeconds =
    breakInfo.type === "break_lunch"
      ? 26 * 60
      : 12 * 60;

  const scheduleHint = rules
    ? `In: ${formatScheduleTimeLabel(rules.checkin_time)} | Out: ${formatScheduleTimeLabel(rules.checkout_time)} | Tea: ${formatScheduleTimeLabel(rules.break_morning)} (${rules.morning_duration_minutes}m) | Lunch: ${formatScheduleTimeLabel(rules.break_lunch)} (${rules.lunch_duration_minutes}m) | Evening: ${formatScheduleTimeLabel(rules.break_evening)} (${rules.evening_duration_minutes}m)`
    : "";

  const buttonTitle = actionLoading
    ? "Processing..."
    : `${breakInfo.label}${scheduleHint ? ` | ${scheduleHint}` : ""}`;

  const isPassiveWorking = breakInfo.type === "working";
  const isWaitingCheckin = breakInfo.type === "waiting";
  const isBreakPending =
    breakInfo.status === "pending" && breakInfo.type.startsWith("break_");

  return (
    <button
      type="button"
      onClick={handleAction}
      disabled={
        actionLoading ||
        isPassiveWorking ||
        isWaitingCheckin ||
        isBreakPending ||
        (breakInfo.type === "checkout" && breakInfo.status === "completed")
      }
      className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg p-2 transition-colors ${
        isPassiveWorking || isWaitingCheckin || isBreakPending
          ? "cursor-default"
          : "disabled:cursor-not-allowed disabled:opacity-50"
      } ${
        isBreakReadyToStart || isBreakPending ? "animate-pulse" : ""
      } ${
        isBreakReadyToStart || isBreakPending
          ? isBreakPending
            ? "bg-red-400 text-white"
            : "bg-red-500 hover:bg-red-600 text-white"
          : isWaitingCheckin
            ? "bg-slate-200 text-slate-500"
          : breakInfo.type === "checkin" && breakInfo.status === "pending"
            ? "bg-red-500 hover:bg-red-600 text-white"
            : isPassiveWorking ||
                (breakInfo.type === "checkin" &&
                  breakInfo.status === "completed") ||
                isBreakInProgress
              ? "bg-green-500 text-white hover:bg-green-600"
              : breakInfo.type === "checkout" && breakInfo.status === "ready"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "hover:bg-gray-100"
      } ${
        isBreakInProgress &&
        breakRemainingSec != null &&
        breakRemainingSec <= warnAtSeconds
          ? "animate-pulse ring-2 ring-amber-400"
          : ""
      }`}
      title={buttonTitle}
    >
      {actionLoading ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : isBreakInProgress && breakRemainingSec != null ? (
        <span className="text-[11px] font-bold tabular-nums leading-none text-white">
          {formatCountdown(breakRemainingSec)}
        </span>
      ) : (
        renderIcon()
      )}
    </button>
  );
}
