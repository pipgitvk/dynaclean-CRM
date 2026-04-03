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

/** DB may still have legacy revision_requested — show as reassign */
function displayStatus(status) {
  if (!status) return "—";
  if (status === "revision_requested") return "reassign";
  return status;
}

function statusBadgeClass(status) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "reassign":
    case "revision_requested":
      return "bg-amber-100 text-amber-900";
    case "pending":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
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

  useEffect(() => {
    load();
  }, [tab]);

  const approve = async (id) => {
    try {
      const res = await fetch("/api/empcrm/profile/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id, action: "approve" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Approved");
        load();
      } else toast.error(data.error || "Failed to approve");
    } catch (e) {
      toast.error("Error approving");
    }
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
      if (data.success) {
        toast.success("Rejected");
        load();
      } else toast.error(data.error || "Failed to reject");
    } catch (e) {
      toast.error("Error rejecting");
    }
  };

  const emptyMessage = {
    pending: "No pending submissions.",
    approved: "No approved submissions yet.",
    rejected: "No rejected submissions.",
    reassign:
      "No profiles are currently with the employee for correction.",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Profile Approvals</h1>
        <button
          type="button"
          onClick={load}
          className="px-3 py-2 bg-gray-100 rounded-md text-gray-700 hover:bg-gray-200 flex items-center gap-2 self-start"
        >
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
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
                {tab !== "pending" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewed</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {submissions.map((s) => (
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
                  {tab !== "pending" && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {s.reviewed_at ? new Date(s.reviewed_at).toLocaleString() : "—"}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/empcrm/admin-dashboard/profile/approvals/${s.id}`}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1 w-fit"
                      >
                        <Eye className="w-4 h-4" /> View
                      </Link>
                      {s.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => approve(s.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                          >
                            <Check className="w-4 h-4" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(s.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
