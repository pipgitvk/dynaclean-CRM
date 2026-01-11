"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter,
  Search,
  ChevronDown,
  User,
  AlertCircle
} from "lucide-react";

export default function AdminLeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [filteredLeaves, setFilteredLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Leave policy management
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [policyLoading, setPolicyLoading] = useState(false);
  const [leavePolicy, setLeavePolicy] = useState({ sick_enabled: true, paid_enabled: true, sick_allowed: 0, paid_allowed: 0 });
  const [policyMessage, setPolicyMessage] = useState("");

  // Tabs: approvals | employee
  const [activeTab, setActiveTab] = useState("approvals");

  useEffect(() => {
    fetchLeaves();
    fetchEmployees();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [leaves, statusFilter, searchTerm]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/empcrm/leaves");
      const data = await response.json();
      
      if (data.success) {
        setLeaves(data.leaves);
      }
    } catch (error) {
      console.error("Error fetching leaves:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/empcrm/employees");
      const data = await res.json();
      if (data?.success) setEmployees(data.employees || []);
    } catch (e) {
      console.error("Error fetching employees for policy:", e);
    }
  };

  const fetchPolicy = async (username) => {
    if (!username) return;
    setPolicyLoading(true);
    setPolicyMessage("");
    try {
      const res = await fetch(`/api/empcrm/leaves/policy?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data?.success && data?.policy) {
        setLeavePolicy({
          sick_enabled: !!data.policy.sick_enabled,
          paid_enabled: !!data.policy.paid_enabled,
          sick_allowed: Number(data.policy.sick_allowed || 0),
          paid_allowed: Number(data.policy.paid_allowed || 0),
        });
      } else {
        setPolicyMessage(data?.message || "Failed to load leave policy");
      }
    } catch (e) {
      console.error("Fetch policy error:", e);
      setPolicyMessage("Error loading leave policy");
    } finally {
      setPolicyLoading(false);
    }
  };

  const savePolicy = async () => {
    if (!selectedUser) return;
    setPolicyLoading(true);
    setPolicyMessage("");
    try {
      const res = await fetch("/api/empcrm/leaves/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selectedUser, ...leavePolicy })
      });
      const data = await res.json();
      if (data?.success) setPolicyMessage("Saved successfully");
      else setPolicyMessage(data?.message || "Failed to save");
    } catch (e) {
      console.error("Save policy error:", e);
      setPolicyMessage("Error saving leave policy");
    } finally {
      setPolicyLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...leaves];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(leave => leave.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(leave =>
        leave.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leave.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leave.empId?.toString().includes(searchTerm)
      );
    }

    setFilteredLeaves(filtered);
  };

  const handleApprove = async (leaveId) => {
    try {
      setActionLoading(true);
      const response = await fetch("/api/empcrm/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveId, status: "approved" })
      });

      const data = await response.json();
      
      if (data.success) {
        alert("Leave approved successfully");
        fetchLeaves();
        setShowApprovalModal(false);
      } else {
        alert(data.error || "Failed to approve leave");
      }
    } catch (error) {
      console.error("Error approving leave:", error);
      alert("Error approving leave");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (leaveId) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch("/api/empcrm/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          leaveId, 
          status: "rejected",
          rejection_reason: rejectionReason 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert("Leave rejected successfully");
        fetchLeaves();
        setShowApprovalModal(false);
        setRejectionReason("");
      } else {
        alert(data.error || "Failed to reject leave");
      }
    } catch (error) {
      console.error("Error rejecting leave:", error);
      alert("Error rejecting leave");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      approved: "bg-green-100 text-green-800 border-green-300",
      rejected: "bg-red-100 text-red-800 border-red-300"
    };

    const icons = {
      pending: <Clock className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getLeaveTypeColor = (type) => {
    const colors = {
      sick: "bg-blue-100 text-blue-800",
      paid: "bg-purple-100 text-purple-800",
      casual: "bg-green-100 text-green-800",
      unpaid: "bg-gray-100 text-gray-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const pendingCount = leaves.filter(l => l.status === "pending").length;
  const approvedCount = leaves.filter(l => l.status === "approved").length;
  const rejectedCount = leaves.filter(l => l.status === "rejected").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          Leave Management
        </h1>
        <p className="text-gray-600 mt-2">Review and manage employee leave applications</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("approvals")}
            className={`pb-2 -mb-px border-b-2 text-sm font-medium ${
              activeTab === "approvals" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            Approvals
          </button>
          <button
            onClick={() => setActiveTab("employee")}
            className={`pb-2 -mb-px border-b-2 text-sm font-medium ${
              activeTab === "employee" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            Employee Leaves & Quota
          </button>
        </nav>
      </div>

      {activeTab === "approvals" && (
      <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Pending</p>
              <p className="text-2xl font-bold text-yellow-800">{pendingCount}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Approved</p>
              <p className="text-2xl font-bold text-green-800">{approvedCount}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Rejected</p>
              <p className="text-2xl font-bold text-red-800">{rejectedCount}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leave Applications Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No leave applications found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leave Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{leave.full_name || leave.username}</div>
                          <div className="text-sm text-gray-500">EmpID: {leave.empId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.leave_type)}`}>
                        {leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{formatDate(leave.from_date)}</div>
                      <div className="text-gray-500">to {formatDate(leave.to_date)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-semibold text-gray-900">{leave.total_days}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(leave.status)}
                    </td>
                    <td className="px-6 py-4">
                      {leave.status === "pending" ? (
                        <button
                          onClick={() => {
                            setSelectedLeave(leave);
                            setShowApprovalModal(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedLeave(leave);
                            setShowApprovalModal(true);
                          }}
                          className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-medium"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {activeTab === "employee" && (
      <>
        {/* Employee Leave Policy & History */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Employee Leave Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
              <select
                value={selectedUser}
                onChange={(e) => { setSelectedUser(e.target.value); fetchPolicy(e.target.value); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose employee...</option>
                {employees.map(emp => (
                  <option key={emp.empId} value={emp.username}>{emp.username}{emp.full_name ? ` - ${emp.full_name}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sick Allowed</label>
              <input
                type="number"
                value={leavePolicy.sick_allowed}
                onChange={(e) => setLeavePolicy({ ...leavePolicy, sick_allowed: Number(e.target.value || 0) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                disabled={!selectedUser || policyLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid Allowed</label>
              <input
                type="number"
                value={leavePolicy.paid_allowed}
                onChange={(e) => setLeavePolicy({ ...leavePolicy, paid_allowed: Number(e.target.value || 0) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                disabled={!selectedUser || policyLoading}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={savePolicy}
              disabled={!selectedUser || policyLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {policyLoading ? "Saving..." : "Save Policy"}
            </button>
            {policyMessage && <span className="text-sm text-gray-600">{policyMessage}</span>}
          </div>
        </div>

        {/* Leave usage summary & history for selected employee */}
        {selectedUser ? (
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{selectedUser} - Leave Summary & History</h3>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-blue-50">
                <p className="text-sm text-blue-700">Sick Allowed</p>
                <p className="text-2xl font-bold text-blue-900">{leavePolicy.sick_allowed}</p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50">
                <p className="text-sm text-purple-700">Paid Allowed</p>
                <p className="text-2xl font-bold text-purple-900">{leavePolicy.paid_allowed}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-700">Unpaid Used</p>
                <p className="text-2xl font-bold text-gray-900">{
                  filteredLeaves.filter(l => l.username === selectedUser && l.status === 'approved' && l.leave_type === 'unpaid').reduce((a,b)=> a + Number(b.total_days||0), 0)
                }</p>
              </div>
            </div>

            {/* History Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaves
                    .filter(l => l.username === selectedUser)
                    .sort((a,b)=> new Date(b.from_date) - new Date(a.from_date))
                    .map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900">{formatDate(l.from_date)} - {formatDate(l.to_date)}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(l.leave_type)}`}>{l.leave_type}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-900">{l.total_days}</td>
                      <td className="px-6 py-3">{getStatusBadge(l.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 text-gray-500">Select an employee to view summary and history.</div>
        )}
      </>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Leave Application Details</h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Employee Name</label>
                  <p className="text-gray-900 font-medium">{selectedLeave.full_name || selectedLeave.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Employee ID</label>
                  <p className="text-gray-900 font-medium">{selectedLeave.empId}</p>
                </div>
              </div>

              {/* Leave Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Leave Type</label>
                  <p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(selectedLeave.leave_type)}`}>
                      {selectedLeave.leave_type.charAt(0).toUpperCase() + selectedLeave.leave_type.slice(1)}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Total Days</label>
                  <p className="text-gray-900 font-medium">{selectedLeave.total_days} days</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">From Date</label>
                  <p className="text-gray-900">{formatDate(selectedLeave.from_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">To Date</label>
                  <p className="text-gray-900">{formatDate(selectedLeave.to_date)}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Reason</label>
                <p className="text-gray-900 mt-1 p-3 bg-gray-50 rounded-lg">{selectedLeave.reason}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <div className="mt-1">{getStatusBadge(selectedLeave.status)}</div>
              </div>

              {selectedLeave.status === "rejected" && selectedLeave.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                      <p className="text-sm text-red-700 mt-1">{selectedLeave.rejection_reason}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedLeave.reviewed_by && (
                <div className="text-sm text-gray-600">
                  Reviewed by <span className="font-medium">{selectedLeave.reviewed_by}</span> on{" "}
                  {formatDate(selectedLeave.reviewed_at)}
                </div>
              )}

              {selectedLeave.status === "pending" && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Rejection Reason (if rejecting)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      rows={3}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setRejectionReason("");
                  setSelectedLeave(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={actionLoading}
              >
                Close
              </button>

              {selectedLeave.status === "pending" && (
                <>
                  <button
                    onClick={() => handleReject(selectedLeave.id)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    {actionLoading ? "Processing..." : "Reject"}
                  </button>

                  <button
                    onClick={() => handleApprove(selectedLeave.id)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {actionLoading ? "Processing..." : "Approve"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
