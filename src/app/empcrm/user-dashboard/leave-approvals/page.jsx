"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  User,
  ArrowLeft,
  Sun,
  BadgeCheck,
} from "lucide-react";
import Link from "next/link";

export default function LeaveApprovalsPage() {
  const [leaves, setLeaves] = useState([]);
  const [filteredLeaves, setFilteredLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [acknowledgementRemark, setAcknowledgementRemark] = useState("");
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    fetchLeaves();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [leaves, statusFilter, searchTerm]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/empcrm/leaves?mode=approve");
      const data = await response.json();

      if (data.success) {
        setLeaves(data.leaves || []);
        if (!data.isAdmin && (data.leaves || []).length === 0) {
          setHasAccess(false);
        }
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error("Error fetching leaves:", error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...leaves];
    if (statusFilter !== "all") {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(
        (l) =>
          l.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.empId?.toString().includes(searchTerm)
      );
    }
    setFilteredLeaves(filtered);
  };

  const handleApprove = async (leaveId) => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/empcrm/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveId, status: "approved" }),
      });
      const data = await res.json();
      if (data.success) {
        setShowApprovalModal(false);
        setSelectedLeave(null);
        fetchLeaves();
      } else {
        alert(data.error || "Failed to approve");
      }
    } catch (e) {
      alert("Error approving leave");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert("Please enter rejection reason");
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch("/api/empcrm/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveId: selectedLeave.id,
          status: "rejected",
          rejection_reason: rejectionReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowApprovalModal(false);
        setSelectedLeave(null);
        setRejectionReason("");
        fetchLeaves();
      } else {
        alert(data.error || "Failed to reject");
      }
    } catch (e) {
      alert("Error rejecting leave");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = async (leaveId) => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/empcrm/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveId, status: "acknowledge", acknowledgement_remark: acknowledgementRemark }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAcknowledgeModal(false);
        setAcknowledgementRemark("");
        setSelectedLeave(null);
        fetchLeaves();
      } else {
        alert(data.error || "Failed to acknowledge");
      }
    } catch (e) {
      alert("Error acknowledging leave");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status, acknowledgedAt) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      approved: "bg-green-100 text-green-800 border-green-300",
      rejected: "bg-red-100 text-red-800 border-red-300",
    };
    const icons = {
      pending: <Clock className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />,
    };

    // If acknowledged, show only Acknowledged badge
    if (acknowledgedAt) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
          <BadgeCheck className="w-3 h-3" />
          Acknowledged
        </span>
      );
    }

    const statusBadge = (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || "bg-gray-100"}`}
      >
        {icons[status]}
        {status?.charAt(0)?.toUpperCase() + status?.slice(1)}
      </span>
    );
    return statusBadge;
  };

  const getLeaveTypeColor = (type) => {
    const colors = {
      sick: "bg-blue-100 text-blue-800",
      paid: "bg-purple-100 text-purple-800",
      casual: "bg-green-100 text-green-800",
      unpaid: "bg-gray-100 text-gray-800",
      "half-day": "bg-orange-100 text-orange-700",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "-";

  const pendingCount = leaves.filter((l) => l.status === "pending").length;

  if (!hasAccess && !loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium">
            You don&apos;t have any reportees assigned, or no leave applications to approve.
          </p>
          <Link
            href="/empcrm/user-dashboard"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/empcrm/user-dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Calendar className="w-7 h-7 text-blue-600" />
            Leave Approvals
          </h1>
          <p className="text-gray-600 mt-1">
            Approve or reject leave applications from your reportees
          </p>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 font-medium">
            {pendingCount} pending leave application{pendingCount !== 1 ? "s" : ""} to review
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, username, or empId..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No leave applications found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Leave Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {leave.full_name || leave.username}
                          </div>
                          <div className="text-sm text-gray-500">
                            EmpID: {leave.empId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${leave.is_half_day ? "bg-orange-100 text-orange-700" : getLeaveTypeColor(leave.leave_type)}`}
                        >
                          {leave.is_half_day ? "Half-Day" : leave.leave_type?.charAt(0)?.toUpperCase() +
                            leave.leave_type?.slice(1)}
                        </span>
                        {leave.is_half_day ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                            <Sun className="w-3 h-3" />
                            {leave.half_day_type === "1st_half" ? "1st Half" : "2nd Half"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>{formatDate(leave.from_date)}</div>
                      {!leave.is_half_day && (
                        <div className="text-gray-500">to {formatDate(leave.to_date)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {leave.is_half_day ? "½" : leave.total_days}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(leave.status, leave.acknowledged_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {leave.status === "pending" && !leave.acknowledged_at && (
                          <button
                            onClick={() => {
                              setSelectedLeave(leave);
                              setShowAcknowledgeModal(true);
                              setAcknowledgementRemark("");
                            }}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                          >
                            Acknowledge
                          </button>
                        )}
                        {!leave.acknowledged_at && (
                          <button
                            onClick={() => {
                              setSelectedLeave(leave);
                              setShowApprovalModal(true);
                              setRejectionReason("");
                            }}
                            className={`px-3 py-1 rounded-lg text-sm font-medium ${
                              leave.status === "pending"
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {leave.status === "pending" ? "Review" : "View"}
                          </button>
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

      {/* Approval Modal */}
      {showApprovalModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Leave Details</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Employee:</span>{" "}
                {selectedLeave.full_name || selectedLeave.username}
              </p>
              <p>
                <span className="font-medium">Type:</span>{" "}
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${selectedLeave.is_half_day ? "bg-orange-100 text-orange-700" : getLeaveTypeColor(selectedLeave.leave_type)}`}>
                  {selectedLeave.is_half_day ? "Half-Day" : selectedLeave.leave_type?.charAt(0)?.toUpperCase() + selectedLeave.leave_type?.slice(1)}
                </span>
                {selectedLeave.is_half_day && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                    <Sun className="w-3 h-3" />
                    Half-Day · {selectedLeave.half_day_type === "1st_half" ? "1st Half (Morning)" : "2nd Half (Afternoon)"}
                  </span>
                )}
              </p>
              <p>
                <span className="font-medium">{selectedLeave.is_half_day ? "Date:" : "From:"}</span>{" "}
                {formatDate(selectedLeave.from_date)}
                {!selectedLeave.is_half_day && <> - {formatDate(selectedLeave.to_date)}</>}
              </p>
              <p>
                <span className="font-medium">Days:</span>{" "}
                {selectedLeave.is_half_day ? "0.5 (Half-Day)" : selectedLeave.total_days}
              </p>
              <p>
                <span className="font-medium">Reason:</span>{" "}
                {selectedLeave.reason}
              </p>
              <p className="pt-1">
                <span className="font-medium">Status:</span>{" "}
                <span className="inline-block align-middle">
                  {getStatusBadge(selectedLeave.status, selectedLeave.acknowledged_at)}
                </span>
              </p>
              {selectedLeave.reviewed_by && (
                <p className="text-xs text-gray-600">
                  Reviewed by <span className="font-medium">{selectedLeave.reviewed_by}</span> on {formatDate(selectedLeave.reviewed_at)}
                </p>
              )}
              {selectedLeave.acknowledged_by && (
                <p className="text-xs text-indigo-600 flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Acknowledged by <span className="font-medium">{selectedLeave.acknowledged_by}</span> on {formatDate(selectedLeave.acknowledged_at)}
                </p>
              )}
            </div>

            {selectedLeave.status === "pending" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection reason (if rejecting)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Required when rejecting"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedLeave(null);
                  setRejectionReason("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {selectedLeave.status === "pending" && (
                <>
                  <button
                    onClick={() => handleApprove(selectedLeave.id)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading ? "..." : "Reject"}
                  </button>
                  {!selectedLeave.acknowledged_at && (
                    <button
                      onClick={() => {
                        setShowApprovalModal(false);
                        setShowAcknowledgeModal(true);
                        setAcknowledgementRemark("");
                      }}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {actionLoading ? "..." : "Acknowledge"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Acknowledgement Remark Modal */}
      {showAcknowledgeModal && selectedLeave && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <BadgeCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Acknowledge Leave</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedLeave.full_name || selectedLeave.username}
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
                  placeholder="Enter your remark or comment about this leave..."
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
                  setSelectedLeave(null);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAcknowledge(selectedLeave.id)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Acknowledge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
