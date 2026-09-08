"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { BadgeCheck } from "lucide-react";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";

const FIELDS = [
  { key: "checkin_time", label: "Check-in" },
  { key: "checkout_time", label: "Check-out" },
];

function formatLogDate(v) {
  if (v == null) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date(v).toLocaleDateString();
}

function formatDateTime(v) {
  if (v == null) return "";
  return new Date(v).toLocaleString();
}

function proposedDiffersFromCurrent(original, proposed) {
  const cur = (formatTime(original) || "").trim();
  const next = (formatTime(proposed) || "").trim();
  return cur !== next;
}

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return "bg-amber-100 text-amber-800 border border-amber-200";
  if (s === "approved") return "bg-green-100 text-green-800 border border-green-200";
  if (s === "rejected") return "bg-red-100 text-red-800 border border-red-200";
  return "bg-gray-100 text-gray-800 border border-gray-200";
}

function RegStatusBadge({ status, acknowledgedAt }) {
  const cls = statusBadgeClass(status);
  const display = status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : "—";
  const statusEl = (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium uppercase tracking-wide ${cls}`}>
      {display}
    </span>
  );
  if (!acknowledgedAt) return statusEl;
  return (
    <div className="flex flex-col gap-1 items-end">
      {statusEl}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
        <BadgeCheck className="w-3 h-3" />
        Acknowledged
      </span>
    </div>
  );
}

export default function ApprovalHistoryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/attendance/regularization?scope=my-approvals"
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load approval history");
      }
      setRequests(data.requests || []);
    } catch (e) {
      toast.error(e.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const acknowledge = useCallback(
    async (id) => {
      if (!confirm(`Acknowledge request #${id}?`)) return;
      setActingId(id);
      try {
        const res = await fetch("/api/attendance/regularization", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "acknowledge" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || "Action failed");
        toast.success(data.message || "Acknowledged.");
        await load();
      } catch (e) {
        toast.error(e.message);
      } finally {
        setActingId(null);
      }
    },
    [load]
  );

  useEffect(() => {
    load();
  }, [load]);

  const uniqueEmployees = [...new Set(requests.map(req => req.username))].sort();
  
  const filteredRequests = requests.filter(req => 
    employeeFilter === "" || 
    req.username === employeeFilter
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <p className="text-gray-600">Loading approval history...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-full">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Approval History
        </h1>
        <div className="flex gap-2">
          <Link
            href="/empcrm/user-dashboard/attendance-regularization"
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            Back to pending approvals
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="max-w-md w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Employee Name
          </label>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Employees</option>
            {uniqueEmployees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-600">
          Total: <span className="font-semibold text-gray-900">{filteredRequests.length}</span> record{filteredRequests.length !== 1 ? "s" : ""}
        </div>
      </div>

      {filteredRequests.length === 0 && requests.length > 0 ? (
        <p className="text-gray-600 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          No requests found matching "{employeeFilter}".
        </p>
      ) : requests.length === 0 ? (
        <p className="text-gray-600 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          No approval history found. You haven't approved or rejected any regularization requests yet.
        </p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Employee</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Log Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Submitted / Reviewed</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Current In / Out</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Proposed In / Out</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap max-w-[280px]">Reason</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap max-w-[240px]">Remarks</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Attachment</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Acknowledged</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const origIn = formatTime(req.original_checkin_time) || "Absent";
                  const origOut = formatTime(req.original_checkout_time) || "Absent";
                  const propInChanged = proposedDiffersFromCurrent(req.original_checkin_time, req.proposed_checkin_time);
                  const propOutChanged = proposedDiffersFromCurrent(req.original_checkout_time, req.proposed_checkout_time);
                  const propIn = propInChanged ? formatTime(req.proposed_checkin_time) || "Not specified" : "No change";
                  const propOut = propOutChanged ? formatTime(req.proposed_checkout_time) || "Not specified" : "No change";
                  const inCellStatus =
                    req.status === "approved" && propInChanged ? "Updated" :
                    req.status === "rejected" && propInChanged ? "Rejected" :
                    "No change";
                  const outCellStatus =
                    req.status === "approved" && propOutChanged ? "Updated" :
                    req.status === "rejected" && propOutChanged ? "Rejected" :
                    "No change";
                  return (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{req.username}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatLogDate(req.log_date)}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        <div className="text-xs text-gray-500">Submitted</div>
                        <div>{formatDateTime(req.created_at)}</div>
                        <div className="text-xs text-gray-500 mt-1">Reviewed</div>
                        <div>{formatDateTime(req.reviewed_at)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="text-gray-700"><span className="text-[11px] text-gray-500 mr-1">IN:</span>{origIn}</div>
                          <div className="text-gray-700"><span className="text-[11px] text-gray-500 mr-1">OUT:</span>{origOut}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div>
                            <span className="text-[11px] text-gray-500 mr-1">IN:</span>
                            <span className="font-medium text-teal-800">{propIn}</span>
                            {inCellStatus === "Updated" && <span className="ml-2 text-[11px] font-medium text-green-600">{inCellStatus}</span>}
                            {inCellStatus === "Rejected" && <span className="ml-2 text-[11px] font-medium text-red-600">{inCellStatus}</span>}
                          </div>
                          <div>
                            <span className="text-[11px] text-gray-500 mr-1">OUT:</span>
                            <span className="font-medium text-teal-800">{propOut}</span>
                            {outCellStatus === "Updated" && <span className="ml-2 text-[11px] font-medium text-green-600">{outCellStatus}</span>}
                            {outCellStatus === "Rejected" && <span className="ml-2 text-[11px] font-medium text-red-600">{outCellStatus}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RegStatusBadge status={req.status} acknowledgedAt={req.acknowledged_at} />
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[280px]">
                        <details>
                          <summary className="cursor-pointer hover:text-gray-900"><span className="text-xs text-gray-500">Reason</span></summary>
                          <p className="mt-1 text-sm">{req.reason || "No reason provided"}</p>
                        </details>
                        {req.reviewer_comment && (
                          <details className="mt-2">
                            <summary className="cursor-pointer hover:text-gray-900"><span className="text-xs text-gray-500">Your remarks</span></summary>
                            <p className="mt-1 text-sm p-2 bg-gray-50 rounded">{req.reviewer_comment}</p>
                          </details>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[240px]"></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {req.attachment_url ? (
                          <a href={req.attachment_url} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline hover:text-teal-900 font-medium">View</a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {req.acknowledged_by ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 text-[12px] text-indigo-700 font-medium">
                              <BadgeCheck className="w-3.5 h-3.5" />
                              <span>{req.acknowledged_by}</span>
                            </div>
                            {req.acknowledged_at && <div className="text-[11px] text-gray-500">{formatDateTime(req.acknowledged_at)}</div>}
                          </div>
                        ) : <span className="text-gray-400 text-xs">Not yet</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {!req.acknowledged_at ? (
                          <button
                            type="button"
                            disabled={actingId === req.id}
                            onClick={() => acknowledge(req.id)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {actingId === req.id ? "Working…" : "Acknowledge"}
                          </button>
                        ) : (
                          <span className="text-green-600 text-xs font-medium inline-flex items-center gap-1 justify-end">
                            <BadgeCheck className="w-3.5 h-3.5" /> Done
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-4">
            {filteredRequests.map((req) => {
              const origIn = formatTime(req.original_checkin_time) || "Absent";
              const origOut = formatTime(req.original_checkout_time) || "Absent";
              const propInChanged = proposedDiffersFromCurrent(req.original_checkin_time, req.proposed_checkin_time);
              const propOutChanged = proposedDiffersFromCurrent(req.original_checkout_time, req.proposed_checkout_time);
              const propIn = propInChanged ? formatTime(req.proposed_checkin_time) || "—" : "No change";
              const propOut = propOutChanged ? formatTime(req.proposed_checkout_time) || "—" : "No change";
              return (
                <li key={req.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{req.username}</p>
                      <p className="text-sm text-gray-600">Date: {formatLogDate(req.log_date)}</p>
                    </div>
                    <RegStatusBadge status={req.status} acknowledgedAt={req.acknowledged_at} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Submitted on</p>
                      <p className="text-gray-700">{formatDateTime(req.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reviewed on</p>
                      <p className="text-gray-700">{formatDateTime(req.reviewed_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Current In</p>
                      <p className="text-gray-700">{origIn}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Current Out</p>
                      <p className="text-gray-700">{origOut}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Proposed In</p>
                      <p className="font-medium text-teal-800">{propIn}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Proposed Out</p>
                      <p className="font-medium text-teal-800">{propOut}</p>
                    </div>
                  </div>

                  <div className="mb-3 text-sm">
                    <p className="text-xs text-gray-500 mb-1">Reason</p>
                    <p className="text-gray-700">{req.reason || "No reason provided"}</p>
                  </div>

                  {req.reviewer_comment && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Your remarks</p>
                      <p className="text-sm text-gray-700">{req.reviewer_comment}</p>
                    </div>
                  )}

                  {req.attachment_url && (
                    <p className="text-sm mb-3">
                      <a href={req.attachment_url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 underline hover:text-teal-900">View attachment</a>
                    </p>
                  )}

                  {req.acknowledged_by ? (
                    <div className="mb-3 flex items-center gap-1.5 text-[12px] text-indigo-700">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      <span>Acknowledged by {req.acknowledged_by}{req.acknowledged_at ? ` on ${formatDateTime(req.acknowledged_at)}` : ""}</span>
                    </div>
                  ) : (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={actingId === req.id}
                        onClick={() => acknowledge(req.id)}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {actingId === req.id ? "Working…" : "Acknowledge"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
