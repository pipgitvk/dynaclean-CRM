"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, LogOut } from "lucide-react";
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
    return currentMinutes >= 7 * 60;
  }, [currentMinutes]);

  const getCheckoutAction = useCallback(() => {
    if (!rules) return null;
    const checkinTime = status?.checkin_time;
    const checkoutTime = status?.checkout_time;
    if (!checkinTime) return null;
    if (checkoutTime) {
      return { type: "checkout", status: "completed", label: "Day Completed" };
    }
    return { type: "checkout", status: "ready", label: "Check Out" };
  }, [rules, status]);

  /** Check-in + breaks only (checkout is a separate button). */
  const getPrimaryAction = useCallback(() => {
    if (!rules) return { type: "loading", status: "pending", label: "Loading" };

    const checkinTime = status?.checkin_time;
    const checkoutTime = status?.checkout_time;

    if (!checkinTime) {
      if (!canCheckIn()) {
        return {
          type: "waiting",
          status: "pending",
          label: "Check-in at 7:00 am",
        };
      }
      return { type: "checkin", status: "pending", label: "Check In" };
    }

    if (checkoutTime) {
      return null;
    }

    // Evening break done → no check-in / working icon; only checkout button
    if (status?.break_evening_end) {
      return null;
    }

    const morning = evaluateBreakSlot(
      "break_morning",
      rules.break_morning,
      "break_morning_start",
      "break_morning_end",
      "Tea Break"
    );
    if (morning) return morning;

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

    return { type: "working", status: "completed", label: "Checked In" };
  }, [rules, status, evaluateBreakSlot, canCheckIn]);

  const primaryInfo = useMemo(() => getPrimaryAction(), [getPrimaryAction]);
  const checkoutInfo = useMemo(() => getCheckoutAction(), [getCheckoutAction]);

  useEffect(() => {
    if (
      !primaryInfo ||
      primaryInfo.status !== "in_progress" ||
      !primaryInfo.type.startsWith("break_")
    ) {
      setBreakRemainingSec(null);
      return;
    }

    const startedAt = parseAttendanceDateTime(getBreakStartField(primaryInfo.type));
    if (!startedAt) {
      setBreakRemainingSec(null);
      return;
    }

    const durationMin = getBreakDurationMinutes(primaryInfo.type);
    const endMs = startedAt.getTime() + durationMin * 60 * 1000;
    const remaining = Math.ceil((endMs - nowMs) / 1000);
    setBreakRemainingSec(remaining);
  }, [primaryInfo, nowMs, getBreakDurationMinutes, status]);

  const isBreakReadyToStart =
    primaryInfo?.status === "ready" && primaryInfo?.type.startsWith("break_");
  const isBreakInProgress =
    primaryInfo?.status === "in_progress" && primaryInfo?.type.startsWith("break_");
  const isBreakOvertime =
    isBreakInProgress && breakRemainingSec != null && breakRemainingSec < 0;
  const displayedBreakSec =
    breakRemainingSec == null
      ? null
      : breakRemainingSec >= 0
        ? breakRemainingSec
        : Math.max(1, Math.abs(breakRemainingSec));

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

  const renderPrimaryIcon = () => {
    if (!primaryInfo) return null;
    switch (primaryInfo.type) {
      case "checkin":
        return (
          <FaBuildingCircleCheck size={20} className="text-white" />
        );
      case "waiting":
        return (
          <FaBuildingCircleCheck size={20} className="text-slate-400" />
        );
      case "break_morning":
      case "break_evening":
        return (
          <SiGitea size={20} className={getBreakIconColor(primaryInfo.status)} />
        );
      case "break_lunch":
        return (
          <MdFastfood size={20} className={getBreakIconColor(primaryInfo.status)} />
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

  const performAction = async (actionInfo) => {
    if (actionLoading || !actionInfo) return;

    if (actionInfo.type === "working" || actionInfo.type === "waiting") {
      return;
    }
    if (actionInfo.type === "checkout" && actionInfo.status === "completed") {
      return;
    }

    const needsGps =
      (actionInfo.type === "checkin" && actionInfo.status === "pending") ||
      (actionInfo.type === "checkout" && actionInfo.status === "ready");

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
          action: actionInfo.type,
          status: actionInfo.status,
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

      if (actionInfo.type === "checkin" && actionInfo.status === "pending") {
        toast.success("Checked in successfully.");
      } else if (
        actionInfo.type === "checkout" &&
        actionInfo.status === "ready"
      ) {
        toast.success("Checked out successfully.");
      } else if (
        actionInfo.status === "ready" &&
        actionInfo.type.startsWith("break_")
      ) {
        toast.success("Break started.");
      } else if (
        actionInfo.status === "in_progress" &&
        actionInfo.type.startsWith("break_")
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

  const scheduleHint = rules
    ? `In: ${formatScheduleTimeLabel(rules.checkin_time)} | Out: ${formatScheduleTimeLabel(rules.checkout_time)} | Tea: ${formatScheduleTimeLabel(rules.break_morning)} (${rules.morning_duration_minutes}m) | Lunch: ${formatScheduleTimeLabel(rules.break_lunch)} (${rules.lunch_duration_minutes}m) | Evening: ${formatScheduleTimeLabel(rules.break_evening)} (${rules.evening_duration_minutes}m)`
    : "";

  const buildButtonClasses = (info, { isPrimary }) => {
    if (!info) return "";
    const isPassiveWorking = info.type === "working";
    const isWaitingCheckin = info.type === "waiting";
    const isBreakPending =
      info.status === "pending" && info.type.startsWith("break_");
    const breakReady =
      info.status === "ready" && info.type.startsWith("break_");
    const breakProgress =
      info.status === "in_progress" && info.type.startsWith("break_");
    const warnAtSeconds = info.type === "break_lunch" ? 26 * 60 : 12 * 60;
    const isCheckoutButton = info.type === "checkout";

    return [
      isCheckoutButton
        ? "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm whitespace-nowrap transition-colors shadow-sm"
        : "flex min-h-10 min-w-10 items-center justify-center rounded-lg p-2 transition-colors",
      isPassiveWorking || isWaitingCheckin || isBreakPending
        ? "cursor-default"
        : "disabled:cursor-not-allowed disabled:opacity-50",
      breakReady || isBreakPending ? "animate-pulse" : "",
      breakReady || isBreakPending
        ? isBreakPending
          ? "bg-red-400 text-white"
          : "bg-red-500 hover:bg-red-600 text-white"
        : isWaitingCheckin
          ? "bg-slate-200 text-slate-500"
          : info.type === "checkin" && info.status === "pending"
            ? "bg-red-500 hover:bg-red-600 text-white"
            : isPassiveWorking || breakProgress
              ? isBreakOvertime
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-green-500 text-white hover:bg-green-600"
              : info.type === "checkout" && info.status === "ready"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : info.type === "checkout" && info.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : "hover:bg-gray-100",
      isPrimary &&
      breakProgress &&
      breakRemainingSec != null &&
      breakRemainingSec >= 0 &&
      breakRemainingSec <= warnAtSeconds
        ? "animate-pulse ring-2 ring-amber-400"
        : "",
      isPrimary && isBreakOvertime ? "animate-pulse ring-2 ring-red-300" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const titleFor = (info) =>
    actionLoading
      ? "Processing..."
      : `${info?.label ?? ""}${isBreakOvertime && info === primaryInfo ? " (Overtime)" : ""}${
          scheduleHint ? ` | ${scheduleHint}` : ""
        }`;

  const isPassiveWorking = primaryInfo?.type === "working";
  const isWaitingCheckin = primaryInfo?.type === "waiting";
  const isBreakPending =
    primaryInfo?.status === "pending" &&
    primaryInfo?.type.startsWith("break_");

  const showCheckout = Boolean(checkoutInfo);

  if (!primaryInfo && !showCheckout) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {primaryInfo ? (
        <button
          type="button"
          onClick={() => performAction(primaryInfo)}
          disabled={
            actionLoading ||
            isPassiveWorking ||
            isWaitingCheckin ||
            isBreakPending
          }
          className={buildButtonClasses(primaryInfo, { isPrimary: true })}
          title={titleFor(primaryInfo)}
        >
          {actionLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : isBreakInProgress && displayedBreakSec != null ? (
            <span className="text-[11px] font-bold tabular-nums leading-none text-white">
              {formatCountdown(displayedBreakSec)}
            </span>
          ) : (
            renderPrimaryIcon()
          )}
        </button>
      ) : null}
      {showCheckout ? (
        <button
          type="button"
          onClick={() => performAction(checkoutInfo)}
          disabled={actionLoading || checkoutInfo.status === "completed"}
          className={buildButtonClasses(checkoutInfo, { isPrimary: false })}
          title={titleFor(checkoutInfo)}
        >
          {actionLoading && !primaryInfo ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : checkoutInfo.status === "completed" ? (
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck size={17} strokeWidth={2.25} aria-hidden />
              Checked out
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <LogOut size={17} strokeWidth={2.25} aria-hidden />
              Checkout
            </span>
          )}
        </button>
      ) : null}
    </div>
  );
}
