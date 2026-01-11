// src/components/empcrm/AttendanceTracker.jsx
"use client";
import React, { useState, useEffect } from "react";

const AttendanceTracker = ({ username }) => {
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remainingBreakTime, setRemainingBreakTime] = useState(null);
  const [preBreakTime, setPreBreakTime] = useState(null);
  const [endBreakNotification, setEndBreakNotification] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false); // getting location
  const [isSubmitting, setIsSubmitting] = useState(false); // prevent double click

  // Define break rules here (since we're not fetching them from the backend)
  const breakRules = {
    morning: { start_time: "11:15:00", duration_minutes: 15 },
    lunch: { start_time: "13:30:00", duration_minutes: 30 },
    evening: { start_time: "17:45:00", duration_minutes: 15 },
  };

  // Function to fetch the user's attendance status for today
  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/empcrm/attendance?username=${username}`);
      if (!response.ok) {
        throw new Error("Failed to fetch attendance data.");
      }
      const data = await response.json();
      setAttendanceData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [username]);

  // Handle button clicks
  const handleAction = async (actionType) => {
    if (isSubmitting || locationLoading) return; // guard

    // Immediately clear all notifications when any action is taken
    setPreBreakTime(null);
    setEndBreakNotification(null);

    setIsSubmitting(true);

    // If the action is check-in or checkout, get location first
    if (actionType === "checkin" || actionType === "checkout") {
      setLocationLoading(true);
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        setLocationLoading(false);
        setIsSubmitting(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            await sendActionWithLocation(actionType, latitude, longitude);
          } finally {
            setLocationLoading(false);
            setIsSubmitting(false);
          }
        },
        (err) => {
          console.error("Location error:", err);
          alert(`Failed to get location: ${err.message}`);
          setLocationLoading(false);
          setIsSubmitting(false);
        }
      );
    } else {
      try {
        await sendActionWithLocation(actionType);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const sendActionWithLocation = async (actionType, latitude, longitude) => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000); // 20s safety timeout
      const response = await fetch("/api/empcrm/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          action: actionType,
          latitude,
          longitude,
        }),
        signal: controller.signal,
        keepalive: true,
      });
      clearTimeout(t);

      if (response.ok) {
        fetchAttendance();
      } else {
        console.error("Failed to perform action:", actionType);
      }
    } catch (error) {
      console.error("API call failed:", error);
    }
  };

  // Break Timer and Notification Logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      setPreBreakTime(null);
      setEndBreakNotification(null);

      if (attendanceData) {
        const {
          break_morning_start,
          break_lunch_start,
          break_evening_start,
          break_morning_end,
          break_lunch_end,
          break_evening_end,
        } = attendanceData;

        let currentBreak = null;
        if (break_morning_start && !break_morning_end) {
          currentBreak = "morning";
        } else if (break_lunch_start && !break_lunch_end) {
          currentBreak = "lunch";
        } else if (break_evening_start && !break_evening_end) {
          currentBreak = "evening";
        }

        if (currentBreak) {
          const startTime = new Date(
            attendanceData[`break_${currentBreak}_start`]
          );
          const elapsedTime = now.getTime() - startTime.getTime();
          setRemainingBreakTime(elapsedTime);

          const breakDurationMs =
            breakRules[currentBreak].duration_minutes * 60 * 1000;
          const breakEndTime = new Date(startTime.getTime() + breakDurationMs);
          const twoMinutesBeforeEnd = new Date(
            breakEndTime.getTime() - 2 * 60 * 1000
          );

          if (now > twoMinutesBeforeEnd && now < breakEndTime) {
            const timeToEnd = breakEndTime.getTime() - now.getTime();
            setEndBreakNotification({ breakName: currentBreak, timeToEnd });
          }
        } else {
          setRemainingBreakTime(null);
        }
      }

      if (
        !remainingBreakTime &&
        attendanceData &&
        attendanceData.checkin_time &&
        !attendanceData.checkout_time
      ) {
        for (const breakName in breakRules) {
          const rule = breakRules[breakName];
          const ruleStartTime = new Date(`${today}T${rule.start_time}`);
          const twoMinutesBefore = new Date(
            ruleStartTime.getTime() - 2 * 60 * 1000
          );

          if (now > twoMinutesBefore && now < ruleStartTime) {
            if (
              (breakName === "morning" &&
                !attendanceData.break_morning_start) ||
              (breakName === "lunch" &&
                !attendanceData.break_lunch_start &&
                attendanceData.break_morning_end) ||
              (breakName === "evening" &&
                !attendanceData.break_evening_start &&
                attendanceData.break_lunch_end)
            ) {
              const timeToStart = ruleStartTime.getTime() - now.getTime();
              setPreBreakTime({ breakName, timeToStart });
              return;
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [attendanceData, breakRules, remainingBreakTime]);

  // Helper function to format time
  const formatTime = (ms) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // --- UI Components for Different States ---
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-gray-600 font-medium">
          Loading attendance data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="bg-red-100 text-red-600 font-semibold p-4 rounded-lg shadow-md text-center">
          Error: {error}
        </div>
      </div>
    );
  }

  // Common button styles
  const buttonClass =
    "w-full py-3 text-sm font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md";

  // Conditional button rendering logic
  const renderActionButton = () => {
    const isBusy = isSubmitting || locationLoading;
    if (locationLoading) {
      return (
        <div className="text-center text-gray-700 font-semibold mb-2 p-3 bg-gray-200 rounded-lg animate-pulse">
          Getting your location...
        </div>
      );
    }

    if (!attendanceData) {
      return (
        <button
          onClick={() => handleAction("checkin")}
          disabled={isBusy}
          aria-busy={isBusy}
          className={`${buttonClass} bg-blue-600 text-white ${isBusy ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-700"}`}
        >
          {isBusy ? "Saving..." : "Check In"}
        </button>
      );
    }
    const {
      break_morning_start,
      break_morning_end,
      break_lunch_start,
      break_lunch_end,
      break_evening_start,
      break_evening_end,
      checkout_time,
    } = attendanceData;
    if (checkout_time) {
      return (
        <div className="text-center text-green-600 font-semibold p-4 bg-green-100 rounded-lg shadow-inner">
          You have checked out for the day. See you tomorrow!
        </div>
      );
    }
    const breakStartButton = (action, label) => (
      <button
        onClick={() => handleAction(action)}
        disabled={isBusy}
        aria-busy={isBusy}
        className={`${buttonClass} bg-yellow-500 text-gray-800 ${isBusy ? "opacity-60 cursor-not-allowed" : "hover:bg-yellow-600"}`}
      >
        {isBusy ? "Saving..." : `Start ${label}`}
      </button>
    );
    const breakEndButton = (action, label) => (
      <button
        onClick={() => handleAction(action)}
        disabled={isBusy}
        aria-busy={isBusy}
        className={`${buttonClass} bg-red-500 text-white ${isBusy ? "opacity-60 cursor-not-allowed" : "hover:bg-red-600"}`}
      >
        {isBusy ? "Saving..." : `End ${label}`}
      </button>
    );
    if (!break_morning_start) {
      return breakStartButton("break_morning", "Morning Break");
    }
    if (break_morning_start && !break_morning_end) {
      return (
        <>
          <div className="text-center text-gray-700 font-semibold mb-2">
            Break in progress: {formatTime(remainingBreakTime)}
          </div>
          {breakEndButton("end_morning", "Morning Break")}
        </>
      );
    }
    if (!break_lunch_start) {
      return breakStartButton("break_lunch", "Lunch Break");
    }
    if (break_lunch_start && !break_lunch_end) {
      return (
        <>
          <div className="text-center text-gray-700 font-semibold mb-2">
            Break in progress: {formatTime(remainingBreakTime)}
          </div>
          {breakEndButton("end_lunch", "Lunch Break")}
        </>
      );
    }
    if (!break_evening_start) {
      return breakStartButton("break_evening", "Evening Break");
    }
    if (break_evening_start && !break_evening_end) {
      return (
        <>
          <div className="text-center text-gray-700 font-semibold mb-2">
            Break in progress: {formatTime(remainingBreakTime)}
          </div>
          {breakEndButton("end_evening", "Evening Break")}
        </>
      );
    }
    return (
      <button
        onClick={() => handleAction("checkout")}
        disabled={isBusy}
        aria-busy={isBusy}
        className={`${buttonClass} bg-green-600 text-white ${isBusy ? "opacity-60 cursor-not-allowed" : "hover:bg-green-700"}`}
      >
        {isBusy ? "Saving..." : "Check Out"}
      </button>
    );
  };
  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 bg-white rounded-xl shadow-lg space-y-4">
        <h2 className="text-xl font-bold text-center text-gray-800">
          Attendance Tracker
        </h2>
        {endBreakNotification && (
          <div className="animate-pulse bg-red-100 text-red-700 border border-red-300 p-3 rounded-lg text-sm text-center">
            Your {endBreakNotification.breakName} break is ending in{" "}
            {formatTime(endBreakNotification.timeToEnd)}!
          </div>
        )}
        {preBreakTime && (
          <div className="animate-pulse bg-yellow-100 text-yellow-700 border border-yellow-300 p-3 rounded-lg text-sm text-center">
            {preBreakTime.breakName} break is starting in{" "}
            {formatTime(preBreakTime.timeToStart)}!
          </div>
        )}
        <div className="pt-2">{renderActionButton()}</div>
      </div>
    </div>
  );
};
export default AttendanceTracker;
