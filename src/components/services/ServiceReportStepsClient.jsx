"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronLeft, FileUp, Video } from "lucide-react";
import GoogleFeedbackProofCell from "@/components/services/GoogleFeedbackProofCell";
import {
  GOOGLE_FEEDBACK_COLLECTED_YES_NO,
  GOOGLE_FEEDBACK_COLLECTION_WHEN_YES,
  inferGoogleFeedbackCollectedYesNo,
  normalizeGoogleFeedbackCollection,
} from "@/lib/installationManualReportMeta";

const STEP_DEFS = [
  {
    key: "video_360",
    title: "360° video of machine with serial number",
    kind: "video",
    help: "Record a full 360° walk-around of the machine. The serial number must be clearly visible in the video.",
  },
  {
    key: "video_problem",
    title: "Problem showing video",
    kind: "video",
    help: "Record a video that shows the problem on the machine.",
  },
  {
    key: "video_damaged",
    title: "Damaged parts video",
    kind: "video",
    help: "Record a video of the damaged parts.",
  },
  {
    key: "work_start",
    title: "Work start",
    kind: "start",
    help: "Start the work. The service status will change to WORKED, and the Work Completed button will appear.",
  },
  {
    key: "work_complete",
    title: "Work completed",
    kind: "complete",
    help: "Status is WORKED. Tap Work Completed when the job on the machine is finished.",
  },
  {
    key: "video_completion",
    title: "Completion video",
    kind: "video",
    help: "Record a video of the machine after the work is finished.",
  },
  {
    key: "google_feedback",
    title: "Google feedback",
    kind: "google_feedback",
    help: "Record whether Google feedback was collected. Upload a screenshot or photo when the answer is Yes.",
  },
];

function isGoogleFeedbackStepDone(service) {
  const collected = inferGoogleFeedbackCollectedYesNo(
    service?.google_feedback_collection,
    service?.google_feedback_collected,
  );
  if (!collected) return false;
  if (collected === "no") return true;
  return Boolean(String(service?.google_feedback_proof || "").trim());
}

function isStepDone(steps, key, service) {
  if (!steps) return false;
  if (key === "google_feedback") return isGoogleFeedbackStepDone(service);
  if (key === "work_start") return Boolean(steps.work_started_at);
  if (key === "work_complete") return Boolean(steps.work_completed_at);
  return Boolean(steps[key]);
}

function firstOpenIndex(steps, service) {
  const index = STEP_DEFS.findIndex((step) => !isStepDone(steps, step.key, service));
  return index === -1 ? STEP_DEFS.length : index;
}

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
      else reject(new Error(data.message || "Could not save this step."));
    };
    xhr.onerror = () => reject(new Error("Could not save this step."));
    xhr.send(formData);
  });
}

function syncGoogleFeedbackForm(service, setters) {
  const svc = service || {};
  setters.setGoogleFeedbackCollected(
    inferGoogleFeedbackCollectedYesNo(
      svc.google_feedback_collection,
      svc.google_feedback_collected,
    ) || "",
  );
  setters.setGoogleFeedbackCollection(
    normalizeGoogleFeedbackCollection(svc.google_feedback_collection) || "",
  );
  setters.setExistingGoogleFeedbackProof(String(svc.google_feedback_proof || "").trim());
  setters.setGoogleFeedbackFile(null);
}

