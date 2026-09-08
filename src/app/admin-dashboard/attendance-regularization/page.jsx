"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { BadgeCheck } from "lucide-react";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";

function formatLogDate(v) {
  if (v == null) return "—";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date(v).toLocaleDateString();
}

function formatDt(v) {
  if (v == null) return "—";
  return formatTime(v) || "—";
}

/** Prefer proposed times; if none on request, show snapshot from log at request time */
function displayIn(req) {
  return req.proposed_checkin_time ?? req.original_checkin_time ?? null;
}

function displayOut(req) {
  return req.proposed_checkout_time ?? req.original_checkout_time ?? null;
}

function statusBadge(status, acknowledgedAt) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") {
    return "bg-amber-100 text-amber-900 border border-amber-200";
  }
  if (s === "approved") {
    return "bg-green-100 text-green-900 border border-green-200";
  }
  if (s === "rejected") {
    return "bg-red-50 text-red-800 border border-red-200";
  }
  return "bg-gray-100 text-gray-800 border border-gray-200";
}

function StatusBadge({ status, acknowledgedAt }) {
  const cls = statusBadge(status);
  const display = status || "—";
  const statusEl = (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}
    >
      {display}
    </span>
  );
  if (!acknowledgedAt) return statusEl;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
      <BadgeCheck className="w-3 h-3" />
      Acknowledged
    </span>
  );
}

export default function AdminAttendanceRegularizationPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [acknowledgementRemark, setAcknowledgementRemark] = useState("");

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/attendance-regularization");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to load");
      }
      setRequests(data.requests || []);
    } catch (e) {
      toast.error(e.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAction = useCallback(
    async (id, action, remark = null) => {
      const labels = {
        approve: "Approve",
        reject: "Reject",
        revert: "Revert",
        acknowledge: "Acknowledge",
      };
      const label = labels[action] || "Action";
      
      if (action !== "acknowledge" && !confirm(`${label} request #${id}?`)) return;
      
      setActionLoading(`${id}-${action}`);
      try {
        const res = await fetch("/api/admin/attendance-regularization", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, acknowledgement_remark: remark }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Action failed");
        toast.success(data.message || `${label}ed successfully`);
        setShowAcknowledgeModal(false);
        setSelectedRequest(null);
        setAcknowledgementRemark("");
        await load();
      } catch (e) {
        toast.error(e.message);
      } finally {
        setActionLoading(null);
      }
    },
    [load]
  );

  useEffect(() => {
    load();
  }, [load]);

  const uniqueEmployees = Array.from(
    new Set(requests.map((r) => r.username).filter(Boolean))
  ).sort();

  const filteredRequests = requests.filter((req) => {
    const matchesStatus =
      statusFilter === "all" ||
      req.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesEmployee =
      employeeFilter === "all" || req.username === employeeFilter;

    let matchesDate = true;
    if (monthFilter) {
      const [year, month] = monthFilter.split("-");
      const reqDate = new Date(req.log_date);
      matchesDate =
        reqDate.getFullYear() === parseInt(year) &&
        reqDate.getMonth() + 1 === parseInt(month);
    }

    return matchesStatus && matchesEmployee && matchesDate;
  });

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="mb-6 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Attendance regularization — all requests
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            In/Out show requested times; if none were saved on the request, the
            prior log snapshot is shown when available. New overtime requests
            require both times.
          </p>
        </div>
        <Link
          href="/admin-dashboard"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900 underline shrink-0"
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Filters section */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
            Employee
          </label>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="w-full rounded border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Employees</option>
            {uniqueEmployees.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
            Month
          </label>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full rounded border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-600 py-12 text-center">Loading…</p>
      ) : filteredRequests.length === 0 ? (
        <p className="w-full text-gray-600 rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
          No regularization requests found for the selected filters.
        </p>
      ) : (
        <div className="w-full bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-full text-sm">
              <thead className="bg-gray-100 text-left text-gray-700">
                <tr>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">ID</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Employee
                  </th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-3 py-2 font-medium min-w-[140px]">Reason</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Timing & Log Details
                  </th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Attachment
                  </th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800">{req.id}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {req.username}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatLogDate(req.log_date)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={req.status}
                        acknowledgedAt={req.acknowledged_at}
                      />
                    </td>
                    <td className="px-3 py-2 min-w-0 text-gray-700 align-top break-words">
                      {req.reason || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-gray-600 font-medium">Original:</div>
                        <div>
                          <span className="text-gray-500">In:</span>{" "}
                          {formatDt(req.original_checkin_time)}
                        </div>
                        <div>
                          <span className="text-gray-500">Out:</span>{" "}
                          {formatDt(req.original_checkout_time)}
                        </div>
                        <div className="text-gray-600 font-medium mt-1">Filled:</div>
                        <div>
                          <span className="text-gray-500">In:</span>{" "}
                          {formatDt(req.proposed_checkin_time)}
                        </div>
                        <div>
                          <span className="text-gray-500">Out:</span>{" "}
                          {formatDt(req.proposed_checkout_time)}
                        </div>
                        <div>
                          <span className="text-gray-500">By:</span>{" "}
                          {req.reviewed_by || "—"}
                        </div>
                        {req.acknowledged_by && (
                          <div className="flex items-center gap-1 text-indigo-700">
                            <BadgeCheck className="w-3 h-3" />
                            <span>
                              Acknowledged by {req.acknowledged_by}
                              {req.acknowledged_at
                                ? ` on ${new Date(req.acknowledged_at).toLocaleString()}`
                                : ""}
                            </span>
                          </div>
                        )}
                        {req.acknowledgement_remark && (
                          <div className="mt-1 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-700">
                            <span className="font-medium text-indigo-800">Remark: </span>
                            {req.acknowledgement_remark}
                          </div>
                        )}
                        <div className="text-gray-400 mt-1 pt-1 border-t border-gray-50">
                          {req.created_at
                            ? new Date(req.created_at).toLocaleString()
                            : "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {req.attachment_url ? (
                        <a
                          href={req.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-700 underline hover:text-teal-900"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {req.acknowledged_at ? (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleAction(req.id, "revert")}
                            disabled={actionLoading !== null}
                            className="px-2 py-1 text-xs font-medium rounded bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Revert to pending - clears acknowledgement"
                          >
                            {actionLoading === `${req.id}-revert` ? "…" : "Revert"}
                          </button>
                        </div>
                      ) : req.status === "pending" ? (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleAction(req.id, "approve")}
                            disabled={actionLoading !== null}
                            className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === `${req.id}-approve` ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => handleAction(req.id, "reject")}
                            disabled={actionLoading !== null}
                            className="px-2 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === `${req.id}-reject` ? "…" : "Reject"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setShowAcknowledgeModal(true);
                              setAcknowledgementRemark("");
                            }}
                            disabled={actionLoading !== null}
                            className="px-2 py-1 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === `${req.id}-acknowledge` ? "…" : "Acknowledge"}
                          </button>
                        </div>
                      ) : req.status === "approved" || req.status === "rejected" ? (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleAction(req.id, "revert")}
                            disabled={actionLoading !== null}
                            className="px-2 py-1 text-xs font-medium rounded bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={`Revert ${req.status} request to pending`}
                          >
                            {actionLoading === `${req.id}-revert` ? "…" : "Revert"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setShowAcknowledgeModal(true);
                              setAcknowledgementRemark("");
                            }}
                            disabled={actionLoading !== null}
                            className="px-2 py-1 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === `${req.id}-acknowledge` ? "…" : "Acknowledge"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Acknowledgement Remark Modal */}
      {showAcknowledgeModal && selectedRequest && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <BadgeCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Acknowledge Request</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedRequest.username} - {formatLogDate(selectedRequest.log_date)}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee Details
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1">
                  <div><strong>In:</strong> {displayIn(selectedRequest) ? formatDt(displayIn(selectedRequest)) : "—"}</div>
                  <div><strong>Out:</strong> {displayOut(selectedRequest) ? formatDt(displayOut(selectedRequest)) : "—"}</div>
                  <div><strong>Reason:</strong> {selectedRequest.reason || "—"}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remark <span className="text-gray-500">(Optional)</span>
                </label>
                <textarea
                  value={acknowledgementRemark}
                  onChange={(e) => setAcknowledgementRemark(e.target.value)}
                  placeholder="Enter your remark or comment about this attendance request..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-2">This remark will be visible to the employee.</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowAcknowledgeModal(false);
                  setAcknowledgementRemark("");
                  setSelectedRequest(null);
                }}
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(selectedRequest.id, "acknowledge", acknowledgementRemark)}
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading === `${selectedRequest.id}-acknowledge` ? "Processing..." : "Acknowledge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
