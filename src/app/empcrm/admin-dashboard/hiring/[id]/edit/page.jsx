"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { HIRING_TAG_OPTIONS as TAG_OPTIONS, HR_SCORE_RATING_OPTIONS, HAVE_NOT_TALKED_REASONS } from "@/lib/hiringPayload";
import { mergeDesignationOptions } from "@/lib/designationDedupe";
import {
  EXPERIENCE_OPTIONS,
  fieldClass,
  formFieldClass,
  formSelectClass,
  hiringStatusSelectOptions,
  INTERVIEW_MODE_OPTIONS,
  MARITAL_OPTIONS,
  toDatetimeLocalValue,
} from "@/app/admin-dashboard/hiring-process/shared";

const HR_SCORE_RATING_LABELS = {
  average: "Average",
  poor: "Poor",
  good: "Good",
  "very-good": "Very good",
};

export default function EmpcrmHiringEditPage() {
  const router = useRouter();
  const params = useParams();
  const idRaw = params?.id;
  const entryId = idRaw != null ? parseInt(String(idRaw), 10) : NaN;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [resumeUploadBusy, setResumeUploadBusy] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState(null);
  /** @type {null | Record<string, any>} */
  const [editing, setEditing] = useState(null);
  const [designationOptions, setDesignationOptions] = useState([]);
  const [loadingDesignations, setLoadingDesignations] = useState(true);

  const editFormDesignations = useMemo(
    () => mergeDesignationOptions(designationOptions, editing?.designation),
    [designationOptions, editing?.designation]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDesignations(true);
      try {
        const res = await fetch("/api/empcrm/hiring-designations", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.success) {
          setDesignationOptions(Array.isArray(json.designations) ? json.designations : []);
        }
      } catch {
        if (!cancelled) setDesignationOptions([]);
      } finally {
        if (!cancelled) setLoadingDesignations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResumeFile = useCallback(async (file, applyUrl) => {
    if (!file) return;
    setResumeUploadBusy(true);
    setResumeUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/empcrm/hiring/upload-resume", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Upload failed");
      const url = String(json.url || "").trim();
      if (!url) throw new Error("Invalid response");
      applyUrl(url);
    } catch (e) {
      setResumeUploadError(e.message || "Upload failed");
    } finally {
      setResumeUploadBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!Number.isFinite(entryId) || entryId < 1) {
      setError("Invalid record.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/empcrm/hiring?entryId=${entryId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success || !json.entry) {
        setError(json.error || "Failed to load record");
        setEditing(null);
        return;
      }
      const row = json.entry;
      setEditing({
        id: row.id,
        created_by: row.created_by ?? "",
        creator_name: row.creator_name ?? row.created_by ?? "",
        creator_role: row.creator_role ?? "",
        candidate_name: row.candidate_name ?? "",
        emp_contact: row.emp_contact ?? "",
        designation: row.designation ?? "",
        marital_status: row.marital_status ?? "",
        experience_type: row.experience_type ?? "",
        interview_at: toDatetimeLocalValue(row.interview_at),
        rescheduled_at: toDatetimeLocalValue(row.rescheduled_at),
        next_followup_at: toDatetimeLocalValue(row.next_followup_at),
        interview_mode: row.interview_mode ?? "",
        status: row.status || "Shortlisted",
        tag: row.tag ?? "",
        hire_date: row.hire_date ? String(row.hire_date).slice(0, 10) : "",
        offerPackage: row.package ?? "",
        probationMonths:
          row.probation_months != null && row.probation_months !== "" ? String(row.probation_months) : "",
        selectedResume: row.selected_resume ?? "",
        mgmtInterviewScore:
          row.mgmt_interview_score != null && row.mgmt_interview_score !== "" ? String(row.mgmt_interview_score) : "",
        hrInterviewScore:
          row.hr_interview_score != null && row.hr_interview_score !== "" ? String(row.hr_interview_score) : "",
        hrScoreRating: row.hr_score_rating != null ? String(row.hr_score_rating) : "",
        currentSalary: row.current_salary ?? "",
        expectedSalary: row.expected_salary ?? "",
        current_location: row.current_location ?? "",
        note: row.note ?? "",
      });
    } catch (e) {
      setError(e.message || "Network error");
      setEditing(null);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateEdit = (key, value) => {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setEditSaving(true);
    setError(null);
    try {
      const hired = editing.status === "Hired";
      const rescheduled = editing.status === "Rescheduled";
      const nextFollowUp = editing.status === "next-follow-up";
      const hiredFollowUpTag = hired && editing.tag === "Follow-Up";
      const res = await fetch("/api/empcrm/hiring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          candidate_name: editing.candidate_name,
          emp_contact: editing.emp_contact,
          designation: editing.designation,
          marital_status: editing.marital_status || null,
          experience_type: editing.experience_type || null,
          interview_at: editing.interview_at || null,
          rescheduled_at: rescheduled ? editing.rescheduled_at || null : null,
          next_followup_at: (editing.status !== "Rejected" && editing.status !== "Reject")
            ? editing.next_followup_at || null
            : null,
          interview_mode: editing.interview_mode || null,
          status: editing.status,
          tag: hired ? editing.tag || null : editing.status === "Have not talked" ? editing.tag || null : null,
          hire_date: hired ? editing.hire_date || null : null,
          package: hired ? String(editing.offerPackage || "").trim() || null : null,
          probation_months:
            hired && editing.tag === "Probation" && editing.probationMonths !== ""
              ? Number(editing.probationMonths)
              : null,
          selected_resume: editing.selectedResume?.trim() || null,
          mgmt_interview_score:
            editing.mgmtInterviewScore !== "" ? Number(editing.mgmtInterviewScore) : null,
          hr_interview_score: editing.hrInterviewScore !== "" ? Number(editing.hrInterviewScore) : null,
          hr_score_rating: editing.hrScoreRating?.trim() || null,
          current_salary: editing.currentSalary?.trim() || null,
          expected_salary: editing.expectedSalary?.trim() || null,
          current_location: editing.current_location?.trim() || null,
          note: editing.note,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Update failed");
        return;
      }
      router.push("/empcrm/admin-dashboard/hiring");
      router.refresh();
    } catch (err) {
      setError(err.message || "Network error");
    } finally {
      setEditSaving(false);
    }
  };

  const backHref = "/empcrm/admin-dashboard/hiring";

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        )}
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to list
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-indigo-50/30 px-4 py-3.5 sm:px-5 sm:py-4">
          <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
            Follow-up <span className="font-normal text-slate-500">#{editing.id}</span>
          </h1>
          <p className="mt-0.5 text-sm font-medium text-slate-800">{editing.candidate_name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Same layout as <span className="font-medium text-slate-700">Add employee</span>: candidate details and scores,
            then status, then sections for that status (reschedule, hired, selected resume, etc.).
          </p>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-900 sm:px-5">{error}</div>
        )}

        <form
          onSubmit={handleEditSubmit}
          className="space-y-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 sm:pb-6"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-2.5 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-indigo-700/80">ID</span>
              <span className="text-sm font-semibold tabular-nums text-indigo-950">{editing.id}</span>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Emp name *</label>
              <input
                required
                value={editing.candidate_name}
                onChange={(e) => updateEdit("candidate_name", e.target.value)}
                className={formFieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Emp contact *</label>
              <input
                required
                type="tel"
                value={editing.emp_contact}
                onChange={(e) => updateEdit("emp_contact", e.target.value)}
                className={formFieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Designation *</label>
              <select
                required
                value={editing.designation ?? ""}
                onChange={(e) => updateEdit("designation", e.target.value)}
                disabled={loadingDesignations}
                className={formSelectClass}
              >
                <option value="">{loadingDesignations ? "Loading designations…" : "— Select designation —"}</option>
                {editFormDesignations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {!["Toggle", "Talked", "Have not talked", "Didn't receive the call", "Cut the call", "Not reachable", "next-follow-up", "follow-up"].includes(editing.status) && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">HR Interview Score (1–10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editing.hrInterviewScore ?? ""}
                    onChange={(e) => updateEdit("hrInterviewScore", e.target.value)}
                    className={`max-w-[160px] ${formFieldClass}`}
                    placeholder="1 – 10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">HR score</label>
                  <select
                    value={editing.hrScoreRating ?? ""}
                    onChange={(e) => updateEdit("hrScoreRating", e.target.value)}
                    className={formSelectClass}
                  >
                    <option value="">— Select —</option>
                    {HR_SCORE_RATING_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {HR_SCORE_RATING_LABELS[v] ?? v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Current Salary</label>
                  <input
                    type="text"
                    value={editing.currentSalary ?? ""}
                    onChange={(e) => updateEdit("currentSalary", e.target.value)}
                    className={formFieldClass}
                    placeholder="e.g. 25000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Expected salary</label>
                  <input
                    type="text"
                    value={editing.expectedSalary ?? ""}
                    onChange={(e) => updateEdit("expectedSalary", e.target.value)}
                    className={formFieldClass}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Marital status</label>
                  <select
                    value={editing.marital_status ?? ""}
                    onChange={(e) => updateEdit("marital_status", e.target.value)}
                    className={formSelectClass}
                  >
                    <option value="">— Select —</option>
                    {MARITAL_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Experience / Fresher</label>
                  <select
                    value={editing.experience_type ?? ""}
                    onChange={(e) => updateEdit("experience_type", e.target.value)}
                    className={formSelectClass}
                  >
                    <option value="">— Select —</option>
                    {EXPERIENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Interview date &amp; time</label>
                  <input
                    type="datetime-local"
                    value={editing.interview_at ?? ""}
                    onChange={(e) => updateEdit("interview_at", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mode of interview</label>
                  <select
                    value={editing.interview_mode ?? ""}
                    onChange={(e) => updateEdit("interview_mode", e.target.value)}
                    className={formSelectClass}
                  >
                    <option value="">— Select —</option>
                    {INTERVIEW_MODE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Current location</label>
                  <input
                    type="text"
                    value={editing.current_location ?? ""}
                    onChange={(e) => updateEdit("current_location", e.target.value)}
                    className={formFieldClass}
                    placeholder="e.g. Mumbai, Delhi"
                  />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Status *</label>
              <select
                required
                value={editing.status}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditing((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev, status: v };
                    if (v !== "Hired") {
                      next.tag = "";
                    }
                    if (v !== "Hired") {
                      next.hire_date = "";
                      next.offerPackage = "";
                      next.probationMonths = "";
                    }
                    if (v !== "Rescheduled") next.rescheduled_at = "";
                    if (v === "Rejected" || v === "Reject") next.next_followup_at = "";
                    return next;
                  });
                }}
                className={`w-full max-w-full sm:max-w-md ${fieldClass} min-h-[44px]`}
              >
                {hiringStatusSelectOptions(editing?.status).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {editing.status === "Rescheduled" && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Rescheduled date &amp; time *</label>
                <input
                  type="datetime-local"
                  required={editing.status === "Rescheduled"}
                  value={editing.rescheduled_at}
                  onChange={(e) => updateEdit("rescheduled_at", e.target.value)}
                  className={formFieldClass}
                />
              </div>
            )}

            {editing.status !== "Rejected" && editing.status !== "Reject" && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Next follow-up date &amp; time *</label>
                <input
                  type="datetime-local"
                  required={editing.status !== "Rejected" && editing.status !== "Reject"}
                  value={editing.next_followup_at ?? ""}
                  onChange={(e) => updateEdit("next_followup_at", e.target.value)}
                  className={formFieldClass}
                />
              </div>
            )}

            {editing.status === "Hired" && (
              <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 sm:col-span-2">
                <p className="text-sm font-semibold text-indigo-900">Hired — joining &amp; package</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Joining date *</label>
                    <input
                      type="date"
                      required={editing.status === "Hired"}
                      value={editing.hire_date}
                      onChange={(e) => updateEdit("hire_date", e.target.value)}
                      className={formFieldClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Package *</label>
                    <input
                      type="text"
                      required={editing.status === "Hired"}
                      value={editing.offerPackage}
                      onChange={(e) => updateEdit("offerPackage", e.target.value)}
                      className={formFieldClass}
                      placeholder="e.g. CTC, LPA"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tags *</label>
                    <select
                      required={editing.status === "Hired"}
                      value={editing.tag}
                      onChange={(e) => {
                        const t = e.target.value;
                        setEditing((prev) =>
                          prev
                            ? {
                                ...prev,
                                tag: t,
                                probationMonths: t !== "Probation" ? "" : prev.probationMonths,
                                next_followup_at: t !== "Follow-Up" ? "" : prev.next_followup_at,
                              }
                            : prev
                        );
                      }}
                      className={`w-full max-w-full sm:max-w-md ${fieldClass} min-h-[44px]`}
                    >
                      <option value="">— Select —</option>
                      {TAG_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {editing.status === "Hired" && editing.tag === "Follow-Up" && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Follow-up date &amp; time (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={editing.next_followup_at ?? ""}
                        onChange={(e) => updateEdit("next_followup_at", e.target.value)}
                        className={formFieldClass}
                      />
                    </div>
                  )}
                  {editing.tag === "Probation" && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Probation (months) *</label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        required
                        value={editing.probationMonths}
                        onChange={(e) => updateEdit("probationMonths", e.target.value)}
                        className={`max-w-[200px] ${formFieldClass}`}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {!["Toggle", "Talked", "Have not talked", "Didn't receive the call", "Cut the call", "Not reachable", "next-follow-up", "follow-up"].includes(editing.status) && (
              <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 sm:col-span-2">
                <p className="text-sm font-semibold text-indigo-900">Selected — resume &amp; score</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="empcrm-hiring-resume-edit">
                      Resume {editing.status === "Selected" && "*"}
                    </label>
                    <input
                      id="empcrm-hiring-resume-edit"
                      type="file"
                      accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
                      disabled={resumeUploadBusy || editSaving}
                      className={`${formFieldClass} py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-800`}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        await handleResumeFile(f, (url) => updateEdit("selectedResume", url));
                      }}
                    />
                    {editing.selectedResume ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <a
                          href={editing.selectedResume}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-indigo-700 underline"
                        >
                          View uploaded file
                        </a>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => {
                            updateEdit("selectedResume", "");
                            setResumeUploadError(null);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                    {resumeUploadBusy ? <p className="mt-1 text-xs text-slate-500">Uploading…</p> : null}
                    {resumeUploadError ? <p className="mt-1 text-xs text-red-600">{resumeUploadError}</p> : null}
                    <p className="mt-1 text-[11px] text-slate-500">PDF, Word, or image — max 8 MB</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Management Interview Score (1–10) {editing.status === "Selected" && "*"}
                    </label>
                    <input
                      required={editing.status === "Selected"}
                      type="number"
                      min={1}
                      max={10}
                      value={editing.mgmtInterviewScore ?? ""}
                      onChange={(e) => updateEdit("mgmtInterviewScore", e.target.value)}
                      className={`max-w-[160px] ${formFieldClass}`}
                      placeholder="1 – 10"
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note *</label>
            <input
              required
              value={editing.note}
              onChange={(e) => updateEdit("note", e.target.value)}
              className={formFieldClass}
              placeholder="Enter note"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end sm:gap-3">
            <Link
              href={backHref}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={editSaving}
              className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
            >
              {editSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
