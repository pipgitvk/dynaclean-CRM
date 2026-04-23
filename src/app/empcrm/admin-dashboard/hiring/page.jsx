"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Filter, Loader2, Pencil, UserPlus, X } from "lucide-react";
import { HR_SCORE_RATING_OPTIONS, HIRING_TAG_OPTIONS as TAG_OPTIONS, HAVE_NOT_TALKED_REASONS } from "@/lib/hiringPayload";
import { HR_TARGET_ALLOWED_DESIGNATIONS, mergeDesignationOptions, normalizeDesignationKey, resolveCanonicalDesignation } from "@/lib/designationDedupe";

/** Shared field styles */
const fieldClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400";
const filterSelectClass = `w-full ${fieldClass} min-h-[44px]`;
const formFieldClass = `w-full ${fieldClass}`;
const formSelectClass = `w-full ${fieldClass} min-h-[44px] text-slate-900`;

const STATUS_OPTIONS = [
  "Toggle",
  "Talked",
  "Didn't receive the call",
  "Cut the call",
  "Not reachable",
  "Shortlisted",
  "Selected",
  "Negotiation",
  "Hold",
  "Backup",
  "Hired",
  "Rejected",
];

/** Legacy statuses that may exist in DB — shown in dropdown only when the row already has one. */
const LEGACY_STATUSES = [
  "Have not talked",
  "Shortlisted for interview",
  "Rescheduled",
  "next-follow-up",
  "follow-up",
  "Waiting List",
  "Reject",
];

function hiringStatusSelectOptions(rowStatus) {
  const s = String(rowStatus || "").trim();
  if (s && !STATUS_OPTIONS.includes(s) && LEGACY_STATUSES.includes(s)) {
    return [...STATUS_OPTIONS, s];
  }
  return STATUS_OPTIONS;
}

const MARITAL_OPTIONS = ["Unmarried", "Married"];

const EXPERIENCE_OPTIONS = [
  { value: "fresher", label: "Fresher" },
  { value: "experience", label: "Experience" },
];

const INTERVIEW_MODE_OPTIONS = ["Virtual", "Walk-in"];

const HR_SCORE_RATING_LABELS = {
  average: "Average",
  poor: "Poor",
  good: "Good",
  "very-good": "Very good",
};

const FILTER_STORAGE_KEY = "empcrm-hiring-filters-v1";

const readStoredFilters = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

