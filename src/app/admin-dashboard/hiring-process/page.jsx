"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Filter, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  CreatedByChip,
  filterSelectClass,
  formatInterviewAt,
  INTERVIEW_MODE_OPTIONS,
  STATUS_OPTIONS,
  StatusChip,
  fieldClass,
} from "./shared";

export default function AdminHiringProcessPage() {
  const now = new Date();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filterCandidateName, setFilterCandidateName] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterNextFollowupFrom, setFilterNextFollowupFrom] = useState("");
  const [filterNextFollowupTo, setFilterNextFollowupTo] = useState("");
  
  const [filterMode, setFilterMode] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");
  const [filterHr, setFilterHr] = useState("");
  const [designationOptions, setDesignationOptions] = useState([]);
  const [hrUserOptions, setHrUserOptions] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/admin/hiring-process?`;
      const params = new URLSearchParams();
      if (filterCandidateName) params.append("candidate_name", filterCandidateName);
      if (filterStatus) params.append("status", filterStatus);
      if (filterNextFollowupFrom) params.append("next_followup_from", filterNextFollowupFrom);
      if (filterNextFollowupTo) params.append("next_followup_to", filterNextFollowupTo);
      if (filterMode) params.append("interview_mode", filterMode);
      if (filterDesignation) params.append("designation", filterDesignation);
      if (filterHr) params.append("created_by", filterHr);

      url += params.toString();

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
  }, [
    filterCandidateName, filterStatus, filterNextFollowupFrom, filterNextFollowupTo,
    filterMode, filterDesignation, filterHr
  ]);

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
          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-1 lg:col-span-2">
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
              {(filterNextFollowupFrom || filterNextFollowupTo) && (
                <button
                  type="button"
                  onClick={() => { setFilterNextFollowupFrom(""); setFilterNextFollowupTo(""); }}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Clear"
                >
                  <span className="text-xs">Clear</span>
                </button>
              )}
            </div>
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
                    Next follow-up date
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
                        Try another name, status, next follow-up date, mode, designation, or HR user.
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
                        {(row.status === "next-follow-up" || row.status === "Follow-up") && row.next_followup_at ? (
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
                      <td className="px-3 py-2.5 align-top sm:px-4">
                        <CreatedByChip name={row.creator_name} role={row.creator_role} />
                      </td>
                      <td className="px-3 py-2.5 text-right sm:px-4">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <Link
                            href={`/admin-dashboard/hiring-process/${row.id}/view`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-800 transition hover:bg-indigo-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                            {row.history_count != null ? (
                              <span className="rounded-full bg-white/80 px-1.5 py-0 text-[10px] tabular-nums text-indigo-700">
                                {String(row.history_count)}
                              </span>
                            ) : null}
                          </Link>
                          <Link
                            href={`/admin-dashboard/hiring-process/${row.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 transition hover:bg-emerald-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
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
    </div>
  );
}
