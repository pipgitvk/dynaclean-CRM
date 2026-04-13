"use client";

import { useCallback, useEffect, useState } from "react";
import { Filter, History, Loader2, Pencil, Trash2, X } from "lucide-react";

const fieldClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400";
const filterSelectClass = `w-full ${fieldClass} min-h-[44px]`;
const formFieldClass = `w-full ${fieldClass}`;
const formSelectClass = `w-full ${fieldClass} min-h-[44px] text-slate-900`;

/** @type {Record<string, string>} */
const STATUS_CHIP_STYLES = {
  "Shortlisted for interview": "bg-sky-50 text-sky-900 border-sky-200 ring-1 ring-sky-500/15",
  Rescheduled: "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  "next-follow-up": "bg-cyan-50 text-cyan-900 border-cyan-200 ring-1 ring-cyan-500/15",
  "follow-up": "bg-teal-50 text-teal-900 border-teal-200 ring-1 ring-teal-500/15",
  "Waiting List": "bg-violet-50 text-violet-900 border-violet-200 ring-1 ring-violet-500/15",
  Hired: "bg-emerald-50 text-emerald-900 border-emerald-200 ring-1 ring-emerald-500/20",
  Reject: "bg-red-50 text-red-900 border-red-200 ring-1 ring-red-500/15",
};

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

const STATUS_OPTIONS = [
  "Shortlisted for interview",
  "Rescheduled",
  "next-follow-up",
  "Waiting List",
  "Hired",
  "Reject",
];
const STATUS_OPTIONS_WITH_LEGACY_STATUS_FOLLOWUP = [
  "Shortlisted for interview",
  "Rescheduled",
  "next-follow-up",
  "follow-up",
  "Waiting List",
  "Hired",
  "Reject",
];

function hiringStatusSelectOptions(rowStatus) {
  return String(rowStatus || "").trim() === "follow-up"
    ? STATUS_OPTIONS_WITH_LEGACY_STATUS_FOLLOWUP
    : STATUS_OPTIONS;
}
const TAG_OPTIONS = ["Probation", "Permanent", "Terminate", "Follow-Up"];
const MARITAL_OPTIONS = ["Unmarried", "Married"];
const EXPERIENCE_OPTIONS = [
  { value: "fresher", label: "Fresher" },
  { value: "experience", label: "Experience" },
];
const INTERVIEW_MODE_OPTIONS = ["Virtual", "Walk-in"];

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

