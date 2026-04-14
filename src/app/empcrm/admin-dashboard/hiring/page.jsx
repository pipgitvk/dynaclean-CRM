"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Eye, Filter, Loader2, Pencil, UserPlus, X } from "lucide-react";

/** Shared field styles */
const fieldClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400";
const filterSelectClass = `w-full ${fieldClass} min-h-[44px]`;
const formFieldClass = `w-full ${fieldClass}`;
const formSelectClass = `w-full ${fieldClass} min-h-[44px] text-slate-900`;

const STATUS_OPTIONS = [
  "Follow-up",
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

const TAG_OPTIONS = ["Probation", "Permanent", "Terminate", "Follow-Up"];

const MARITAL_OPTIONS = ["Unmarried", "Married"];

const EXPERIENCE_OPTIONS = [
  { value: "fresher", label: "Fresher" },
  { value: "experience", label: "Experience" },
];

const INTERVIEW_MODE_OPTIONS = ["Virtual", "Walk-in"];

/** Month filter dropdown: value 1–12, label full month name */
const MONTH_FILTER_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1;
  const label = new Date(2024, i, 1).toLocaleString("en-IN", { month: "long" });
  return { value: String(m), label };
});

/** Newest first: next calendar year down through 12 prior years */
const YEAR_FILTER_OPTIONS = (() => {
  const y = new Date().getFullYear();
  return Array.from({ length: 14 }, (_, i) => y + 1 - i);
})();

function formatInterviewAt(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 16);
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

function formatDt(v) {
  if (v == null || v === "") return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 19);
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
  "Follow-up":   "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
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

/** MySQL / ISO datetime → datetime-local input value */
function toDatetimeLocalValue(v) {
  if (v == null || v === "") return "";
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const s = String(v).replace("Z", "");
  if (s.length >= 16) return s.slice(0, 16).replace(" ", "T");
  return "";
}

