"use client";

import { useEffect, useState } from "react";
import { Check, X, RefreshCcw, Eye } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "reassign", label: "Reassign" },
];

function displayStatus(status) {
  if (!status) return "—";
  if (status === "revision_requested") return "reassign";
  if (status === "pending_admin") return "with super admin";
  if (status === "pending_hr_docs") return "HR documents";
  return status;
}

function statusBadgeClass(status) {
  switch (status) {
    case "approved": return "bg-green-100 text-green-800";
    case "rejected": return "bg-red-100 text-red-800";
    case "reassign":
    case "revision_requested": return "bg-amber-100 text-amber-900";
    case "pending": return "bg-blue-100 text-blue-800";
    case "pending_admin": return "bg-violet-100 text-violet-900";
    case "pending_hr_docs": return "bg-indigo-100 text-indigo-900";
    default: return "bg-gray-100 text-gray-800";
  }
}

/** Parse field_changes count from submission payload */
function getChangedFieldsCount(submission) {
  try {
    const payload = typeof submission.payload === "string"
      ? JSON.parse(submission.payload)
      : submission.payload;
    return Array.isArray(payload?.field_changes) ? payload.field_changes.length : 0;
  } catch {
    return 0;
  }
}

/** Parse field_changes labels from submission payload */
function getChangedFieldLabels(submission) {
  try {
    const payload = typeof submission.payload === "string"
      ? JSON.parse(submission.payload)
      : submission.payload;
    if (!Array.isArray(payload?.field_changes)) return [];
    return payload.field_changes.map((c) => c.label).filter(Boolean);
  } catch {
    return [];
  }
}

export default function ProfileApprovalsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/empcrm/profile/submissions?status=${encodeURIComponent(tab)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) setSubmissions(data.submissions || []);
      else toast.error(data.error || "Failed to load submissions");
    } catch (e) {
      toast.error("Error loading submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const approve = async (id) => {
    try {
      const res = await fetch("/api/empcrm/profile/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id, action: "approve" }),
      });
      const data = await res.json();
      if (data.success) { toast.success(data.message || "Approved"); load(); }
      else toast.error(data.error || "Failed to approve");
    } catch { toast.error("Error approving"); }
  };

  const reject = async (id) => {
    const reason = prompt("Enter rejection reason (optional)");
    try {
      const res = await fetch("/api/empcrm/profile/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id, action: "reject", rejection_reason: reason || "" }),
      });
      const data = await res.json();
      if (data.success) { toast.success("Rejected"); load(); }
      else toast.error(data.error || "Failed to reject");
    } catch { toast.error("Error rejecting"); }
  };

  const emptyMessage = {
    pending: "No pending submissions.",
    approved: "No approved submissions yet.",
    rejected: "No rejected submissions.",
    reassign: "No profiles are currently with the employee for correction.",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Profile Approvals</h1>
        <button type="button" onClick={load}
          className="px-3 py-2 bg-gray-100 rounded-md text-gray-700 hover:bg-gray-200 flex items-center gap-2 self-start">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-3">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="text-gray-600">{emptyMessage[tab] || "No submissions."}</div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EmpID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changed Fields</th>
                {tab === "pending" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned HR</th>
                )}
                {tab !== "pending" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewed</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {submissions.map((s) => {
                const changedCount = getChangedFieldsCount(s);
                const changedLabels = getChangedFieldLabels(s);
                return (
                  <tr key={s.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.empId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(s.status)}`}>
                        {displayStatus(s.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {changedCount > 0 ? (
                        <div className="group relative w-fit">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold cursor-default">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {changedCount} field{changedCount > 1 ? "s" : ""} edited
                          </span>
                          {/* Tooltip with field names */}
                          <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3">
                            <p className="font-semibold mb-1 text-indigo-300">Fields changed:</p>
                            <ul className="space-y-0.5">
                              {changedLabels.map((label, i) => (
                                <li key={i} className="text-gray-200">• {label}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    {tab === "pending" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {s.pending_assignee_username?.trim() ? (
                          <span className="text-violet-800 font-medium">@{s.pending_assignee_username.trim()}</span>
                        ) : "—"}
                      </td>
                    )}
                    {tab !== "pending" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {s.reviewed_at ? new Date(s.reviewed_at).toLocaleString() : "—"}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/empcrm/admin-dashboard/profile/approvals/${s.id}`}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1 w-fit">
                          <Eye className="w-4 h-4" /> View
                        </Link>
                        {s.status === "pending" && (
                          <>
                            <button type="button" onClick={() => approve(s.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1">
                              <Check className="w-4 h-4" /> Approve
                            </button>
                            <button type="button" onClick={() => reject(s.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1">
                              <X className="w-4 h-4" /> Reject
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
      )}
    </div>
  );
}

