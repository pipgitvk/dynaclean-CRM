"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Video, Play, Square } from "lucide-react";

const RECORDING_DURATION = 45; // 45 seconds

function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.message || "Could not save video."));
    };
    xhr.onerror = () => reject(new Error("Could not save video."));
    xhr.send(formData);
  });
}

export default function InstallationCompletionVideoPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params?.service_id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Video recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const chunksRef = useRef([]);

  const reportHref = `/admin-dashboard/complete-service/${serviceId}`;

  // Load service data
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/service-report-steps/${serviceId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to load service");
      if (String(body.service?.service_type || "").trim().toUpperCase() !== "INSTALLATION") {
        router.replace(`/admin-dashboard/complete-service/${serviceId}`);
        return;
      }
      setData(body);
    } catch (err) {
      setError(err.message || "Failed to load service");
    } finally {
      setLoading(false);
    }
  }, [serviceId, router]);

  useEffect(() => {
    if (serviceId) load();
  }, [serviceId, load]);

  // Start recording
  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        setPreview(URL.createObjectURL(blob));
        
        // Stop stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= RECORDING_DURATION) {
            // Auto-stop recording
            mediaRecorder.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return RECORDING_DURATION;
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setError(err.message || "Could not access camera.");
    }
  };

  // Stop recording manually
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Handle file upload
  const onPickFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|3gp|mkv|m4v|avi)$/i.test(file.name)) {
      setError("Choose a video file.");
      event.target.value = "";
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setError("Video is too large. Maximum size is 200 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setRecordedBlob(file);
    setPreview(URL.createObjectURL(file));
  };

  // Save video
  const saveVideo = async () => {
    if (!recordedBlob) return;

    setError("");
    setIsSaving(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("action", "installation_completion_video");
      formData.append("file", recordedBlob, "installation-completion.webm");

      const body = await uploadWithProgress(
        `/api/service-report-steps/${serviceId}`,
        formData,
        setUploadProgress,
      );

      setData(body);
      // Auto-redirect after successful save
      setTimeout(() => {
        router.push(reportHref);
      }, 1000);
    } catch (err) {
      setError(err.message || "Could not save video.");
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-sm text-gray-500">Loading service...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-sm text-red-600">Service not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link
        href="/admin-dashboard/view_service_reports"
        className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Service Reports
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          Installation Completion Video
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Record a 45-second video showing the installation is complete. The report form opens after.
        </p>
        {data?.service && (
          <div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <p>
              <span className="font-medium text-gray-500">Service ID:</span> {data.service.service_id}
            </p>
            <p>
              <span className="font-medium text-gray-500">Status:</span>{" "}
              <span
                className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                  String(data.service.status).toUpperCase() === "COMPLETED"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {data.service.status || "—"}
              </span>
            </p>
            <p>
              <span className="font-medium text-gray-500">Serial:</span> {data.service.serial_number || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-500">Type:</span> {data.service.service_type || "—"}
            </p>
            <p className="sm:col-span-2">
              <span className="font-medium text-gray-500">Machine:</span> {data.service.complaint_summary || "—"}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        {/* Live preview or recorded video */}
        <div className="mb-6">
          {isRecording || !recordedBlob ? (
            <div className="relative w-full bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto max-h-96"
              />
              {isRecording && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 text-sm font-semibold animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full" />
                  Recording: {formatTime(recordingTime)}
                </div>
              )}
            </div>
          ) : (
            <video
              src={preview}
              controls
              className="w-full h-auto max-h-96 rounded-lg bg-black"
            />
          )}
        </div>

        {/* Recording/Upload controls */}
        {!recordedBlob ? (
          <div className="space-y-4">
            {!isRecording ? (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Play className="h-5 w-5" />
                  Start Recording (45 seconds)
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>
                <label className="w-full flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-green-300 bg-green-50 px-3 py-5 text-sm text-green-800 hover:bg-green-100">
                  <Video className="h-5 w-5" />
                  Upload Video
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={onPickFile}
                  />
                </label>
              </>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                disabled={recordingTime < 5}
                className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Square className="h-5 w-5" />
                Stop Recording ({formatTime(recordingTime)} / {formatTime(RECORDING_DURATION)})
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-sm text-green-800 font-medium">✓ Video ready</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecordedBlob(null);
                setPreview(null);
                setRecordingTime(0);
              }}
              className="w-full rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Choose Another
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={saveVideo}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {isSaving ? `Uploading ${uploadProgress}%` : "Save & Continue to Report"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p>• Video should show the installation is complete and ready for use</p>
        <p>• Minimum 5 seconds, maximum 45 seconds</p>
        <p>• After saving, the report form will open automatically</p>
      </div>
    </div>
  );
}