function StatusChip({ status }) {
  const s = String(status || "").trim();
  if (!s) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  const style = STATUS_CHIP_STYLES[s] || "bg-gray-50 text-gray-800 border-gray-200 ring-1 ring-gray-400/10";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold whitespace-normal text-left leading-snug max-w-[9rem] sm:max-w-[11rem] ${style}`}
      title={s}
    >
      {s}
    </span>
  );
}

export default function HiringPage() {
  const now = new Date();
  const [candidate_name, setCandidateName] = useState("");
  const [emp_contact, setEmpContact] = useState("");
  const [designation, setDesignation] = useState("");
  const [marital_status, setMaritalStatus] = useState("");
  const [experience_type, setExperienceType] = useState("");
  const [interview_at, setInterviewAt] = useState("");
  const [rescheduled_at, setRescheduledAt] = useState("");
  const [next_followup_at, setNextFollowupAt] = useState("");
  const [interview_mode, setInterviewMode] = useState("");
  const [status, setStatus] = useState("Shortlisted");
  const [tag, setTag] = useState("");
  const [hire_date, setHireDate] = useState("");
  const [offerPackage, setOfferPackage] = useState("");
  const [probationMonths, setProbationMonths] = useState("");
  const [selectedResume, setSelectedResume] = useState("");
  const [mgmtInterviewScore, setMgmtInterviewScore] = useState("");
  const [hrInterviewScore, setHrInterviewScore] = useState("");
  const [currentSalary, setCurrentSalary] = useState("");
  const [note, setNote] = useState("");

  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");
  const [designationOptions, setDesignationOptions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  /** @type {null | Record<string, any>} */
  const [editing, setEditing] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  /** Next auto-increment preview from API (global table max + 1). */
  const [nextId, setNextId] = useState(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntry, setHistoryEntry] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyError, setHistoryError] = useState(null);

  /** Quick status change: same status list as Edit; other fields kept from row snapshot. */
  /** @type {null | Record<string, any>} */
  const [followUp, setFollowUp] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/empcrm/hiring?year=${filterYear}`;
      if (filterMonth) url += `&month=${filterMonth}`;
      if (filterMode) url += `&interview_mode=${encodeURIComponent(filterMode)}`;
      if (filterDesignation) url += `&designation=${encodeURIComponent(filterDesignation)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setEntries(json.entries || []);
        setDesignationOptions(Array.isArray(json.designations) ? json.designations : []);
        if (typeof json.next_id === "number" && Number.isFinite(json.next_id)) {
          setNextId(json.next_id);
        }
      } else setMessage({ type: "error", text: json.error || "Failed to load" });
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, filterMode, filterDesignation]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!filterDesignation || loading) return;
    if (!designationOptions.includes(filterDesignation)) {
      setFilterDesignation("");
    }
  }, [designationOptions, filterDesignation, loading]);

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
    setStatus("Shortlisted");
    setTag("");
    setHireDate("");
    setOfferPackage("");
    setProbationMonths("");
    setSelectedResume("");
    setMgmtInterviewScore("");
    setHrInterviewScore("");
    setCurrentSalary("");
    setNote("");
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
          next_followup_at: nextFollowUp
            ? next_followup_at || null
            : hiredFollowUpTag
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
          current_salary: currentSalary.trim() || null,
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

  const closeFollowUp = () => setFollowUp(null);

  const openFollowUp = (row) => {
    setAddOpen(false);
    setEditing(null);
    setHistoryOpen(false);
    setHistoryEntry(null);
    setHistoryRows([]);
    setHistoryError(null);
    setMessage(null);
    setFollowUp({
      id: row.id,
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
        row.probation_months != null && row.probation_months !== ""
          ? String(row.probation_months)
          : "",
      selectedResume: row.selected_resume ?? "",
      mgmtInterviewScore:
        row.mgmt_interview_score != null && row.mgmt_interview_score !== ""
          ? String(row.mgmt_interview_score)
          : "",
      hrInterviewScore:
        row.hr_interview_score != null && row.hr_interview_score !== ""
          ? String(row.hr_interview_score)
          : "",
      currentSalary: row.current_salary ?? "",
      note: row.note ?? "",
    });
  };

  const updateFollowUp = (key, value) => {
    setFollowUp((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!followUp) return;
    setSaving(true);
    setMessage(null);
    try {
      const hired = followUp.status === "Hired";
      const rescheduled = followUp.status === "Rescheduled";
      const nextFollowUp = followUp.status === "next-follow-up";
      const hiredFollowUpTag = hired && followUp.tag === "Follow-Up";
      const res = await fetch("/api/empcrm/hiring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: followUp.id,
          candidate_name: followUp.candidate_name,
          emp_contact: followUp.emp_contact,
          designation: followUp.designation,
          marital_status: followUp.marital_status || null,
          experience_type: followUp.experience_type || null,
          interview_at: followUp.interview_at || null,
          rescheduled_at: rescheduled ? followUp.rescheduled_at || null : null,
          next_followup_at: nextFollowUp
            ? followUp.next_followup_at || null
            : hiredFollowUpTag
              ? followUp.next_followup_at || null
              : null,
          interview_mode: followUp.interview_mode || null,
          status: followUp.status,
          tag: hired ? followUp.tag || null : null,
          hire_date: hired ? followUp.hire_date || null : null,
          package: hired ? String(followUp.offerPackage || "").trim() || null : null,
          probation_months:
            hired && followUp.tag === "Probation" && followUp.probationMonths !== ""
              ? Number(followUp.probationMonths)
              : null,
          selected_resume: followUp.selectedResume?.trim() || null,
          mgmt_interview_score:
            followUp.mgmtInterviewScore !== "" ? Number(followUp.mgmtInterviewScore) : null,
          hr_interview_score:
            followUp.hrInterviewScore !== "" ? Number(followUp.hrInterviewScore) : null,
          current_salary: followUp.currentSalary?.trim() || null,
          note: followUp.note,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Update failed" });
        return;
      }
      setMessage({ type: "ok", text: json.message || "Status updated" });
      closeFollowUp();
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setAddOpen(false);
    setFollowUp(null);
    setHistoryOpen(false);
    setHistoryEntry(null);
    setHistoryRows([]);
    setHistoryError(null);
    setMessage(null);
    setEditing({
      id: row.id,
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
        row.probation_months != null && row.probation_months !== ""
          ? String(row.probation_months)
          : "",
      selectedResume: row.selected_resume ?? "",
      mgmtInterviewScore:
        row.mgmt_interview_score != null && row.mgmt_interview_score !== ""
          ? String(row.mgmt_interview_score)
          : "",
      hrInterviewScore:
        row.hr_interview_score != null && row.hr_interview_score !== ""
          ? String(row.hr_interview_score)
          : "",
      currentSalary: row.current_salary ?? "",
      note: row.note ?? "",
    });
  };

  const closeEdit = () => setEditing(null);

  const updateEdit = (key, value) => {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMessage(null);
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
          next_followup_at: nextFollowUp
            ? editing.next_followup_at || null
            : hiredFollowUpTag
              ? editing.next_followup_at || null
              : null,
          interview_mode: editing.interview_mode || null,
          status: editing.status,
          tag: hired ? editing.tag || null : null,
          hire_date: hired ? editing.hire_date || null : null,
          package: hired ? String(editing.offerPackage || "").trim() || null : null,
          probation_months:
            hired && editing.tag === "Probation" && editing.probationMonths !== ""
              ? Number(editing.probationMonths)
              : null,
          selected_resume: editing.selectedResume?.trim() || null,
          mgmt_interview_score:
            editing.mgmtInterviewScore !== "" ? Number(editing.mgmtInterviewScore) : null,
          hr_interview_score:
            editing.hrInterviewScore !== "" ? Number(editing.hrInterviewScore) : null,
          current_salary: editing.currentSalary?.trim() || null,
          note: editing.note,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Update failed" });
        return;
      }
      setMessage({ type: "ok", text: json.message || "Updated" });
      closeEdit();
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setFollowUp(null);
    setHistoryOpen(false);
    setHistoryEntry(null);
    setHistoryRows([]);
    setHistoryError(null);
    setMessage(null);
    resetForm();
    setAddOpen(true);
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryEntry(null);
    setHistoryRows([]);
    setHistoryError(null);
  };

  const openHistory = async (entryId) => {
    setFollowUp(null);
    setEditing(null);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryEntry(null);
    setHistoryRows([]);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/empcrm/hiring/history?entryId=${entryId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setHistoryError(json.error || "Failed to load history");
        return;
      }
      setHistoryEntry(json.entry || null);
      setHistoryRows(Array.isArray(json.history) ? json.history : []);
    } catch (e) {
      setHistoryError(e.message || "Network error");
    } finally {
      setHistoryLoading(false);
    }
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
        <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <Filter className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold text-slate-800">Filters</h2>
        </div>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-1 lg:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Year</label>
            <select
              className={filterSelectClass}
              value={String(filterYear)}
              onChange={(e) => setFilterYear(Number(e.target.value))}
            >
              {YEAR_FILTER_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-1 lg:col-span-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Month</label>
            <select className={filterSelectClass} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="">All months</option>
              {MONTH_FILTER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
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
              {designationOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
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
            <table className="min-w-[680px] w-full text-xs sm:text-sm">
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
                    Tag
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Joining date
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Package
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Score
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-14 text-center">
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
                        <StatusChip status={row.status} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 sm:px-4">{row.tag || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 sm:px-4">
                        {row.hire_date ? String(row.hire_date).slice(0, 10) : "—"}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2.5 text-slate-600 sm:px-4" title={row.package || ""}>
                        {row.package || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 sm:px-4">
                        {row.mgmt_interview_score != null ? `${row.mgmt_interview_score}/10` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right sm:px-4">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openHistory(row.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200/90 bg-indigo-50/90 px-2 py-1 text-xs font-medium text-indigo-800 transition hover:bg-indigo-100"
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openFollowUp(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200/90 bg-amber-50/90 px-2 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                          >
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                            Follow-up
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
                          >
                            <Pencil className="h-3.5 w-3.5 shrink-0" />
                            Edit
                          </button>
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

      {historyOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="absolute inset-0" onClick={closeHistory} aria-hidden />
          <div className="relative z-10 flex max-h-[min(90dvh,100%)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-4 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">Status history</h2>
                {historyEntry && (
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{historyEntry.candidate_name}</span>
                    {" · "}
                    <span className="text-slate-500">#{historyEntry.id}</span>
                    {historyEntry.designation ? (
                      <>
                        {" · "}
                        <span className="text-slate-600">{historyEntry.designation}</span>
                      </>
                    ) : null}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeHistory}
                className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading…
                </div>
              ) : historyError ? (
                <p className="py-6 text-center text-sm text-red-700">{historyError}</p>
              ) : (
                (() => {
                  const statusRows = historyRows.filter((h) => {
                    const s = h.status != null ? String(h.status).trim() : "";
                    return !!s;
                  });
                  return statusRows.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">
                      No status changes yet. Each update appears as a new row below.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                      <table className="w-full min-w-[240px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/90">
                            <th className="whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4">
                              When
                            </th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4">
                              status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {statusRows.map((h) => {
                            const sa = h.status != null ? String(h.status).trim() : "";
                            return (
                              <tr
                                key={h.id}
                                className="border-b border-slate-100 transition-colors even:bg-slate-50/50 last:border-b-0"
                              >
                                <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-slate-600 sm:px-4">
                                  {formatDt(h.logged_at)}
                                </td>
                                <td className="px-3 py-2.5 align-top sm:px-4">
                                  <StatusChip status={sa} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {followUp && (
        <div
          className="fixed inset-0 z-[96] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="follow-up-title"
        >
          <div
            className="absolute inset-0"
            onClick={() => !saving && closeFollowUp()}
            aria-hidden
          />
          <div className="relative z-10 mx-0 max-h-[min(92dvh,100%)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:mx-auto sm:max-h-[90vh] sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-indigo-50/30 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 id="follow-up-title" className="text-base font-semibold text-slate-900 sm:text-lg">
                  Follow-up <span className="font-normal text-slate-500">#{followUp.id}</span>
                </h2>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{followUp.candidate_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Update status, note, and any fields required for the new status. Name and interview details stay in
                  Edit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !saving && closeFollowUp()}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-white/80 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleFollowUpSubmit} className="space-y-4 px-4 py-4 sm:px-5 sm:py-5 pb-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status *</label>
                <select
                  required
                  value={followUp.status}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFollowUp((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev, status: v };
                      if (v !== "Hired") {
                        next.tag = "";
                        next.hire_date = "";
                        next.offerPackage = "";
                        next.probationMonths = "";
                      }
                      if (v !== "Rescheduled") next.rescheduled_at = "";
                      if (v !== "next-follow-up" && v !== "Hired") next.next_followup_at = "";
                      if (v !== "Selected") {
                        next.selectedResume = "";
                        next.mgmtInterviewScore = "";
                        next.hrInterviewScore = "";
                      }
                      return next;
                    });
                  }}
                  className={`w-full ${fieldClass} min-h-[44px]`}
                >
                  {hiringStatusSelectOptions(followUp?.status).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {followUp.status === "Rescheduled" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Rescheduled date &amp; time *</label>
                  <input
                    type="datetime-local"
                    required={followUp.status === "Rescheduled"}
                    value={followUp.rescheduled_at}
                    onChange={(e) => updateFollowUp("rescheduled_at", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
              )}

              {followUp.status === "next-follow-up" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Next follow-up date &amp; time *
                  </label>
                  <input
                    type="datetime-local"
                    required={followUp.status === "next-follow-up"}
                    value={followUp.next_followup_at ?? ""}
                    onChange={(e) => updateFollowUp("next_followup_at", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
              )}

              {followUp.status === "Hired" && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
                  <p className="text-sm font-semibold text-indigo-900">Hired — joining &amp; package</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Joining date *</label>
                      <input
                        type="date"
                        required={followUp.status === "Hired"}
                        value={followUp.hire_date}
                        onChange={(e) => updateFollowUp("hire_date", e.target.value)}
                        className={formFieldClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Package *</label>
                      <input
                        type="text"
                        required={followUp.status === "Hired"}
                        value={followUp.offerPackage}
                        onChange={(e) => updateFollowUp("offerPackage", e.target.value)}
                        className={formFieldClass}
                        placeholder="e.g. CTC, LPA"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tags *</label>
                      <select
                        required={followUp.status === "Hired"}
                        value={followUp.tag}
                        onChange={(e) => {
                          const t = e.target.value;
                          setFollowUp((prev) =>
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
                        className={`w-full ${formSelectClass}`}
                      >
                        <option value="">— Select —</option>
                        {TAG_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    {followUp.status === "Hired" && followUp.tag === "Follow-Up" && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Follow-up date &amp; time (optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={followUp.next_followup_at ?? ""}
                          onChange={(e) => updateFollowUp("next_followup_at", e.target.value)}
                          className={formFieldClass}
                        />
                      </div>
                    )}
                    {followUp.tag === "Probation" && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Probation (months) *</label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          required
                          value={followUp.probationMonths}
                          onChange={(e) => updateFollowUp("probationMonths", e.target.value)}
                          className={`max-w-[200px] ${formFieldClass}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {followUp.status === "Selected" && (
                <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                  <p className="text-sm font-semibold text-indigo-900">Selected — resume &amp; score</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Resume *</label>
                      <input
                        required={followUp.status === "Selected"}
                        type="text"
                        value={followUp.selectedResume ?? ""}
                        onChange={(e) => updateFollowUp("selectedResume", e.target.value)}
                        className={formFieldClass}
                        placeholder="Resume link or description"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Management Interview Score (1–10) *</label>
                      <input
                        required={followUp.status === "Selected"}
                        type="number"
                        min={1}
                        max={10}
                        value={followUp.mgmtInterviewScore ?? ""}
                        onChange={(e) => updateFollowUp("mgmtInterviewScore", e.target.value)}
                        className={`max-w-[160px] ${formFieldClass}`}
                        placeholder="1 – 10"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">HR Interview Score (1–10) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={10}
                    value={followUp.hrInterviewScore ?? ""}
                    onChange={(e) => updateFollowUp("hrInterviewScore", e.target.value)}
                    className={`max-w-[160px] ${formFieldClass}`}
                    placeholder="1 – 10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Current Salary *</label>
                  <input
                    required
                    type="text"
                    value={followUp.currentSalary ?? ""}
                    onChange={(e) => updateFollowUp("currentSalary", e.target.value)}
                    className={formFieldClass}
                    placeholder="e.g. 25000"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Note *</label>
                <input
                  required
                  value={followUp.note}
                  onChange={(e) => updateFollowUp("note", e.target.value)}
                  className={formFieldClass}
                  placeholder="Enter note"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => !saving && closeFollowUp()}
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
                    <input
                      required
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="Same as target row if applicable"
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">HR Interview Score (1–10) *</label>
                    <input
                      required
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">Current Salary *</label>
                    <input
                      required
                      type="text"
                      value={currentSalary}
                      onChange={(e) => setCurrentSalary(e.target.value)}
                      className={formFieldClass}
                      placeholder="e.g. 25000"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Marital status *</label>
                    <select
                      required
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">Experience / Fresher *</label>
                    <select
                      required
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">Interview date &amp; time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={interview_at}
                      onChange={(e) => setInterviewAt(e.target.value)}
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Mode of interview *</label>
                    <select
                      required
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
                          setHireDate("");
                          setOfferPackage("");
                          setProbationMonths("");
                        }
                        if (v !== "Rescheduled") setRescheduledAt("");
                        if (v !== "next-follow-up" && v !== "Hired") setNextFollowupAt("");
                        if (v !== "Selected") {
                          setSelectedResume("");
                          setMgmtInterviewScore("");
                          setHrInterviewScore("");
                        }
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

                  {status === "next-follow-up" && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Next follow-up date &amp; time *
                      </label>
                      <input
                        type="datetime-local"
                        required={status === "next-follow-up"}
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

                  {status === "Selected" && (
                    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 sm:col-span-2">
                      <p className="text-sm font-semibold text-indigo-900">Selected — resume &amp; score</p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Resume *</label>
                          <input
                            required={status === "Selected"}
                            type="text"
                            value={selectedResume}
                            onChange={(e) => setSelectedResume(e.target.value)}
                            className={formFieldClass}
                            placeholder="Resume link or description"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Management Interview Score (1–10) *</label>
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

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-0 max-h-[min(92dvh,100%)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10 sm:mx-auto sm:max-h-[92vh] sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 px-4 py-3.5 sm:px-5 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-4">
              <h3 className="min-w-0 truncate text-base font-semibold text-slate-900 sm:text-lg">
                Edit record <span className="font-normal text-slate-500">#{editing.id}</span>
              </h3>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-white/80 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-4 py-4 sm:p-5 space-y-4 pb-6 sm:pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Emp name *</label>
                  <input
                    required
                    value={editing.candidate_name}
                    onChange={(e) => updateEdit("candidate_name", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Emp contact *</label>
                  <input
                    required
                    type="tel"
                    value={editing.emp_contact}
                    onChange={(e) => updateEdit("emp_contact", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Designation *</label>
                  <input
                    required
                    value={editing.designation}
                    onChange={(e) => updateEdit("designation", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HR Interview Score (1–10) *</label>
                  <input
                    required
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Salary *</label>
                  <input
                    required
                    type="text"
                    value={editing.currentSalary ?? ""}
                    onChange={(e) => updateEdit("currentSalary", e.target.value)}
                    className={formFieldClass}
                    placeholder="e.g. 25000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marital status *</label>
                  <select
                    required
                    value={editing.marital_status}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Experience / Fresher *</label>
                  <select
                    required
                    value={editing.experience_type}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interview date &amp; time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={editing.interview_at}
                    onChange={(e) => updateEdit("interview_at", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mode of interview *</label>
                  <select
                    required
                    value={editing.interview_mode}
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
                {editing.status === "Selected" && (
                  <div className="sm:col-span-2 space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                    <p className="text-sm font-semibold text-indigo-900">Selected — resume &amp; score</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Resume *</label>
                        <input
                          required
                          type="text"
                          value={editing.selectedResume ?? ""}
                          onChange={(e) => updateEdit("selectedResume", e.target.value)}
                          className={formFieldClass}
                          placeholder="Resume link or description"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Management Interview Score (1–10) *</label>
                        <input
                          required
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

                <div className="sm:col-span-2 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-3">
                  <p className="text-xs font-medium text-slate-600">Current status &amp; note</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Status and <span className="font-medium text-slate-600">Note *</span> are updated in{" "}
                    <span className="font-semibold text-amber-800">Follow-up</span>. Here you can change name,
                    interview, contact, and other details.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip status={editing.status} />
                  </div>
                  {editing.note != null && String(editing.note).trim() !== "" ? (
                    <p className="mt-2 rounded-lg border border-slate-100 bg-white/80 px-2.5 py-2 text-xs text-slate-600 leading-snug">
                      <span className="font-medium text-slate-500">Saved note: </span>
                      {String(editing.note)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">No note saved yet — add in Follow-up.</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/50 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:gap-3 sm:pb-0">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