function formatInterviewAt(v) {
  if (!v) return "—";
  try {
    const s = String(v).replace("Z", "");
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.slice(0, 16);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const STATUS_CHIP_STYLES = {
  Toggle:        "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  Talked:        "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  "Follow-up":   "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  "Didn't receive the call": "bg-gray-100 text-gray-700 border-gray-300 ring-1 ring-gray-400/20",
  "Cut the call": "bg-gray-100 text-gray-700 border-gray-300 ring-1 ring-gray-400/20",
  "Not reachable": "bg-gray-100 text-gray-700 border-gray-300 ring-1 ring-gray-400/20",
  "Have not talked": "bg-gray-100 text-gray-700 border-gray-300 ring-1 ring-gray-400/20",
  Shortlisted:   "bg-sky-50 text-sky-900 border-sky-200 ring-1 ring-sky-500/15",
  Selected:      "bg-indigo-50 text-indigo-900 border-indigo-200 ring-1 ring-indigo-500/15",
  Negotiation:   "bg-orange-50 text-orange-900 border-orange-200 ring-1 ring-orange-500/15",
  Hold:          "bg-yellow-50 text-yellow-900 border-yellow-200 ring-1 ring-yellow-500/15",
  Backup:        "bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-400/20",
  Hired:         "bg-emerald-50 text-emerald-900 border-emerald-200 ring-1 ring-emerald-500/20",
  Rejected:      "bg-red-50 text-red-900 border-red-200 ring-1 ring-red-500/15",
  // Legacy — old rows still render with correct colours
  "Shortlisted for interview": "bg-sky-50 text-sky-900 border-sky-200 ring-1 ring-sky-500/15",
  Rescheduled:   "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  "next-follow-up": "bg-cyan-50 text-cyan-900 border-cyan-200 ring-1 ring-cyan-500/15",
  "follow-up":   "bg-teal-50 text-teal-900 border-teal-200 ring-1 ring-teal-500/15",
  "Waiting List":"bg-violet-50 text-violet-900 border-violet-200 ring-1 ring-violet-500/15",
  Reject:        "bg-red-50 text-red-900 border-red-200 ring-1 ring-red-500/15",
};

function StatusChip({ status, tag }) {
  const s = String(status || "").trim();
  if (!s) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  const style = STATUS_CHIP_STYLES[s] || "bg-gray-50 text-gray-800 border-gray-200 ring-1 ring-gray-400/10";
  const displayLabel = s === "Have not talked" && tag ? tag : s;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold whitespace-normal text-left leading-snug max-w-[9rem] sm:max-w-[11rem] ${style}`}
      title={displayLabel}
    >
      {displayLabel}
    </span>
  );
}

export default function HiringPage() {
  const [candidate_name, setCandidateName] = useState("");
  const [emp_contact, setEmpContact] = useState("");
  const [designation, setDesignation] = useState("");
  const [marital_status, setMaritalStatus] = useState("");
  const [experience_type, setExperienceType] = useState("");
  const [interview_at, setInterviewAt] = useState("");
  const [rescheduled_at, setRescheduledAt] = useState("");
  const [next_followup_at, setNextFollowupAt] = useState("");
  const [interview_mode, setInterviewMode] = useState("");
  const [status, setStatus] = useState("Toggle");
  const [tag, setTag] = useState("");
  const [hire_date, setHireDate] = useState("");
  const [offerPackage, setOfferPackage] = useState("");
  const [probationMonths, setProbationMonths] = useState("");
  const [selectedResume, setSelectedResume] = useState("");
  const [mgmtInterviewScore, setMgmtInterviewScore] = useState("");
  const [hrInterviewScore, setHrInterviewScore] = useState("");
  const [hrScoreRating, setHrScoreRating] = useState("");
  const [currentSalary, setCurrentSalary] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [hiringCity, setHiringCity] = useState("");
  const [note, setNote] = useState("");

  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const [filterMode, setFilterMode] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");
  const [filterJoinFrom, setFilterJoinFrom] = useState("");
  const [filterJoinTo, setFilterJoinTo] = useState("");
  const [filterInterviewFrom, setFilterInterviewFrom] = useState("");
  const [filterInterviewTo, setFilterInterviewTo] = useState("");
  const [filterCandidateName, setFilterCandidateName] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterNextFollowupFrom, setFilterNextFollowupFrom] = useState("");
  const [filterNextFollowupTo, setFilterNextFollowupTo] = useState("");
  const [designationOptions, setDesignationOptions] = useState([]);
  const [loadingDesignations, setLoadingDesignations] = useState(true);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  /** Next auto-increment preview from API (global table max + 1). */
  const [nextId, setNextId] = useState(null);

  const [resumeUploadBusy, setResumeUploadBusy] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState(null);

  const hasActiveFilters =
    Boolean(filterCandidateName) ||
    Boolean(filterStatus) ||
    Boolean(filterNextFollowupFrom) ||
    Boolean(filterNextFollowupTo) ||
    Boolean(filterMode) ||
    Boolean(filterDesignation) ||
    Boolean(filterJoinFrom) ||
    Boolean(filterJoinTo) ||
    Boolean(filterInterviewFrom) ||
    Boolean(filterInterviewTo);

  const handleResetFilters = () => {
    setFilterMode("");
    setFilterDesignation("");
    setFilterJoinFrom("");
    setFilterJoinTo("");
    setFilterInterviewFrom("");
    setFilterInterviewTo("");
    setFilterCandidateName("");
    setFilterStatus("");
    setFilterNextFollowupFrom("");
    setFilterNextFollowupTo("");
    try {
      window.localStorage.removeItem(FILTER_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

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
    setLoading(true);
    try {
      let url = `/api/empcrm/hiring?`;
      const params = new URLSearchParams();
      if (filterCandidateName) params.append("candidate_name", filterCandidateName);
      if (filterStatus) params.append("status", filterStatus);
      if (filterNextFollowupFrom) params.append("next_followup_from", filterNextFollowupFrom);
      if (filterNextFollowupTo) params.append("next_followup_to", filterNextFollowupTo);
      if (filterMode) params.append("interview_mode", filterMode);
      if (filterDesignation) params.append("designation", filterDesignation);
      if (filterJoinFrom) params.append("join_from", filterJoinFrom);
      if (filterJoinTo) params.append("join_to", filterJoinTo);
      if (filterInterviewFrom) params.append("interview_from", filterInterviewFrom);
      if (filterInterviewTo) params.append("interview_to", filterInterviewTo);
      
      url += params.toString();

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setEntries(json.entries || []);
        if (typeof json.next_id === "number" && Number.isFinite(json.next_id)) {
          setNextId(json.next_id);
        }
      } else setMessage({ type: "error", text: json.error || "Failed to load" });
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }, [
    filterCandidateName, filterStatus, filterNextFollowupFrom, filterNextFollowupTo,
    filterMode, filterDesignation, filterJoinFrom, filterJoinTo, filterInterviewFrom, filterInterviewTo
  ]);

  useEffect(() => {
    if (!filtersHydrated) return;
    load();
  }, [load, filtersHydrated]);

  useEffect(() => {
    const stored = readStoredFilters();
    if (stored) {
      setFilterCandidateName(stored.candidate_name || "");
      setFilterStatus(stored.status || "");
      setFilterNextFollowupFrom(stored.next_followup_from || "");
      setFilterNextFollowupTo(stored.next_followup_to || "");
      setFilterMode(stored.interview_mode || "");
      setFilterDesignation(stored.designation || "");
      setFilterJoinFrom(stored.join_from || "");
      setFilterJoinTo(stored.join_to || "");
      setFilterInterviewFrom(stored.interview_from || "");
      setFilterInterviewTo(stored.interview_to || "");
    }
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (!filtersHydrated || typeof window === "undefined") return;
    try {
      if (!hasActiveFilters) {
        window.localStorage.removeItem(FILTER_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          FILTER_STORAGE_KEY,
          JSON.stringify({
            candidate_name: filterCandidateName,
            status: filterStatus,
            next_followup_from: filterNextFollowupFrom,
            next_followup_to: filterNextFollowupTo,
            interview_mode: filterMode,
            designation: filterDesignation,
            join_from: filterJoinFrom,
            join_to: filterJoinTo,
            interview_from: filterInterviewFrom,
            interview_to: filterInterviewTo,
          }),
        );
      }
    } catch {
      // ignore
    }
  }, [
    filtersHydrated,
    filterCandidateName,
    filterStatus,
    filterNextFollowupFrom,
    filterNextFollowupTo,
    filterMode,
    filterDesignation,
    filterJoinFrom,
    filterJoinTo,
    filterInterviewFrom,
    filterInterviewTo,
    hasActiveFilters,
  ]);

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

  const filterDesignationOptions = useMemo(
    () => mergeDesignationOptions(designationOptions, filterDesignation),
    [designationOptions, filterDesignation],
  );

  const addFormDesignations = useMemo(
    () => HR_TARGET_ALLOWED_DESIGNATIONS,
    []
  );

  const resetForm = () => {
    setCandidateName("");
    setEmpContact("");
    setDesignation("");
    setMaritalStatus("");
    setExperienceType("");
    setInterviewAt("");
    setRescheduledAt("");
    setNextFollowupAt("");
    setInterviewMode("");
    setStatus("Toggle");
    setTag("");
    setHireDate("");
    setOfferPackage("");
    setProbationMonths("");
    setSelectedResume("");
    setMgmtInterviewScore("");
    setHrInterviewScore("");
    setHrScoreRating("");
    setCurrentSalary("");
    setExpectedSalary("");
    setCurrentLocation("");
    setNote("");
    setResumeUploadError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const hired = status === "Hired";
      const rescheduled = status === "Rescheduled";
      const nextFollowUp = status === "next-follow-up";
      const hiredFollowUpTag = hired && tag === "Follow-Up";
      const res = await fetch("/api/empcrm/hiring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name,
          emp_contact,
          designation,
          marital_status: marital_status || null,
          experience_type: experience_type || null,
          interview_at: interview_at || null,
          rescheduled_at: rescheduled ? rescheduled_at || null : null,
          next_followup_at: (status !== "Rejected" && status !== "Reject")
            ? next_followup_at || null
            : null,
          interview_mode: interview_mode || null,
          status,
          tag: hired ? tag || null : null,
          hire_date: hired ? hire_date || null : null,
          package: hired ? offerPackage.trim() || null : null,
          probation_months:
            hired && tag === "Probation" && probationMonths !== ""
              ? Number(probationMonths)
              : null,
          selected_resume: selectedResume.trim() || null,
          mgmt_interview_score: mgmtInterviewScore !== "" ? Number(mgmtInterviewScore) : null,
          hr_interview_score: hrInterviewScore !== "" ? Number(hrInterviewScore) : null,
          hr_score_rating: hrScoreRating.trim() || null,
          current_salary: currentSalary.trim() || null,
          expected_salary: expectedSalary.trim() || null,
          current_location: currentLocation.trim() || null,
          hiring_city: hiringCity.trim() || null,
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Save failed" });
        return;
      }
      setMessage({ type: "ok", text: json.message || "Saved" });
      resetForm();
      setAddOpen(false);
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setMessage(null);
    resetForm();
    setAddOpen(true);
  };

  return (
    <div className="w-full min-w-0 max-w-screen-2xl mx-auto space-y-5 sm:space-y-6 px-3 sm:px-4 lg:px-6 pb-8 sm:pb-10">
      {message && (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm ${
            message.type === "ok"
              ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-900"
              : "border-red-200/80 bg-red-50/90 text-red-900"
          }`}
        >
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
          <span>{message.text}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-8 w-1 rounded-full bg-indigo-600" aria-hidden />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Hiring</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-end rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:self-start"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            Add employee
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <Filter className="h-4 w-4" aria-hidden />
            </span>
            <h2 className="text-sm font-semibold text-slate-800">Filters</h2>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        </div>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-1 lg:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Emp Name</label>
            <input
              type="text"
              placeholder="Search name"
              className={`${fieldClass} min-h-[44px]`}
              value={filterCandidateName}
              onChange={(e) => setFilterCandidateName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-1 lg:col-span-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
            <select className={filterSelectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-1 lg:col-span-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Mode</label>
            <select className={filterSelectClass} value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
              <option value="">All modes</option>
              {INTERVIEW_MODE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Designation</label>
            <select
              className={filterSelectClass}
              value={filterDesignation}
              onChange={(e) => setFilterDesignation(e.target.value)}
            >
              <option value="">All designations</option>
              {filterDesignationOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* ── Joining date range ── */}
          <div className="flex flex-col gap-1 min-w-0 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Joining date (from – to)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="date"
                value={filterJoinFrom}
                onChange={(e) => setFilterJoinFrom(e.target.value)}
                className={`${fieldClass} min-h-[44px] w-full min-w-0 flex-1 sm:min-h-0`}
                title="Joining from"
              />
              <span className="hidden text-xs text-slate-400 sm:inline">–</span>
              <input
                type="date"
                value={filterJoinTo}
                min={filterJoinFrom || undefined}
                onChange={(e) => setFilterJoinTo(e.target.value)}
                className={`${fieldClass} min-h-[44px] w-full min-w-0 flex-1 sm:min-h-0`}
                title="Joining to"
              />
            </div>
          </div>

          {/* ── Interview date range ── */}
          <div className="flex flex-col gap-1 min-w-0 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Interview date (from – to)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterInterviewFrom}
                onChange={(e) => setFilterInterviewFrom(e.target.value)}
                className={`${fieldClass} flex-1 min-w-0`}
                title="Interview from"
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                type="date"
                value={filterInterviewTo}
                min={filterInterviewFrom || undefined}
                onChange={(e) => setFilterInterviewTo(e.target.value)}
                className={`${fieldClass} flex-1 min-w-0`}
                title="Interview to"
              />
            </div>
          </div>

          {/* ── Next Follow-up date range ── */}
          <div className="flex flex-col gap-1 min-w-0 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Next follow-up date (from – to)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterNextFollowupFrom}
                onChange={(e) => setFilterNextFollowupFrom(e.target.value)}
                className={`${fieldClass} flex-1 min-w-0`}
                title="Next follow-up from"
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                type="date"
                value={filterNextFollowupTo}
                min={filterNextFollowupFrom || undefined}
                onChange={(e) => setFilterNextFollowupTo(e.target.value)}
                className={`${fieldClass} flex-1 min-w-0`}
                title="Next follow-up to"
              />
            </div>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2 text-[11px] text-slate-500 sm:hidden">
        <span className="h-px flex-1 max-w-[2rem] bg-slate-200" aria-hidden />
        Swipe the table sideways to see all columns
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/50 min-w-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden />
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
            <table className="min-w-[760px] w-full text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/90">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    ID
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Emp name
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Designation
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    City
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Contact
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Interview
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Mode
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Next follow-up date
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Joining date
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Mgmt
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    HR
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-14 text-center">
                      <p className="text-sm font-medium text-slate-600">No records for this filter.</p>
                      <p className="mt-1 text-xs text-slate-400">Try another year, month, or designation.</p>
                    </td>
                  </tr>
                ) : (
                  entries.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 transition-colors even:bg-slate-50/50 hover:bg-indigo-50/40"
                    >
                      <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">{row.id}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 sm:px-4">{row.candidate_name}</td>
                      <td
                        className="max-w-[10rem] truncate px-3 py-2.5 text-slate-700 sm:px-4"
                        title={row.designation || ""}
                      >
                        {row.designation || "—"}
                      </td>
                      <td
                        className="max-w-[8rem] truncate px-3 py-2.5 text-slate-700 sm:px-4"
                        title={row.hiring_city || ""}
                      >
                        {row.hiring_city || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 sm:px-4">{row.emp_contact || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 sm:px-4">
                        <span className="block">{formatInterviewAt(row.interview_at)}</span>
                        {row.status === "Rescheduled" && row.rescheduled_at ? (
                          <span className="mt-0.5 block text-xs font-medium text-amber-800" title="Rescheduled slot">
                            → {formatInterviewAt(row.rescheduled_at)}
                          </span>
                        ) : null}
                        {row.status === "next-follow-up" && row.next_followup_at ? (
                          <span className="mt-0.5 block text-xs font-medium text-cyan-800" title="Next follow-up">
                            Next → {formatInterviewAt(row.next_followup_at)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 sm:px-4">{row.interview_mode || "—"}</td>
                      <td className="px-3 py-2.5 align-top sm:px-4">
                        <StatusChip status={row.status} tag={row.tag} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 sm:px-4">
                        {row.next_followup_at ? formatInterviewAt(row.next_followup_at) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 sm:px-4">
                        {row.hire_date ? String(row.hire_date).slice(0, 10) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 sm:px-4">
                        {row.mgmt_interview_score != null ? `${row.mgmt_interview_score}/10` : "—"}
                      </td>
                      <td className="max-w-[9rem] px-3 py-2.5 text-slate-600 sm:px-4">
                        <span className="block tabular-nums">
                          {row.hr_interview_score != null ? `${row.hr_interview_score}/10` : "—"}
                        </span>
                        {row.hr_score_rating ? (
                          <span className="mt-0.5 block text-xs font-medium text-slate-500">
                            {HR_SCORE_RATING_LABELS[row.hr_score_rating] ?? row.hr_score_rating}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right sm:px-4">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <Link
                            href={`/empcrm/admin-dashboard/hiring/${row.id}/view`}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200/90 bg-indigo-50/90 px-2 py-1 text-xs font-medium text-indigo-800 transition hover:bg-indigo-100"
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            View
                          </Link>
                          <Link
                            href={`/empcrm/admin-dashboard/hiring/${row.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
                          >
                            <Pencil className="h-3.5 w-3.5 shrink-0" />
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="add-employee-title">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            onClick={() => !saving && setAddOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 z-10 flex h-full max-h-[100dvh] w-full max-w-full flex-col border-l border-slate-200/90 bg-white shadow-2xl sm:max-w-lg sm:rounded-l-2xl pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="min-w-0 pr-2">
                <h2 id="add-employee-title" className="text-base font-semibold text-slate-900 sm:text-lg">
                  Add employee
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Next ID updates in the form after each save.</p>
              </div>
              <button
                type="button"
                onClick={() => !saving && setAddOpen(false)}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-white/80 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
                {message && message.type === "error" && (
                  <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 border border-red-200">
                    {message.text}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-2.5 sm:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-indigo-700/80">ID</span>
                    {nextId != null ? (
                      <span className="text-sm font-semibold tabular-nums text-indigo-950">{nextId}</span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Emp name *</label>
                    <input
                      required
                      value={candidate_name}
                      onChange={(e) => setCandidateName(e.target.value)}
                      className={formFieldClass}
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Emp contact *</label>
                    <input
                      required
                      type="tel"
                      value={emp_contact}
                      onChange={(e) => setEmpContact(e.target.value)}
                      className={formFieldClass}
                      placeholder="Phone / email"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Designation *</label>
                    <select
                      required
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className={formSelectClass}
                    >
                      <option value="">— Select designation —</option>
                      {addFormDesignations.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
                    <input
                      type="text"
                      value={hiringCity}
                      onChange={(e) => setHiringCity(e.target.value)}
                      placeholder="Enter city"
                      maxLength={120}
                      className={formFieldClass}
                    />
                  </div>

                  {!["Toggle", "Talked", "Have not talked", "Didn't receive the call", "Cut the call", "Not reachable", "next-follow-up", "follow-up"].includes(status) && (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">HR Interview Score (1–10)</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={hrInterviewScore}
                          onChange={(e) => setHrInterviewScore(e.target.value)}
                          className={`max-w-[160px] ${formFieldClass}`}
                          placeholder="1 – 10"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">HR score</label>
                        <select
                          value={hrScoreRating}
                          onChange={(e) => setHrScoreRating(e.target.value)}
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
                          value={currentSalary}
                          onChange={(e) => setCurrentSalary(e.target.value)}
                          className={formFieldClass}
                          placeholder="e.g. 25000"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Expected salary</label>
                        <input
                          type="text"
                          value={expectedSalary}
                          onChange={(e) => setExpectedSalary(e.target.value)}
                          className={formFieldClass}
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Marital status</label>
                        <select
                          value={marital_status}
                          onChange={(e) => setMaritalStatus(e.target.value)}
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
                          value={experience_type}
                          onChange={(e) => setExperienceType(e.target.value)}
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
                          value={interview_at}
                          onChange={(e) => setInterviewAt(e.target.value)}
                          className={formFieldClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Mode of interview</label>
                        <select
                          value={interview_mode}
                          onChange={(e) => setInterviewMode(e.target.value)}
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
                          value={currentLocation}
                          onChange={(e) => setCurrentLocation(e.target.value)}
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
                      value={status}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStatus(v);
                        if (v !== "Hired") {
                          setTag("");
                        }
                        if (v !== "Hired") {
                          setHireDate("");
                          setOfferPackage("");
                          setProbationMonths("");
                        }
                        if (v !== "Rescheduled") setRescheduledAt("");
                        if (v === "Rejected" || v === "Reject") setNextFollowupAt("");
                      }}
                      className={`w-full max-w-full sm:max-w-md ${fieldClass} min-h-[44px]`}
                    >
                      {hiringStatusSelectOptions(null).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {status === "Rescheduled" && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Rescheduled date &amp; time *
                      </label>
                      <input
                        type="datetime-local"
                        required={status === "Rescheduled"}
                        value={rescheduled_at}
                        onChange={(e) => setRescheduledAt(e.target.value)}
                        className={formFieldClass}
                      />
                    </div>
                  )}

                  {status !== "Rejected" && status !== "Reject" && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Next follow-up date &amp; time *
                      </label>
                      <input
                        type="datetime-local"
                        required={status !== "Rejected" && status !== "Reject"}
                        value={next_followup_at}
                        onChange={(e) => setNextFollowupAt(e.target.value)}
                        className={formFieldClass}
                      />
                    </div>
                  )}

                  {status === "Hired" && (
                    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 sm:col-span-2">
                      <p className="text-sm font-semibold text-indigo-900">Hired — joining &amp; package</p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Joining date *</label>
                          <input
                            type="date"
                            required={status === "Hired"}
                            value={hire_date}
                            onChange={(e) => setHireDate(e.target.value)}
                            className={formFieldClass}
                          />
                         
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Package *</label>
                          <input
                            type="text"
                            required={status === "Hired"}
                            value={offerPackage}
                            onChange={(e) => setOfferPackage(e.target.value)}
                            className={formFieldClass}
                            placeholder="e.g. CTC, LPA"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Tags *</label>
                          <select
                            required={status === "Hired"}
                            value={tag}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTag(v);
                              if (v !== "Probation") setProbationMonths("");
                              if (v !== "Follow-Up") setNextFollowupAt("");
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
                        {status === "Hired" && tag === "Follow-Up" && (
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                              Follow-up date &amp; time (optional)
                            </label>
                            <input
                              type="datetime-local"
                              value={next_followup_at}
                              onChange={(e) => setNextFollowupAt(e.target.value)}
                              className={formFieldClass}
                            />
                          </div>
                        )}
                        {tag === "Probation" && (
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-700">Probation (months) *</label>
                            <input
                              type="number"
                              min={1}
                              max={120}
                              required
                              value={probationMonths}
                              onChange={(e) => setProbationMonths(e.target.value)}
                              className={`max-w-[200px] ${formFieldClass}`}
                              placeholder="e.g. 3"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!["Toggle", "Talked", "Have not talked", "Didn't receive the call", "Cut the call", "Not reachable", "next-follow-up", "follow-up"].includes(status) && (
                    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 sm:col-span-2">
                      <p className="text-sm font-semibold text-indigo-900">Selected — resume &amp; score</p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="hiring-resume-add">
                            Resume {status === "Selected" && "*"}
                          </label>
                          <input
                            id="hiring-resume-add"
                            type="file"
                            accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
                            disabled={resumeUploadBusy || saving}
                            className={`${formFieldClass} py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-800`}
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              await handleResumeFile(f, setSelectedResume);
                            }}
                          />
                          {selectedResume ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <a
                                href={selectedResume}
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
                                  setSelectedResume("");
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
                          <label className="mb-1 block text-sm font-medium text-slate-700">Management Interview Score (1–10) {status === "Selected" && "*"}</label>
                          <input
                            required={status === "Selected"}
                            type="number"
                            min={1}
                            max={10}
                            value={mgmtInterviewScore}
                            onChange={(e) => setMgmtInterviewScore(e.target.value)}
                            className={`max-w-[160px] ${formFieldClass}`}
                            placeholder="1 – 10"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Note *</label>
                    <input
                      required
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={formFieldClass}
                      placeholder="Enter note"
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-5 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
                <button
                  type="button"
                  onClick={() => !saving && setAddOpen(false)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
