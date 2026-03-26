// src/components/AttendanceTracker.jsx
"use client";
import React, { useState, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Face-api.js model loader (singleton — loads once per browser session)
// ---------------------------------------------------------------------------
const FACE_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

let _faceapi = null;
let _loadPromise = null;

async function loadFaceDetection() {
  if (_faceapi) return _faceapi;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const faceapi = await import("face-api.js");
    await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
    _faceapi = faceapi;
    return faceapi;
  })();
  return _loadPromise;
}

// ---------------------------------------------------------------------------
// CameraCheckinModal
// ---------------------------------------------------------------------------
function CameraCheckinModal({ onVerified, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // status: "initializing" | "ready" | "detecting" | "error" | "verified"
  const [status, setStatus] = useState("initializing");
  const [message, setMessage] = useState("Starting camera…");

  useEffect(() => {
    let active = true;

    const init = async () => {
      // 1. Open front camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (active) {
          setStatus("error");
          setMessage(
            "Camera access denied. Please allow camera access and try again."
          );
        }
        return;
      }

      // 2. Load face-detection models
      if (active) setMessage("Loading face detection…");
      try {
        await loadFaceDetection();
        if (active) {
          setStatus("ready");
          setMessage("");
        }
      } catch {
        if (active) {
          setStatus("error");
          setMessage(
            "Failed to load face detection. Please check your internet connection and try again."
          );
        }
      }
    };

    init();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setStatus("detecting");
    setMessage("Verifying your face…");

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    // Draw without mirroring so face-api gets correct pixel data
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);

    try {
      const faceapi = await loadFaceDetection();
      const opts = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.45,
      });
      const detection = await faceapi.detectSingleFace(canvas, opts);

      if (!detection) {
        setStatus("error");
        setMessage(
          "No face detected. Please face the camera directly with good lighting and try again."
        );
        return;
      }

      const faceArea = detection.box.width * detection.box.height;
      const imageArea = w * h;
      const coverage = faceArea / imageArea;

      if (coverage < 0.5) {
        setStatus("error");
        setMessage(
          `Your face covers only ${Math.round(coverage * 100)}% of the photo. Please move closer to the camera — at least 50% coverage is required to check in.`
        );
        return;
      }

      // ✅ Face verified
      setStatus("verified");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setTimeout(onVerified, 700);
    } catch (e) {
      console.error("Face detection error:", e);
      setStatus("error");
      setMessage("Face detection failed. Please try again.");
    }
  };

  const handleRetry = () => {
    setStatus("ready");
    setMessage("");
  };

  const isInitializing = status === "initializing";
  const isReady = status === "ready";
  const isDetecting = status === "detecting";
  const isError = status === "error";
  const isVerified = status === "verified";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Face Verification
            </h3>
            <p className="text-xs text-gray-500">
              Your face must cover 50%+ of the frame
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isVerified}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-30"
          >
            ×
          </button>
        </div>

        {/* Camera viewport */}
        <div
          className="relative bg-gray-900 mx-5 rounded-xl overflow-hidden"
          style={{ aspectRatio: "4/3" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* Oval face-guide */}
          {(isReady || isDetecting) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`border-4 rounded-full transition-colors duration-300 ${
                  isDetecting
                    ? "border-yellow-400 animate-pulse"
                    : "border-white/70"
                }`}
                style={{
                  width: "60%",
                  height: "80%",
                  borderStyle: isReady ? "dashed" : "solid",
                }}
              />
            </div>
          )}

          {/* Initializing overlay */}
          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 gap-3">
              <div className="w-9 h-9 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm font-medium">{message}</p>
            </div>
          )}

          {/* Detecting overlay */}
          {isDetecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 gap-3">
              <div className="w-9 h-9 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm font-semibold">Analyzing…</p>
            </div>
          )}

          {/* Verified overlay */}
          {isVerified && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-900/50 gap-3">
              <div className="w-16 h-16 rounded-full bg-green-400 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                ✓
              </div>
              <p className="text-white font-bold text-xl">Verified!</p>
            </div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Status messages below camera */}
        <div className="px-5 pt-3 min-h-[48px]">
          {isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-red-700 text-xs text-center leading-relaxed">
                {message}
              </p>
            </div>
          )}
          {isReady && (
            <p className="text-gray-500 text-xs text-center">
              Align your face inside the oval, then tap{" "}
              <strong>Take Photo</strong>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 p-5">
          <button
            onClick={onCancel}
            disabled={isVerified}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={isError ? handleRetry : handleCapture}
            disabled={isInitializing || isDetecting || isVerified}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isInitializing
              ? "Loading…"
              : isDetecting
                ? "Verifying…"
                : isError
                  ? "Try Again"
                  : isVerified
                    ? "Verified!"
                    : "Take Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AttendanceTracker component
// ---------------------------------------------------------------------------
function isServiceEngineerRole(role) {
  return String(role ?? "").trim().toUpperCase() === "SERVICE ENGINEER";
}

const AttendanceTracker = ({ username, role }) => {
  const isServiceEngineer = isServiceEngineerRole(role);
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remainingBreakTime, setRemainingBreakTime] = useState(null);
  const [preBreakTime, setPreBreakTime] = useState(null);
  const [endBreakNotification, setEndBreakNotification] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const breakRules = {
    morning: { start_time: "11:15:00", duration_minutes: 15 },
    lunch: { start_time: "13:30:00", duration_minutes: 30 },
    evening: { start_time: "17:45:00", duration_minutes: 15 },
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/attendance?username=${username}`);
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

  // -------------------------------------------------------------------------
  // Location + API call (called after face verification for check-in, or
  // directly for checkout and other actions)
  // -------------------------------------------------------------------------
  const sendActionWithLocation = async (actionType, latitude, longitude) => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, action: actionType, latitude, longitude }),
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

  const getLocationAndSend = async (actionType) => {
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
  };

  // -------------------------------------------------------------------------
  // handleAction — check-in opens camera modal; everything else is unchanged
  // -------------------------------------------------------------------------
  const handleAction = async (actionType) => {
    if (isSubmitting || locationLoading) return;

    setPreBreakTime(null);
    setEndBreakNotification(null);
    setIsSubmitting(true);

    if (actionType === "checkin" && isServiceEngineer) {
      // Service engineers must verify face before check-in
      setShowCameraModal(true);
      // isSubmitting stays true while modal is open to block double-clicks
    } else if (actionType === "checkin") {
      // Other roles: direct check-in with location
      await getLocationAndSend(actionType);
    } else if (actionType === "checkout") {
      await getLocationAndSend(actionType);
    } else {
      try {
        await sendActionWithLocation(actionType);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Called by modal after successful face verification
  const handleFaceVerified = async () => {
    setShowCameraModal(false);
    await getLocationAndSend("checkin");
  };

  // Called when user cancels the camera modal
  const handleCameraCancel = () => {
    setShowCameraModal(false);
    setIsSubmitting(false);
  };

  // -------------------------------------------------------------------------
  // Break timer & notification logic (unchanged)
  // -------------------------------------------------------------------------
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

  const formatTime = (ms) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------
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

  const buttonClass =
    "w-full py-3 text-sm font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md";

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
    <>
      {/* Camera modal — rendered outside main card so it overlays everything */}
      {showCameraModal && (
        <CameraCheckinModal
          onVerified={handleFaceVerified}
          onCancel={handleCameraCancel}
        />
      )}

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
    </>
  );
};

export default AttendanceTracker;