export default function ServiceReportStepsClient({ dashboardBase = "user-dashboard" }) {
  const params = useParams();
  const router = useRouter();
  const serviceId = params?.service_id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyKey, setBusyKey] = useState("");
  const [progress, setProgress] = useState(0);
  const [picked, setPicked] = useState(null);

  const [googleFeedbackCollected, setGoogleFeedbackCollected] = useState("");
  const [googleFeedbackCollection, setGoogleFeedbackCollection] = useState("");
  const [googleFeedbackFile, setGoogleFeedbackFile] = useState(null);
  const [existingGoogleFeedbackProof, setExistingGoogleFeedbackProof] = useState("");

  const reportHref = `/${dashboardBase}/complete-service/${serviceId}`;
  const listHref = `/${dashboardBase}/view_service_reports`;

  const applyPayload = useCallback((body) => {
    setData(body);
    syncGoogleFeedbackForm(body.service, {
      setGoogleFeedbackCollected,
      setGoogleFeedbackCollection,
      setExistingGoogleFeedbackProof,
      setGoogleFeedbackFile,
    });
    setActiveIndex(firstOpenIndex(body.steps, body.service));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/service-report-steps/${serviceId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to load steps");
      if (String(body.service?.service_type || "").trim().toUpperCase() !== "COMPLAINT") {
        router.replace(`/${dashboardBase}/complete-service/${serviceId}`);
        return;
      }
      applyPayload(body);
    } catch (err) {
      setError(err.message || "Failed to load steps");
    } finally {
      setLoading(false);
    }
  }, [serviceId, router, dashboardBase, applyPayload]);

  useEffect(() => {
    if (serviceId) load();
  }, [serviceId, load]);

  const openIndex = useMemo(
    () => firstOpenIndex(data?.steps, data?.service),
    [data],
  );
  const allDone = openIndex >= STEP_DEFS.length;

  const saveAction = async (action, file) => {
    setError("");
    setBusyKey(action);
    setProgress(file ? 1 : 0);
    try {
      const formData = new FormData();
      formData.append("action", action);
      if (file) formData.append("file", file);
      const body = await uploadWithProgress(
        `/api/service-report-steps/${serviceId}`,
        formData,
        setProgress,
      );
      applyPayload(body);
      setPicked(null);
    } catch (err) {
      setError(err.message || "Could not save this step.");
    } finally {
      setBusyKey("");
      setProgress(0);
    }
  };

  const saveGoogleFeedback = async () => {
    setError("");
    if (!googleFeedbackCollected) {
      setError("Select Yes or No for Google feedback collected.");
      return;
    }
    if (googleFeedbackCollected === "yes") {
      if (!googleFeedbackCollection) {
        setError("Select Google feedback collection status.");
        return;
      }
      if (!googleFeedbackFile && !existingGoogleFeedbackProof) {
        setError("Upload Google feedback proof (mandatory when Yes).");
        return;
      }
    }

    setBusyKey("google_feedback");
    setProgress(googleFeedbackFile ? 1 : 0);
    try {
      const formData = new FormData();
      formData.append("action", "google_feedback");
      formData.append("google_feedback_collected", googleFeedbackCollected);
      formData.append("google_feedback_collection", googleFeedbackCollection);
      if (googleFeedbackFile) {
        formData.append("google_feedback_file", googleFeedbackFile);
      }
      const body = await uploadWithProgress(
        `/api/service-report-steps/${serviceId}`,
        formData,
        setProgress,
      );
      applyPayload(body);
    } catch (err) {
      setError(err.message || "Could not save Google feedback.");
    } finally {
      setBusyKey("");
      setProgress(0);
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
    setPicked({ file, preview: URL.createObjectURL(file) });
  };

  const onPickGoogleFeedbackFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ok =
      file.type === "application/pdf" ||
      String(file.type || "").startsWith("image/") ||
      /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
    if (!ok) {
      setError("Choose a PDF or image for Google feedback.");
      event.target.value = "";
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File is too large. Maximum size is 25 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setGoogleFeedbackFile(file);
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <Link
        href={listHref}
        className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Service Reports
      </Link>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Service report steps</h1>
        <p className="mt-1 text-sm text-gray-500">
          Complete these 7 steps on site. The add report form opens after Google feedback.
        </p>
        {data?.service && (
          <div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <p>
              <span className="font-medium text-gray-500">Service ID:</span>{" "}
              {data.service.service_id}
            </p>
            <p>
              <span className="font-medium text-gray-500">Status:</span>{" "}
              <span
                className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                  String(data.service.status).toUpperCase() === "WORKED"
                    ? "bg-amber-100 text-amber-800"
                    : String(data.service.status).toUpperCase() === "COMPLETED"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                }`}
              >
                {data.service.status || "—"}
              </span>
            </p>
            <p>
              <span className="font-medium text-gray-500">Serial:</span>{" "}
              {data.service.serial_number || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-500">Type:</span>{" "}
              {data.service.service_type || "—"}
            </p>
            <p className="sm:col-span-2">
              <span className="font-medium text-gray-500">Complaint:</span>{" "}
              {data.service.complaint_summary || "—"}
            </p>
            {isGoogleFeedbackStepDone(data.service) ? (
              <div className="sm:col-span-2 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                  Google feedback saved
                </p>
                <div className="mt-1">
                  <GoogleFeedbackProofCell
                    record={data.service}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading steps…</p>}
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && data && (
        <ol className="space-y-3">
          {STEP_DEFS.map((step, index) => {
            const done = isStepDone(data.steps, step.key, data.service);
            const locked = index > openIndex;
            const isActiveCard =
              !locked &&
              index === (activeIndex >= STEP_DEFS.length ? STEP_DEFS.length - 1 : activeIndex);

            return (
              <li key={step.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setPicked(null);
                    setActiveIndex(index);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      done
                        ? "bg-green-600 text-white"
                        : isActiveCard
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">{step.title}</span>
                    <span className="block text-xs text-gray-500">
                      {done ? "Done" : locked ? "Locked" : index === openIndex ? "Current step" : "Open"}
                    </span>
                  </span>
                </button>

                {isActiveCard && (
                  <div className="border-t border-gray-100 px-4 py-4">
                    <p className="mb-4 text-sm text-gray-600">{step.help}</p>

                    {step.kind === "video" && (
                      <div className="space-y-3">
                        {(picked?.preview || data.steps[step.key]) && (
                          <video
                            key={picked?.preview || data.steps[step.key]}
                            src={picked?.preview || data.steps[step.key]}
                            controls
                            className="max-h-72 w-full rounded-lg bg-black"
                          />
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-5 text-sm text-blue-800 hover:bg-blue-100">
                            <Video className="h-5 w-5" />
                            Record video
                            <input
                              type="file"
                              accept="video/*"
                              capture="environment"
                              className="hidden"
                              onChange={onPickFile}
                            />
                          </label>
                          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-5 text-sm text-blue-800 hover:bg-blue-100">
                            <Video className="h-5 w-5" />
                            Choose video
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={onPickFile}
                            />
                          </label>
                        </div>
                        {picked && (
                          <button
                            type="button"
                            disabled={Boolean(busyKey)}
                            onClick={() => saveAction(step.key, picked.file)}
                            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                          >
                            {busyKey === step.key ? `Uploading ${progress}%` : "Save video"}
                          </button>
                        )}
                        {done && (
                          <button
                            type="button"
                            onClick={() => {
                              setPicked(null);
                              setActiveIndex(index + 1);
                            }}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Next step
                          </button>
                        )}
                      </div>
                    )}

                    {step.kind === "start" && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          disabled={Boolean(busyKey) || done}
                          onClick={() => saveAction("work_start")}
                          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {done
                            ? "Work started — status WORKED"
                            : busyKey === "work_start"
                              ? "Saving…"
                              : "Start Work"}
                        </button>
                        {done && (
                          <button
                            type="button"
                            onClick={() => setActiveIndex(index + 1)}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Next step
                          </button>
                        )}
                      </div>
                    )}

                    {step.kind === "complete" && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-amber-800">Status: WORKED</p>
                        <button
                          type="button"
                          disabled={Boolean(busyKey) || done || !data.steps.work_started_at}
                          onClick={() => saveAction("work_complete")}
                          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          {done
                            ? "Work completed"
                            : busyKey === "work_complete"
                              ? "Saving…"
                              : "Work Completed"}
                        </button>
                        {done && (
                          <button
                            type="button"
                            onClick={() => setActiveIndex(index + 1)}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Next step
                          </button>
                        )}
                      </div>
                    )}

                    {step.kind === "google_feedback" && (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-gray-700">
                            Google feedback collected? <span className="text-red-500">*</span>
                          </span>
                          <select
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                            value={googleFeedbackCollected}
                            onChange={(e) => {
                              const v = e.target.value;
                              setGoogleFeedbackCollected(v);
                              if (v !== "yes") {
                                setGoogleFeedbackCollection("");
                                setGoogleFeedbackFile(null);
                              }
                            }}
                          >
                            {GOOGLE_FEEDBACK_COLLECTED_YES_NO.map((opt) => (
                              <option key={opt.value || "select"} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        {googleFeedbackCollected === "yes" ? (
                          <>
                            <label className="block">
                              <span className="mb-1 block text-sm font-medium text-gray-700">
                                Google feedback collection <span className="text-red-500">*</span>
                              </span>
                              <select
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                                value={googleFeedbackCollection}
                                onChange={(e) => setGoogleFeedbackCollection(e.target.value)}
                              >
                                {GOOGLE_FEEDBACK_COLLECTION_WHEN_YES.map((opt) => (
                                  <option key={opt.value || "select"} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="space-y-2">
                              <span className="mb-1 block text-sm font-medium text-gray-700">
                                Upload Google feedback proof <span className="text-red-500">*</span>
                              </span>
                              <p className="text-xs text-gray-500">
                                Screenshot or photo of collected Google review/feedback (PDF or image).
                              </p>
                              {existingGoogleFeedbackProof && !googleFeedbackFile ? (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                  <p className="text-xs font-medium text-emerald-800">Current upload</p>
                                  <GoogleFeedbackProofCell
                                    record={{
                                      ...data.service,
                                      google_feedback_collected: "yes",
                                      google_feedback_proof: existingGoogleFeedbackProof,
                                    }}
                                  />
                                </div>
                              ) : null}
                              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50 px-3 py-4 text-sm text-violet-900 hover:bg-violet-100">
                                <FileUp className="h-5 w-5" />
                                {googleFeedbackFile
                                  ? googleFeedbackFile.name
                                  : "Choose Google feedback file (PDF or image)"}
                                <input
                                  type="file"
                                  accept=".pdf,image/*"
                                  className="hidden"
                                  onChange={onPickGoogleFeedbackFile}
                                />
                              </label>
                            </div>
                          </>
                        ) : null}

                        <button
                          type="button"
                          disabled={Boolean(busyKey)}
                          onClick={saveGoogleFeedback}
                          className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                        >
                          {busyKey === "google_feedback"
                            ? `Saving ${progress}%`
                            : done
                              ? "Update Google feedback"
                              : "Save Google feedback"}
                        </button>
                        {done && (
                          <button
                            type="button"
                            onClick={() => router.push(reportHref)}
                            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
                          >
                            Add Report
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {allDone && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">
            All 7 steps are done. Continue to the service report form.
          </p>
          <button
            type="button"
            onClick={() => router.push(reportHref)}
            className="mt-3 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Add Report
          </button>
        </div>
      )}
    </div>
  );
}