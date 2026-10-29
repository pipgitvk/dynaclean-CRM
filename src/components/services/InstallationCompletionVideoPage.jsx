"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Download, FileUp, Play, Square, Video } from "lucide-react";
import { generateServiceReportPDF, downloadPDF } from "@/utils/pdfGenerator";
import {
  buildPrefilledInstallationReportPdfPayload,
  installationReportPdfFilename,
} from "@/lib/buildServiceReportPdfPayload";

const RECORDING_DURATION = 45;

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
      else reject(new Error(data.message || "Could not save."));
    };
    xhr.onerror = () => reject(new Error("Could not save."));
    xhr.send(formData);
  });
}

function hasManualInstallationReport(installationReport) {
  const v = String(installationReport || "").trim();
  return Boolean(v && v !== "uploadFO");
}

function canOpenReport(data) {
  if (!data) return false;
  if (data.steps?.video_completion) return true;
  return hasManualInstallationReport(data.service?.installation_report);
}

export default function InstallationCompletionVideoPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const serviceId = params?.service_id;
  const dashboardBase = pathname?.split("/").filter(Boolean)[0] || "user-dashboard";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [downloadingBlank, setDownloadingBlank] = useState(false);
  const [manualFile, setManualFile] = useState(null);
  const [manualUploading, setManualUploading] = useState(false);
  const [manualProgress, setManualProgress] = useState(0);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const chunksRef = useRef([]);

  const reportHref = `/${dashboardBase}/complete-service/${serviceId}`;
  const listHref = `/${dashboardBase}/view_service_reports`;

  const goToReport = useCallback(() => {
    router.replace(reportHref);
  }, [router, reportHref]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/service-report-steps/${serviceId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to load service");
      if (String(body.service?.service_type || "").trim().toUpperCase() !== "INSTALLATION") {
        router.replace(reportHref);
        return;
      }
      if (canOpenReport(body)) {
        router.replace(reportHref);
        return;
      }
      setData(body);
    } catch (err) {
      setError(err.message || "Failed to load service");
    } finally {
      setLoading(false);
    }
  }, [serviceId, router, reportHref]);

  useEffect(() => {
    if (serviceId) load();
  }, [serviceId, load]);

  const downloadBlankReport = async () => {
    if (!data?.service) return;
    setDownloadingBlank(true);
    setError("");
    try {
      const { pdfData, productData, installData, trainees, isInstallationLayout } =
        buildPrefilledInstallationReportPdfPayload(
          data.service,
          data.product,
        );
      const pdf = await generateServiceReportPDF(
        pdfData,
        productData,
        installData,
        trainees,
        { isInstallationLayout },
      );
      downloadPDF(
        pdf,
        installationReportPdfFilename(
          data.service.service_id,
          isInstallationLayout,
        ),
      );
    } catch (err) {
      setError(err.message || "Could not generate blank report.");
    } finally {
      setDownloadingBlank(false);
    }
  };

  const onPickManualFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ok =
      file.type === "application/pdf" ||
      file.type.startsWith("image/") ||
      /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
    if (!ok) {
      setError("Choose a PDF or image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("Maximum file size is 25 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setManualFile(file);
  };

  const uploadManualReport = async () => {
    if (!manualFile) return;
    setManualUploading(true);
    setManualProgress(0);
    setError("");
    try {
      const formData = new FormData();
      formData.append("action", "manual_installation_report");
      formData.append("file", manualFile);
      await uploadWithProgress(
        `/api/service-report-steps/${serviceId}`,
        formData,
        setManualProgress,
      );
      goToReport();
    } catch (err) {
      setError(err.message || "Could not upload report.");
    } finally {
      setManualUploading(false);
      setManualProgress(0);
    }
  };

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        setPreview(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= RECORDING_DURATION) {
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

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

  const saveVideo = async () => {
    if (!recordedBlob) return;
    setError("");
    setIsSaving(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("action", "installation_completion_video");
      formData.append("file", recordedBlob, "installation-completion.webm");
      await uploadWithProgress(
        `/api/service-report-steps/${serviceId}`,
        formData,
        setUploadProgress,
      );
      goToReport();
    } catch (err) {
      setError(err.message || "Could not save video.");
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

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
        href={listHref}
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
          Save completion video or upload a manual report — either one opens the service report.
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
        <div className="mb-6">
          {isRecording || !recordedBlob ? (
            <div className="relative w-full overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} autoPlay playsInline className="h-auto max-h-96 w-full" />
              {isRecording && (
                <div className="absolute right-4 top-4 flex animate-pulse items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  Recording: {formatTime(recordingTime)}
                </div>
              )}
            </div>
          ) : (
            <video src={preview} controls className="h-auto max-h-96 w-full rounded-lg bg-black" />
          )}
        </div>

        {!recordedBlob ? (
          <div className="space-y-4">
            {!isRecording ? (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Play className="h-5 w-5" />
                  Start Recording (45 seconds)
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">or</span>
                  </div>
                </div>
                <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-green-300 bg-green-50 px-3 py-5 text-sm text-green-800 hover:bg-green-100">
                  <Video className="h-5 w-5" />
                  Upload Video
                  <input type="file" accept="video/*" className="hidden" onChange={onPickFile} />
                </label>
              </>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                disabled={recordingTime < 5}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Square className="h-5 w-5" />
                Stop Recording ({formatTime(recordingTime)} / {formatTime(RECORDING_DURATION)})
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800">✓ Video ready</p>
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
              {isSaving ? `Uploading ${uploadProgress}%` : "Save video & open report"}
            </button>
          </div>
        )}
      </div>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-gray-50 px-3 text-gray-500">Manual report</span>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Print &amp; fill report</h2>
        <p className="mt-1 text-sm text-gray-600">
          Download the same installation report PDF as complete-service (customer &amp; product prefilled), fill on site, then upload scan/photo.
        </p>
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={downloadBlankReport}
            disabled={downloadingBlank}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            <Download className="h-5 w-5" />
            {downloadingBlank ? "Preparing PDF…" : "Download installation report (PDF)"}
          </button>
          <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-5 text-sm text-amber-900 hover:bg-amber-100">
            <FileUp className="h-5 w-5" />
            {manualFile ? manualFile.name : "Choose filled report (PDF or image)"}
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={onPickManualFile} />
          </label>
          {manualFile && (
            <button
              type="button"
              disabled={manualUploading}
              onClick={uploadManualReport}
              className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {manualUploading
                ? `Uploading ${manualProgress}%`
                : "Upload manual report & open report"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
