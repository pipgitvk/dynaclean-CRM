"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
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

export default function ApprovalHistoryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <p className="text-gray-600">Loading approval history...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Approval History
        </h1>
        <div className="flex gap-2">
          <Link
            href="/empcrm/user-dashboard/overtime"
            className="text-sm font-medium text-teal-700 hover:text-teal-900 underline"
          >
            Back to pending approvals
          </Link>
          <Link
            href="/empcrm/user-dashboard/attendance"
            className="text-sm font-medium text-teal-700 hover:text-teal-900 underline"
          >
            Back to attendance
          </Link>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="text-gray-600 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          No approval history found. You haven't approved or rejected any regularization requests yet.
        </p>
      ) : (
        <ul className="space-y-6">
          {requests.map((req) => (
            <li
              key={req.id}
              className="rounded-lg border border-gray-200 bg-white p-4 md:p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <div>
                  <p className="font-semibold text-gray-900">{req.username}</p>
                  <p className="text-sm text-gray-600">
                    Date: {formatLogDate(req.log_date)}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium uppercase tracking-wide px-2 py-1 rounded ${
                    req.status === "approved"
                      ? "text-green-800 bg-green-100"
                      : "text-red-800 bg-red-100"
                  }`}
                >
                  {req.status === "approved" ? "Approved" : "Rejected"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Submitted on:</p>
                  <p className="text-sm text-gray-700">{formatDateTime(req.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Reviewed on:</p>
                  <p className="text-sm text-gray-700">{formatDateTime(req.reviewed_at)}</p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-4">
                <span className="font-medium">Reason:</span>{" "}
                {req.reason || "No reason provided"}
              </p>

              {req.reviewer_comment && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Your remarks:</p>
                  <p className="text-sm text-gray-700">{req.reviewer_comment}</p>
                </div>
              )}

              {req.attachment_url ? (
                <p className="text-sm mb-4">
                  <a
                    href={req.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-teal-700 underline hover:text-teal-900"
                  >
                    View attachment
                  </a>
                </p>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-4 font-medium">Field</th>
                      <th className="py-2 pr-4 font-medium">Current</th>
                      <th className="py-2 pr-4 font-medium">Requested</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELDS.map(({ key, label }) => {
                      const orig = req[`original_${key}`];
                      const prop = req[`proposed_${key}`];
                      const changed = proposedDiffersFromCurrent(orig, prop);
                      return (
                        <tr key={key} className="border-b border-gray-100">
                          <td className="py-2 pr-4 text-gray-700">{label}</td>
                          <td className="py-2 pr-4 text-gray-600">
                            {formatTime(orig) || "Absent"}
                          </td>
                          <td className="py-2 pr-4 font-medium text-teal-800">
                            {changed ? formatTime(prop) || "Not specified" : "No change"}
                          </td>
                          <td className="py-2">
                            {req.status === "approved" && changed ? (
                              <span className="text-green-600 font-medium">Updated</span>
                            ) : req.status === "rejected" && changed ? (
                              <span className="text-red-600 font-medium">Rejected</span>
                            ) : (
                              <span className="text-gray-400">No change</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
