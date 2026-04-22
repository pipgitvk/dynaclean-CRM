"use client";

import { useEffect, useState } from "react";
import { Check, X, RefreshCcw, Eye, Shield } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const TABS = [
  { key: "pending_admin", label: "Pending publish" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function displayStatus(status) {
  if (!status) return "—";
  if (status === "pending_admin") return "Awaiting publish";
  return status;
}

function statusBadgeClass(status) {
  if (status === "pending_admin") return "bg-violet-100 text-violet-900";
  if (status === "approved") return "bg-green-100 text-green-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

/**
 * Super Admin — profile submissions: pending publish, approved, rejected.
 * API returns 403 for non–Super Admin.
 */
export default function ProfileApprovalsAdminPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);
  const [tab, setTab] = useState("pending_admin");
  const [activityFilter, setActivityFilter] = useState("active");

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status: tab });
      if (tab === "approved" || tab === "rejected") {
        qs.set("adminFinalOnly", "1");
      }
      const res = await fetch(`/api/empcrm/profile/submissions?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (res.status === 403) {
        setAllowed(false);
        setSubmissions([]);
        toast.error(data.error || "Access denied");
        return;
      }
      if (data.success) setSubmissions(data.submissions || []);
      else toast.error(data.error || "Failed to load");
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
        toast.success(data.message || "Profile published");
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
        toast.success(data.message || "Rejected");
        load();
      } else toast.error(data.error || "Failed to reject");
    } catch (e) {
      toast.error("Error rejecting");
    }
  };

  const emptyMessage = {
    pending_admin: "No submissions waiting for you to publish.",
    approved: "No profiles published by Super Admin yet.",
    rejected: "No submissions rejected by Super Admin yet.",
  };

  const isUserActive = (row) => {
    if (row?.user_active === true) return true;
    if (row?.user_active === false) return false;
    if (row?.user_status === 1) return true;
    if (row?.user_status === 0) return false;
    return null;
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (activityFilter === "all") return true;
    const active = isUserActive(s);
    if (activityFilter === "active") return active === true;
    if (activityFilter === "inactive") return active === false;
    return true;
  });

  const filterEmptyLabel =
    activityFilter === "active"
      ? "No active users found for this tab."
      : activityFilter === "inactive"
        ? "No inactive users found for this tab."
        : "No submissions.";

  if (!allowed && !loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-red-600">This page is only for Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-7 h-7 text-violet-600" />
            Profile — Super Admin
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Pending publish (after HR). Approved / Rejected tabs show only actions taken by Super Admin (not HR).
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap self-start">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter</span>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-700"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            type="button"
            onClick={load}
            className="px-3 py-2 bg-gray-100 rounded-md text-gray-700 hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-gray-600">{submissions.length === 0 ? (emptyMessage[tab] || "No submissions.") : filterEmptyLabel}</div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EmpID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tab === "pending_admin" ? "HR reviewed" : "Reviewed at"}
                </th>
                {tab !== "pending_admin" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tab === "rejected" ? "Rejected by" : "By"}
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSubmissions.map((s) => (
                <tr key={s.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.empId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const active = isUserActive(s);
                      if (active === true) {
                        return (
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        );
                      }
                      if (active === false) {
                        return (
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">
                            Inactive
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          —
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(s.status)}`}>
                      {displayStatus(s.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {s.reviewed_at ? new Date(s.reviewed_at).toLocaleString() : "—"}
                  </td>
                  {tab !== "pending_admin" && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {s.reviewed_by ? (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span>{s.reviewed_by}</span>
                          {tab === "rejected" && s.reviewer_role != null && (
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${
                                s.reviewer_role === "SUPERADMIN"
                                  ? "bg-violet-100 text-violet-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {s.reviewer_role === "SUPERADMIN" ? "Admin" : "HR"}
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/empcrm/admin-dashboard/profile/approvals/${s.id}?from=admin`}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1 w-fit"
                      >
                        <Eye className="w-4 h-4" /> View
                      </Link>
                      {tab === "pending_admin" && (
                        <>
                          <button
                            type="button"
                            onClick={() => approve(s.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                          >
                            <Check className="w-4 h-4" /> Publish
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
