"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Plus,
  Sun,
  ArrowLeft,
  AlertCircle,
  Loader,
  Clock
} from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import Link from "next/link";

export default function AddPaidLeavePage() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Full-day leave form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    from_date: "",
    to_date: "",
    reason: ""
  });

  // Half-day leave form
  const [showHalfDayForm, setShowHalfDayForm] = useState(false);
  const [halfDayData, setHalfDayData] = useState({
    date: "",
    half_day_type: "1st_half",
    reason: ""
  });

  useEffect(() => {
    checkAccess();
    fetchEmployees();
    fetchLeaves();
  }, []);

  const checkAccess = async () => {
    try {
      const res = await fetch("/api/my-modules");
      const data = await res.json();
      if (data?.allowedModules && Array.isArray(data.allowedModules) && data.allowedModules.includes("add-paid-leaves")) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (e) {
      setHasAccess(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/empcrm/employees");
      const data = await res.json();
      if (data?.success) {
        setEmployees(data.employees || []);
      } else {
        const fallbackRes = await fetch("/api/search-users?search=");
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData)) {
          setEmployees(fallbackData.map(u => ({ username: u.username, userRole: u.userRole })));
        }
      }
    } catch (e) {
      console.error("Error fetching employees:", e);
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/hr-operations/paid-leaves");
      const data = await res.json();
      if (data?.success) {
        setLeaves(data.leaves || []);
      }
    } catch (e) {
      console.error("Error fetching leaves:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !formData.from_date || !formData.to_date || !formData.reason.trim()) {
      alert("Please fill in all fields");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/hr-operations/paid-leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedEmployee,
          from_date: formData.from_date,
          to_date: formData.to_date,
          reason: formData.reason,
          is_half_day: false
        })
      });

      const data = await res.json();
      if (data.success) {
        alert("Paid leave request submitted for approval");
        setShowForm(false);
        setFormData({ from_date: "", to_date: "", reason: "" });
        fetchLeaves();
      } else {
        alert(data.error || "Failed to add leave");
      }
    } catch (error) {
      console.error("Error adding leave:", error);
      alert("Error adding leave");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHalfDaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !halfDayData.date || !halfDayData.reason.trim()) {
      alert("Please fill in all fields");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/hr-operations/paid-leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedEmployee,
          from_date: halfDayData.date,
          to_date: halfDayData.date,
          reason: halfDayData.reason,
          is_half_day: true,
          half_day_type: halfDayData.half_day_type
        })
      });

      const data = await res.json();
      if (data.success) {
        alert("Half-day paid leave request submitted for approval");
        setShowHalfDayForm(false);
        setHalfDayData({ date: "", half_day_type: "1st_half", reason: "" });
        fetchLeaves();
      } else {
        alert(data.error || "Failed to add half-day leave");
      }
    } catch (error) {
      console.error("Error adding half-day leave:", error);
      alert("Error adding half-day leave");
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotalDays = () => {
    if (formData.from_date && formData.to_date) {
      const from = new Date(formData.from_date);
      const to = new Date(formData.to_date);
      const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
      return days > 0 ? days : 0;
    }
    return 0;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (leave) => {
    if (leave.status === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ Approved
        </span>
      );
    } else if (leave.status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    } else if (leave.status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          ✗ Rejected
        </span>
      );
    }
    return <span className="text-gray-500">-</span>;
  };

  const selectedEmpName = selectedEmployee
    ? employees.find(e => e.username === selectedEmployee)?.full_name || selectedEmployee
    : "";

  if (!hasAccess && !loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-red-800 font-medium">
            Access Denied. You don't have permission to access this module.
          </p>
          <Link
            href="/user-dashboard"
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
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <Link
            href="/user-dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            Add Paid Leave Request
          </h1>
          <p className="text-gray-600 mt-2">Submit paid leave requests that will be reviewed by management</p>
        </div>
      </div>

      {/* Employee Selector & Action Buttons */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Employee <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "-- Select Employee --" },
                ...employees.map(emp => ({
                  value: emp.username,
                  label: `${emp.username}${emp.full_name ? ` - ${emp.full_name}` : ""}${emp.empId ? ` (${emp.empId})` : ""}`
                }))
              ]}
              value={selectedEmployee}
              onChange={(val) => setSelectedEmployee(val)}
              placeholder="-- Select Employee --"
              searchPlaceholder="Search employee..."
            />
          </div>

          {selectedEmployee && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(true)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Full-Day Leave
              </button>
              <button
                onClick={() => setShowHalfDayForm(true)}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium flex items-center justify-center gap-2"
              >
                <Sun className="w-5 h-5" />
                Add Half-Day Leave
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Leaves History */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Submitted Paid Leave Requests</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader className="w-5 h-5 animate-spin" />
            Loading...
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No paid leave requests yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{leave.username}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{formatDate(leave.from_date)}</div>
                      {!leave.is_half_day && (
                        <div className="text-gray-500">to {formatDate(leave.to_date)}</div>
                      )}
                      {leave.is_half_day && (
                        <div className="text-gray-500 flex items-center gap-1">
                          <Sun className="w-3 h-3" />
                          {leave.half_day_type === "1st_half" ? "1st Half" : "2nd Half"}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-semibold text-gray-900">
                        {leave.is_half_day ? "½" : leave.total_days}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {leave.reason}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        {leave.created_by || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(leave)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full-Day Leave Modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Add Full-Day Paid Leave</h2>
              <p className="text-sm text-gray-600 mt-1">Employee: <span className="font-medium">{selectedEmpName}</span></p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.from_date}
                    onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.to_date}
                    onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                    min={formData.from_date}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {calculateTotalDays() > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    Total Days: <span className="font-bold">{calculateTotalDays()} days</span>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Enter reason for this leave..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ from_date: "", to_date: "", reason: "" });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Half-Day Leave Modal */}
      {showHalfDayForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Sun className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Add Half-Day Paid Leave</h2>
                <p className="text-xs text-gray-500 mt-0.5">Employee: <span className="font-medium">{selectedEmpName}</span></p>
              </div>
            </div>

            <form onSubmit={handleHalfDaySubmit} className="p-6 space-y-4">
              {/* Half type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Half-Day Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHalfDayData({ ...halfDayData, half_day_type: "1st_half" })}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      halfDayData.half_day_type === "1st_half"
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
                    }`}
                  >
                    <Sun className="w-6 h-6 mb-1" />
                    <span className="font-semibold text-sm">1st Half</span>
                    <span className="text-xs opacity-75">Morning</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHalfDayData({ ...halfDayData, half_day_type: "2nd_half" })}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      halfDayData.half_day_type === "2nd_half"
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
                    }`}
                  >
                    <Sun className="w-6 h-6 mb-1" />
                    <span className="font-semibold text-sm">2nd Half</span>
                    <span className="text-xs opacity-75">Afternoon</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={halfDayData.date}
                  onChange={(e) => setHalfDayData({ ...halfDayData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={halfDayData.reason}
                  onChange={(e) => setHalfDayData({ ...halfDayData, reason: e.target.value })}
                  placeholder="Enter reason for this half-day leave..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  Half-day counts as <span className="font-bold">0.5 days</span>
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowHalfDayForm(false);
                    setHalfDayData({ date: "", half_day_type: "1st_half", reason: "" });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
