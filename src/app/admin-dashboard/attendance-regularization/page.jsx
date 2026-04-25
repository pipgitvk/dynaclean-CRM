"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
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

function statusBadge(status) {
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

export default function AdminAttendanceRegularizationPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

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
    async (id, action) => {
      const label = action === "approve" ? "Approve" : "Reject";
      if (!confirm(`${label} request #${id}?`)) return;
      setActionLoading(`${id}-${action}`);
      try {
        const res = await fetch("/api/admin/attendance-regularization", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Action failed");
        toast.success(data.message || `${label}d successfully`);
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

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="mb-6 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Attendance regularization — all requests
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Submissions from employees; reviewed by reporting managers. Admin
            overview.
          </p>
        </div>
        <Link
          href="/admin-dashboard"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900 underline shrink-0"
        >
          ← Back to dashboard
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-600 py-12 text-center">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="w-full text-gray-600 rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
          No regularization requests found. Ensure the database table exists and
          employees have submitted requests.
        </p>
      ) : (
        <div className="w-full bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-full text-sm">
              <thead className="bg-gray-100 text-left text-gray-700">
                <tr>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">ID</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Employee</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
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
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800">{req.id}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {req.username}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatLogDate(req.log_date)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadge(req.status)}`}
                      >
                        {req.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 min-w-0 text-gray-700 align-top break-words">
                      {req.reason || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      <div className="flex flex-col gap-0.5">
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
                      {req.status === "pending" ? (
                        <div className="flex gap-2">
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
    </div>
  );
}
