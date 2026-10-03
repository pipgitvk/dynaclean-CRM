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

/** Proposed column only when employee actually changed this field vs current log */
function proposedDiffersFromCurrent(original, proposed) {
  const cur = (formatTime(original) || "").trim();
  const next = (formatTime(proposed) || "").trim();
  return cur !== next;
}

export default function AttendanceRegularizationApprovalsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [commentById, setCommentById] = useState({});

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
    setActingId(id);
    try {
      const res = await fetch("/api/attendance/regularization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          reviewer_comment: commentById[id] || null,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Attendance regularization — approvals
        </h1>
        <Link
          href="/user-dashboard/attendance"
          className="text-sm font-medium text-teal-700 hover:text-teal-900 underline"
        >
          Back to attendance
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="text-gray-600 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          No pending regularization requests.
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
                  <p className="font-semibold text-gray-900">
                    {req.username}
                  </p>
                  <p className="text-sm text-gray-600">
                    Date: {formatLogDate(req.log_date)}
                  </p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-amber-800 bg-amber-100 px-2 py-1 rounded">
                  Pending
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                <span className="font-medium">Reason:</span> {req.reason || "—"}
              </p>
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
                      <th className="py-2 font-medium">Proposed</th>
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
                            {formatTime(orig) || "—"}
                          </td>
                          <td className="py-2 font-medium text-teal-800">
                            {changed ? formatTime(prop) || "—" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Comment (optional)
                </label>
                <textarea
                  value={commentById[req.id] || ""}
                  onChange={(e) =>
                    setCommentById((prev) => ({
                      ...prev,
                      [req.id]: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full max-w-xl px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Note for the employee (optional)"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
