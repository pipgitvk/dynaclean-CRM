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
  if (acknowledgedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
        <BadgeCheck className="w-3 h-3" />
        Acknowledged
      </span>
    );
  }
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium uppercase tracking-wide ${cls}`}>
      {display}
    </span>
  );
}

export default function AttendanceRegularizationApprovalsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [commentById, setCommentById] = useState({});
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [acknowledgementRemark, setAcknowledgementRemark] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/attendance/regularization?scope=pending-approvals"
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load requests");
      }
      setRequests(data.requests || []);
    } catch (e) {
      toast.error(e.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id, action) => {
    const remarks = commentById[id] || "";
    
    if (!remarks.trim()) {
      toast.error("Remarks are mandatory. Please enter remarks before proceeding.");
      return;
    }
    
    setActingId(id);
    try {
      const res = await fetch("/api/attendance/regularization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          reviewer_comment: remarks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Action failed");
      }
      toast.success(data.message || "Done.");
      setCommentById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const acknowledge = async (id, remark = null) => {
    setActingId(id);
    try {
      const res = await fetch("/api/attendance/regularization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "acknowledge", acknowledgement_remark: remark }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || "Action failed");
      }
      toast.success(data.message || "Acknowledged.");
      setShowAcknowledgeModal(false);
      setSelectedRequest(null);
      setAcknowledgementRemark("");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-full">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Attendance regularization — approvals
        </h1>
        <div className="flex gap-2">
          <Link
            href="/empcrm/user-dashboard/attendance-regularization/approval-history"
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            View approval history
          </Link>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          Total: <span className="font-semibold text-gray-900">{requests.length}</span> pending request{requests.length !== 1 ? "s" : ""}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-gray-600 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          No pending regularization requests.
        </p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Employee</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Log Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Submitted</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Current In / Out</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Proposed In / Out</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap max-w-[260px]">Reason</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Attachment</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Acknowledged</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap max-w-[320px]">Remarks *</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const origIn = formatTime(req.original_checkin_time) || "Absent";
                  const origOut = formatTime(req.original_checkout_time) || "Absent";
                  const propInChanged = proposedDiffersFromCurrent(req.original_checkin_time, req.proposed_checkin_time);
                  const propOutChanged = proposedDiffersFromCurrent(req.original_checkout_time, req.proposed_checkout_time);
                  const propIn = propInChanged ? formatTime(req.proposed_checkin_time) || "—" : "—";
                  const propOut = propOutChanged ? formatTime(req.proposed_checkout_time) || "—" : "—";
                  return (
                    <tr
                      key={req.id}
                      className="border-b border-gray-100 hover:bg-gray-50 align-top"
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                        {req.username}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatLogDate(req.log_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        <div className="text-xs text-gray-500">Submitted</div>
                        <div>{new Date(req.created_at).toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="text-gray-700">
                            <span className="text-[11px] text-gray-500 mr-1">IN:</span>
                            {origIn}
                          </div>
                          <div className="text-gray-700">
                            <span className="text-[11px] text-gray-500 mr-1">OUT:</span>
                            {origOut}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="font-medium text-teal-800">
                            <span className="text-[11px] text-gray-500 mr-1 font-normal">IN:</span>
                            {propIn}
                          </div>
                          <div className="font-medium text-teal-800">
                            <span className="text-[11px] text-gray-500 mr-1 font-normal">OUT:</span>
                            {propOut}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RegStatusBadge status={req.status} acknowledgedAt={req.acknowledged_at} />
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[260px]">
                        <details>
                          <summary className="cursor-pointer hover:text-gray-900">
                            <span className="text-xs text-gray-500">View reason</span>
                          </summary>
                          <p className="mt-1 text-sm">{req.reason || "—"}</p>
                        </details>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {req.attachment_url ? (
                          <a
                            href={req.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-700 underline hover:text-teal-900 font-medium"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {req.acknowledged_by ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 text-[12px] text-indigo-700 font-medium">
                              <BadgeCheck className="w-3.5 h-3.5" />
                              <span>{req.acknowledged_by}</span>
                            </div>
                            {req.acknowledged_at && (
                              <div className="text-[11px] text-gray-500">
                                {new Date(req.acknowledged_at).toLocaleString()}
                              </div>
                            )}
                            {req.acknowledgement_remark && (
                              <div className="mt-1 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-700">
                                <span className="font-medium text-indigo-800">Remark: </span>
                                {req.acknowledgement_remark}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Not yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[320px]">
                        {!req.acknowledged_at && (
                          <textarea
                            value={commentById[req.id] || ""}
                            onChange={(e) =>
                              setCommentById((prev) => ({
                                ...prev,
                                [req.id]: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter remarks (mandatory)"
                            required
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 items-end">
                          {req.acknowledged_at ? (
                            <span className="w-full text-center text-indigo-600 text-[11px] font-medium inline-flex items-center justify-center gap-1">
                              <BadgeCheck className="w-3 h-3" />
                              Acknowledged
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={actingId === req.id}
                                onClick={() => review(req.id, "approve")}
                                className="w-full px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {actingId === req.id ? "Working…" : "Approve"}
                              </button>
                              <button
                                type="button"
                                disabled={actingId === req.id}
                                onClick={() => review(req.id, "reject")}
                                className="w-full px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                              >
                                {actingId === req.id ? "Working…" : "Reject"}
                              </button>
                              <button
                                type="button"
                                disabled={actingId === req.id}
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setShowAcknowledgeModal(true);
                                  setAcknowledgementRemark("");
                                }}
                                className="w-full px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {actingId === req.id ? "Working…" : "Acknowledge"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-4">
            {requests.map((req) => {
              const origIn = formatTime(req.original_checkin_time) || "Absent";
              const origOut = formatTime(req.original_checkout_time) || "Absent";
              const propInChanged = proposedDiffersFromCurrent(req.original_checkin_time, req.proposed_checkin_time);
              const propOutChanged = proposedDiffersFromCurrent(req.original_checkout_time, req.proposed_checkout_time);
              const propIn = propInChanged ? formatTime(req.proposed_checkin_time) || "—" : "—";
              const propOut = propOutChanged ? formatTime(req.proposed_checkout_time) || "—" : "—";
              return (
                <li
                  key={req.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{req.username}</p>
                      <p className="text-sm text-gray-600">Date: {formatLogDate(req.log_date)}</p>
                      <p className="text-xs text-gray-500 mt-1">Submitted: {new Date(req.created_at).toLocaleString()}</p>
                    </div>
                    <RegStatusBadge status={req.status} acknowledgedAt={req.acknowledged_at} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
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
                    <p className="text-gray-700">{req.reason || "—"}</p>
                  </div>

                  {req.attachment_url && (
                    <p className="text-sm mb-3">
                      <a
                        href={req.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-teal-700 underline hover:text-teal-900"
                      >
                        View attachment
                      </a>
                    </p>
                  )}

                  {req.acknowledged_by && (
                    <div className="mb-3 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[12px] text-indigo-700">
                        <BadgeCheck className="w-3.5 h-3.5" />
                        <span>
                          Acknowledged by {req.acknowledged_by}
                          {req.acknowledged_at ? ` on ${new Date(req.acknowledged_at).toLocaleString()}` : ""}
                        </span>
                      </div>
                      {req.acknowledgement_remark && (
                        <div className="mt-1 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-700">
                          <span className="font-medium text-indigo-800">Remark: </span>
                          {req.acknowledgement_remark}
                        </div>
                      )}
                    </div>
                  )}

                  {!req.acknowledged_at && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Remarks *
                      </label>
                      <textarea
                        value={commentById[req.id] || ""}
                        onChange={(e) =>
                          setCommentById((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Enter remarks (mandatory)"
                        required
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {req.acknowledged_at ? (
                      <span className="text-indigo-600 text-[12px] font-medium inline-flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5" />
                        Acknowledged
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={actingId === req.id}
                          onClick={() => review(req.id, "approve")}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {actingId === req.id ? "Working…" : "Approve & update log"}
                        </button>
                        <button
                          type="button"
                          disabled={actingId === req.id}
                          onClick={() => review(req.id, "reject")}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={actingId === req.id}
                          onClick={() => {
                            setSelectedRequest(req);
                            setShowAcknowledgeModal(true);
                            setAcknowledgementRemark("");
                          }}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {actingId === req.id ? "Working…" : "Acknowledge"}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
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
                disabled={actingId !== null}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => acknowledge(selectedRequest.id, acknowledgementRemark)}
                disabled={actingId !== null}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {actingId === selectedRequest.id ? "Processing..." : "Acknowledge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
