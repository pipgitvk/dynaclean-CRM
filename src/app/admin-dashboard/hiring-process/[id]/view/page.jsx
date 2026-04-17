"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Loader2 } from "lucide-react";
import {
  formatDt,
  formatExperienceLabel,
  formatInterviewAt,
  StatusChip,
} from "../../shared";

/** Table-friendly datetime for status history table */
function formatHistoryWhen(v) {
  if (v == null || v === "") return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 24);
    const datePart = d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return "—";
  }
}

export default function HiringProcessViewPage() {
  const params = useParams();
  const idRaw = params?.id;
  const entryId = idRaw != null ? parseInt(String(idRaw), 10) : NaN;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyEntry, setHistoryEntry] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(entryId) || entryId < 1) {
      setError("Invalid record.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hiring-process/history?entryId=${entryId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to load");
        setHistoryEntry(null);
        setHistoryRows([]);
        return;
      }
      setHistoryEntry(json.entry);
      setHistoryRows(json.history || []);
    } catch (e) {
      setError(e.message || "Network error");
      setHistoryEntry(null);
      setHistoryRows([]);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    load();
  }, [load]);

  const backHref = "/admin-dashboard/hiring-process";
  const editHref = `/admin-dashboard/hiring-process/${entryId}/edit`;

  const statusRows = useMemo(() => {
    const rows = historyRows.filter((h) => {
      const s = h.status != null ? String(h.status).trim() : "";
      return !!s;
    });
    return [...rows].sort((a, b) => {
      const ta = new Date(a.logged_at).getTime();
      const tb = new Date(b.logged_at).getTime();
      return tb - ta;
    });
  }, [historyRows]);

  const displayName =
    historyEntry?.candidate_name != null && String(historyEntry.candidate_name).trim() !== ""
      ? String(historyEntry.candidate_name).trim()
      : "—";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-gray-700">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to list
        </Link>
      </div>

      {loading && !historyEntry ? (
        <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : error && !historyEntry ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : (
        <>
          <h1 className="mb-8 text-2xl font-semibold text-gray-900">
            {displayName} (ID: {historyEntry?.id ?? entryId})
          </h1>

          {historyEntry && (
            <>
              <div className="mb-8 grid grid-cols-1 gap-8">
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
                  <h2 className="mb-6 border-b border-gray-200 pb-3 text-xl font-semibold text-gray-800">
                    Candidate details
                  </h2>
                  <div className="flex w-full flex-col gap-10 lg:flex-row">
                    <div className="w-full lg:w-[60%]">
                      <dl className="grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Emp name</dt>
                          <dd className="mt-1 font-semibold text-gray-900 break-words">
                            {historyEntry.candidate_name != null && String(historyEntry.candidate_name).trim() !== ""
                              ? String(historyEntry.candidate_name).trim()
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Emp contact</dt>
                          <dd className="mt-1">
                            {(() => {
                              const c =
                                historyEntry.emp_contact != null ? String(historyEntry.emp_contact).trim() : "";
                              if (!c) return <span className="font-semibold text-gray-900">—</span>;
                              const telHref = c.replace(/[\s()-]/g, "");
                              return (
                                <a
                                  href={telHref ? `tel:${telHref}` : undefined}
                                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline break-all"
                                >
                                  {c}
                                </a>
                              );
                            })()}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Designation</dt>
                          <dd className="mt-1 font-semibold text-gray-900 break-words">
                            {historyEntry.designation != null && String(historyEntry.designation).trim() !== ""
                              ? String(historyEntry.designation).trim()
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Marital status</dt>
                          <dd className="mt-1 font-semibold text-gray-900">
                            {historyEntry.marital_status != null && String(historyEntry.marital_status).trim() !== ""
                              ? String(historyEntry.marital_status).trim()
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Experience</dt>
                          <dd className="mt-1 font-semibold text-gray-900">
                            {formatExperienceLabel(historyEntry.experience_type)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Mode of interview</dt>
                          <dd className="mt-1 font-semibold text-gray-900">
                            {historyEntry.interview_mode != null && String(historyEntry.interview_mode).trim() !== ""
                              ? String(historyEntry.interview_mode).trim()
                              : "—"}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-gray-500">Interview date &amp; time</dt>
                          <dd className="mt-1 font-semibold text-gray-900">
                            {formatInterviewAt(historyEntry.interview_at)}
                          </dd>
                          {historyEntry.status === "Rescheduled" && historyEntry.rescheduled_at ? (
                            <p className="mt-1 text-sm font-medium text-amber-800">
                              Rescheduled → {formatInterviewAt(historyEntry.rescheduled_at)}
                            </p>
                          ) : null}
                          {(historyEntry.status === "next-follow-up" || historyEntry.status === "Follow-up") &&
                          historyEntry.next_followup_at ? (
                            <p className="mt-1 text-sm font-medium text-cyan-800">
                              Next follow-up → {formatInterviewAt(historyEntry.next_followup_at)}
                            </p>
                          ) : null}
                        </div>
                      </dl>
                    </div>

                    <div className="w-full rounded-xl border border-slate-100 bg-slate-50/80 p-5 lg:w-[40%] lg:max-w-md">
                      <h3 className="mb-4 text-lg font-semibold text-gray-800">Current status</h3>
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-500">Status</p>
                        <div className="mt-2">
                          <StatusChip status={historyEntry.status} />
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-500">Created by</p>
                        <p className="mt-1 font-semibold text-gray-900">
                          {historyEntry.creator_name != null && String(historyEntry.creator_name).trim() !== ""
                            ? String(historyEntry.creator_name).trim()
                            : "—"}
                        </p>
                        {historyEntry.creator_role != null && String(historyEntry.creator_role).trim() !== "" ? (
                          <p className="mt-0.5 text-sm text-gray-600">{String(historyEntry.creator_role).trim()}</p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Created</p>
                        <p className="mt-1 font-semibold text-gray-900">{formatDt(historyEntry.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
                  <h2 className="mb-4 border-b border-gray-200 pb-3 text-xl font-semibold text-gray-800">Actions</h2>
                  <Link
                    href={editHref}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 shadow-sm transition hover:bg-emerald-100/90"
                  >
                    <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
                    Follow-up
                  </Link>
                </div>
              </div>
            </>
          )}

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">Status history</h2>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-700">{error}</p>
            ) : statusRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                No status changes yet. Each update appears as a new row below.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100 text-xs font-bold uppercase tracking-wide text-gray-700">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Date &amp; time</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">HR</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Status</th>
                      <th className="min-w-[12rem] px-4 py-3 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {statusRows.map((h) => {
                      const sa = h.status != null ? String(h.status).trim() : "";
                      const noteText =
                        h.note != null && String(h.note).trim() !== "" ? String(h.note).trim() : null;
                      const hrName = h.updater_name != null ? String(h.updater_name).trim() : "";
                      const hrUser = h.updated_by != null ? String(h.updated_by).trim() : "";
                      return (
                        <tr key={h.id} className="transition-colors hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 align-top text-gray-800">
                            {formatHistoryWhen(h.logged_at)}
                          </td>
                          <td className="max-w-[14rem] px-4 py-3 align-top">
                            <span className="block font-semibold text-gray-900">{hrName || hrUser || "—"}</span>
                            {h.updater_role != null && String(h.updater_role).trim() !== "" ? (
                              <span className="mt-0.5 block text-xs text-gray-500">{String(h.updater_role).trim()}</span>
                            ) : null}
                            {hrName && hrUser && hrName !== hrUser ? (
                              <span className="mt-0.5 block text-[11px] text-gray-400">@{hrUser}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <StatusChip status={sa} />
                          </td>
                          <td className="max-w-md px-4 py-3 align-top text-gray-800">
                            {noteText ? (
                              <span className="whitespace-pre-wrap break-words leading-relaxed">{noteText}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