function CreatedByChip({ username }) {
  const s = String(username || "").trim();
  if (!s) {
    return <span className="text-slate-400 text-xs">—</span>;
  }
  return (
    <span
      className="inline-flex max-w-[11rem] items-center rounded-full border border-indigo-200/90 bg-indigo-50 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold leading-snug text-indigo-900 ring-1 ring-indigo-500/10"
      title={s}
    >
      <span className="truncate">{s}</span>
    </span>
  );
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

export default function AdminHiringProcessPage() {
  const now = new Date();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");
  const [filterHr, setFilterHr] = useState("");
  const [designationOptions, setDesignationOptions] = useState([]);
  const [hrUserOptions, setHrUserOptions] = useState([]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntry, setHistoryEntry] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /** @type {null | Record<string, any>} */
  const [editing, setEditing] = useState(null);
  const [editLoadingId, setEditLoadingId] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/admin/hiring-process?year=${filterYear}`;
      if (filterMonth) url += `&month=${filterMonth}`;
      if (filterMode) url += `&interview_mode=${encodeURIComponent(filterMode)}`;
      if (filterDesignation) url += `&designation=${encodeURIComponent(filterDesignation)}`;
      if (filterHr) url += `&created_by=${encodeURIComponent(filterHr)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to load");
        setEntries([]);
        return;
      }
      setEntries(json.entries || []);
      setDesignationOptions(Array.isArray(json.designations) ? json.designations : []);
      setHrUserOptions(Array.isArray(json.hr_users) ? json.hr_users : []);
    } catch (e) {
      setError(e.message || "Network error");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, filterMode, filterDesignation, filterHr]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!filterDesignation || loading) return;
    if (!designationOptions.includes(filterDesignation)) {
      setFilterDesignation("");
    }
  }, [designationOptions, filterDesignation, loading]);

  useEffect(() => {
    if (!filterHr || loading) return;
    if (!hrUserOptions.includes(filterHr)) {
      setFilterHr("");
    }
  }, [hrUserOptions, filterHr, loading]);

  const openHistory = async (entryId) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryEntry(null);
    setHistoryRows([]);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/admin/hiring-process/history?entryId=${entryId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setHistoryError(json.error || "Failed to load history");
        return;
      }
      setHistoryEntry(json.entry);
      setHistoryRows(json.history || []);
    } catch (e) {
      setHistoryError(e.message || "Network error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryEntry(null);
    setHistoryRows([]);
    setHistoryError(null);
  };

  const openEdit = async (entryId) => {
    setError(null);
    setEditLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/hiring-process?entryId=${entryId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success || !json.entry) {
        setError(json.error || "Failed to load record");
        return;
      }
      const row = json.entry;
      setEditing({
        id: row.id,
        created_by_username: row.created_by_username ?? "",
        candidate_name: row.candidate_name ?? "",
        emp_contact: row.emp_contact ?? "",
        designation: row.designation ?? "",
        marital_status: row.marital_status ?? "",
        experience_type: row.experience_type ?? "",
        interview_at: toDatetimeLocalValue(row.interview_at),
        rescheduled_at: toDatetimeLocalValue(row.rescheduled_at),
        next_followup_at: toDatetimeLocalValue(row.next_followup_at),
        interview_mode: row.interview_mode ?? "",
        status: row.status || "Shortlisted for interview",
        tag: row.tag ?? "",
        hire_date: row.hire_date ? String(row.hire_date).slice(0, 10) : "",
        offerPackage: row.package ?? "",
        probationMonths:
          row.probation_months != null && row.probation_months !== "" ? String(row.probation_months) : "",
        note: row.note ?? "",
      });
    } catch (e) {
      setError(e.message || "Network error");
    } finally {
      setEditLoadingId(null);
    }
  };

  const closeEdit = () => setEditing(null);

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
      const res = await fetch("/api/admin/hiring-process", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          candidate_name: editing.candidate_name,
          emp_contact: editing.emp_contact,
          designation: editing.designation,
          marital_status: editing.marital_status,
          experience_type: editing.experience_type,
          interview_at: editing.interview_at,
          rescheduled_at: rescheduled ? editing.rescheduled_at : "",
          next_followup_at: nextFollowUp
            ? editing.next_followup_at
            : hiredFollowUpTag
              ? editing.next_followup_at
              : "",
          interview_mode: editing.interview_mode,
          status: editing.status,
          tag: hired ? editing.tag : "",
          hire_date: hired ? editing.hire_date : "",
          package: hired ? editing.offerPackage : "",
          probation_months:
            hired && editing.tag === "Probation" && editing.probationMonths !== ""
              ? Number(editing.probationMonths)
              : null,
          note: editing.note,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Update failed");
        return;
      }
      closeEdit();
      await load();
    } catch (err) {
      setError(err.message || "Network error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (!confirm(`Delete hiring record #${entryId}? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(entryId);
    try {
      const res = await fetch(`/api/admin/hiring-process?id=${entryId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Delete failed");
        return;
      }
      if (historyOpen && historyEntry?.id === entryId) closeHistory();
      if (editing?.id === entryId) closeEdit();
      await load();
    } catch (e) {
      setError(e.message || "Network error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-200/40">
        <div className="flex items-center gap-3">
          <span className="h-9 w-1 rounded-full bg-indigo-600" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hiring Process</h1>
            
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <Filter className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold text-slate-800">Filters</h2>
        </div>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-2">
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
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-2">
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
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-2">
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
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
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
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">HR (created by)</label>
            <select className={filterSelectClass} value={filterHr} onChange={(e) => setFilterHr(e.target.value)}>
              <option value="">All HR users</option>
              {hrUserOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2 text-[11px] text-slate-500 sm:hidden">
        <span className="h-px max-w-[2rem] flex-1 bg-slate-200" aria-hidden />
        Swipe the table sideways to see all columns
      </p>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/50">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
            <table className="min-w-[900px] w-full text-xs sm:text-sm">
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
                    Created by
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:px-4 sm:text-[11px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center">
                      <p className="text-sm font-medium text-slate-600">No records for this filter.</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Try another year, month, mode, designation, or HR user.
                      </p>
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
                      <td className="px-3 py-2.5 align-top sm:px-4">
                        <CreatedByChip username={row.created_by_username} />
                      </td>
                      <td className="px-3 py-2.5 text-right sm:px-4">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={editLoadingId === row.id}
                            onClick={() => openEdit(row.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {editLoadingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openHistory(row.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-800 transition hover:bg-indigo-100"
                          >
                            <History className="h-3.5 w-3.5" />
                            History
                            {row.history_count != null ? (
                              <span className="rounded-full bg-white/80 px-1.5 py-0 text-[10px] tabular-nums text-indigo-700">
                                {String(row.history_count)}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => handleDelete(row.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="absolute inset-0" onClick={closeHistory} aria-hidden />
          <div className="relative z-10 flex max-h-[min(90dvh,100%)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-4 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">Status &amp; notes history</h2>
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
                {historyEntry && (
                  <>
                    <p className="mt-2 text-xs text-slate-500">
                      Logged by HR:{" "}
                      <strong className="font-medium text-slate-700">{historyEntry.created_by_username}</strong>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>Record created {formatDt(historyEntry.created_at)}</span>
                      <span className="text-slate-300" aria-hidden>
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-medium text-slate-600">Current status:</span>
                        <StatusChip status={historyEntry.status} />
                      </span>
                    </div>
                  </>
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
                <>
                  {historyEntry ? (
                    <div className="mb-5 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white px-3.5 py-3 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700/90">Note * (latest saved)</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                        {historyEntry.note != null && String(historyEntry.note).trim() !== ""
                          ? String(historyEntry.note)
                          : "—"}
                      </p>
                    </div>
                  ) : null}
                  {historyRows.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">
                      No history yet. Save status changes or notes to build a timeline.
                    </p>
                  ) : (
                    <ol className="relative space-y-0 border-l-[3px] border-indigo-200 pl-4">
                      {historyRows.map((h) => {
                        const sb = h.status_before != null ? String(h.status_before) : "";
                        const sa = h.status_after != null ? String(h.status_after) : "";
                        const noteOnly = sb !== "" && sa !== "" && sb === sa;
                        const noteText =
                          h.note != null && String(h.note).trim() !== "" ? String(h.note).trim() : null;
                        return (
                          <li key={h.id} className="relative pb-7 last:pb-0">
                            <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-600 shadow-sm ring-2 ring-indigo-200/60" />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              {formatDt(h.logged_at)}
                            </p>
                            <p className="mt-1.5 text-sm leading-snug text-slate-800">
                              {sb === "" ? (
                                <>
                                  <span className="font-semibold text-emerald-800">Created</span>
                                  <span className="text-slate-600"> – Status: </span>
                                  <span className="font-medium text-slate-900">{sa}</span>
                                </>
                              ) : noteOnly ? (
                                <>
                                  <span className="font-semibold text-slate-800">Note updated</span>
                                  <span className="text-slate-600"> – Status: </span>
                                  <span className="font-medium text-slate-900">{sa}</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-slate-700">Status: </span>
                                  <span className="text-slate-400 line-through decoration-slate-400">{sb}</span>
                                  <span className="text-slate-600"> → </span>
                                  <span className="font-semibold text-indigo-900">{sa}</span>
                                </>
                              )}
                            </p>
                            <div className="mt-2 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Note *</p>
                              <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                                {noteText ?? "—"}
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              By <span className="font-medium text-slate-600">{h.actor_username}</span>
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="absolute inset-0" onClick={() => !editSaving && closeEdit()} aria-hidden />
          <div className="relative z-10 mx-0 max-h-[min(92dvh,100%)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:mx-auto sm:max-h-[92vh] sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                  Edit hiring record <span className="font-normal text-slate-500">#{editing.id}</span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">HR owner: {editing.created_by_username}</p>
              </div>
              <button
                type="button"
                onClick={() => !editSaving && closeEdit()}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-white/80 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4 px-4 py-4 sm:p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
                  <input
                    required
                    value={editing.designation}
                    onChange={(e) => updateEdit("designation", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Marital status *</label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">Experience / Fresher *</label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">Interview date &amp; time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={editing.interview_at}
                    onChange={(e) => updateEdit("interview_at", e.target.value)}
                    className={formFieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mode of interview *</label>
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
                          next.hire_date = "";
                          next.offerPackage = "";
                          next.probationMonths = "";
                        }
                        if (v !== "Rescheduled") next.rescheduled_at = "";
                        if (v !== "next-follow-up" && v !== "Hired") next.next_followup_at = "";
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Rescheduled date &amp; time *
                    </label>
                    <input
                      type="datetime-local"
                      required={editing.status === "Rescheduled"}
                      value={editing.rescheduled_at}
                      onChange={(e) => updateEdit("rescheduled_at", e.target.value)}
                      className={formFieldClass}
                    />
                  </div>
                )}

                {editing.status === "next-follow-up" && (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Next follow-up date &amp; time *
                    </label>
                    <input
                      type="datetime-local"
                      required={editing.status === "next-follow-up"}
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

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Note *</label>
                  <input
                    required
                    value={editing.note}
                    onChange={(e) => updateEdit("note", e.target.value)}
                    className={formFieldClass}
                    placeholder="Enter note"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/50 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:gap-3 sm:pb-0">
                <button
                  type="button"
                  onClick={() => !editSaving && closeEdit()}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                >
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
