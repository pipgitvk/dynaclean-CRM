"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Trash2,
  Sun,
  BadgeCheck
} from "lucide-react";

const formatDays = (val) => {
  const n = Number(val) || 0;
  return Number.isInteger(n) ? n : Number(n.toFixed(2));
};

export default function UserLeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Full-day leave form
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: "",
    from_date: "",
    to_date: "",
    reason: "",
    is_half_day: false,
    half_day_type: "1st_half",
    has_time_range: false,
    start_time: "",
    end_time: "",
    attachment: null,
    attachmentFile: null
  });

  const [submitting, setSubmitting] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [leaveDayPreview, setLeaveDayPreview] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchLeaves();
    fetchStats();
    checkEmailSettings();
  }, []);

  useEffect(() => {
    if (!formData.from_date) {
      setLeaveDayPreview(null);
      return;
    }
    const to = formData.is_half_day ? formData.from_date : formData.to_date;
    if (!to) {
      setLeaveDayPreview(null);
      return;
    }
    const params = new URLSearchParams({
      from_date: formData.from_date,
      to_date: to,
      is_half_day: formData.is_half_day ? "1" : "0",
    });
    fetch(`/api/empcrm/leaves/preview-days?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setLeaveDayPreview(data);
        else setLeaveDayPreview(null);
      })
      .catch(() => setLeaveDayPreview(null));
  }, [formData.from_date, formData.to_date, formData.is_half_day]);

  const checkEmailSettings = async () => {
    try {
      const response = await fetch("/api/empcrm/settings/email-credentials");
      const data = await response.json();
      if (data.success) {
        setEmailConfigured(data.configured);
      }
    } catch (error) {
      console.error("Error checking email settings:", error);
    }
  };

  const handleApplyClick = () => {
    if (emailConfigured === false) {
      setShowSettingsModal(true);
    } else {
      setShowApplicationForm(true);
    }
  };

  const fetchLeaves = async () => {
    try {
      const response = await fetch("/api/empcrm/leaves");
      const data = await response.json();
      if (data.success) {
        setLeaves(data.leaves);
      }
    } catch (error) {
      console.error("Error fetching leaves:", error);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/empcrm/leaves/stats");
      const data = await response.json();
      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Full-day leave submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leave_type || !formData.from_date || !formData.reason.trim()) {
      alert("Please fill in all fields");
      return;
    }
    if (!formData.is_half_day && !formData.to_date) {
      alert("Please select to date");
      return;
    }
    if (formData.has_time_range && (!formData.start_time || !formData.end_time)) {
      alert("Please fill Start Time and End Time when time range is enabled");
      return;
    }
    // Validate attachment for sick leave
    if (formData.leave_type === "sick" && !formData.attachmentFile) {
      alert("Doctor prescription/test report is required for Sick Leave");
      return;
    }
    try {
      setSubmitting(true);
      const leaveDate = formData.from_date;
      const payload = {
        leave_type: formData.leave_type,
        from_date: formData.from_date,
        to_date: formData.is_half_day ? leaveDate : formData.to_date,
        reason: formData.reason,
        is_half_day: formData.is_half_day,
        half_day_type: formData.is_half_day ? formData.half_day_type : null,
        has_time_range: formData.has_time_range,
      };
      if (formData.has_time_range && formData.start_time && formData.end_time) {
        const endDate = formData.is_half_day ? leaveDate : formData.to_date;
        payload.start_date_time = leaveDate ? `${leaveDate}T${formData.start_time}` : null;
        payload.end_date_time   = endDate ? `${endDate}T${formData.end_time}` : null;
      }

      // Handle file upload separately
      if (formData.attachmentFile) {
        const formDataWithFile = new FormData();
        Object.keys(payload).forEach(key => {
          formDataWithFile.append(key, payload[key]);
        });
        formDataWithFile.append("attachment", formData.attachmentFile);

        const response = await fetch("/api/empcrm/leaves", {
          method: "POST",
          body: formDataWithFile
        });
        const data = await response.json();
        if (data.success) {
          alert("Leave application submitted successfully");
          setShowApplicationForm(false);
          setFormData({
            leave_type: "",
            from_date: "",
            to_date: "",
            reason: "",
            is_half_day: false,
            half_day_type: "1st_half",
            has_time_range: false,
            start_time: "",
            end_time: "",
            attachment: null,
            attachmentFile: null
          });
          fetchLeaves();
          fetchStats();
        } else {
          alert(data.error || "Failed to submit leave application");
        }
      } else {
        const response = await fetch("/api/empcrm/leaves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
          alert("Leave application submitted successfully");
          setShowApplicationForm(false);
          setFormData({
            leave_type: "",
            from_date: "",
            to_date: "",
            reason: "",
            is_half_day: false,
            half_day_type: "1st_half",
            has_time_range: false,
            start_time: "",
            end_time: "",
            attachment: null,
            attachmentFile: null
          });
          fetchLeaves();
          fetchStats();
        } else {
          alert(data.error || "Failed to submit leave application");
        }
      }
    } catch (error) {
      console.error("Error submitting leave:", error);
      alert("Error submitting leave application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (leaveId) => {
    if (!confirm("Are you sure you want to delete this leave application?")) return;
    try {
      const response = await fetch(`/api/empcrm/leaves?id=${leaveId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        alert("Leave application deleted successfully");
        fetchLeaves();
        fetchStats();
      } else {
        alert(data.error || "Failed to delete leave");
      }
    } catch (error) {
      console.error("Error deleting leave:", error);
      alert("Error deleting leave");
    }
  };

  const getStatusBadge = (status, acknowledgedAt) => {
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
    const statusBadge = (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
    if (!acknowledgedAt) {
      return statusBadge;
    }
    return (
      <div className="flex flex-col gap-1 items-start">
        {statusBadge}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
          <BadgeCheck className="w-3 h-3" />
          Acknowledged
        </span>
      </div>
    );
  };

  const getLeaveTypeColor = (type) => {
    const colors = {
      sick: "bg-blue-100 text-blue-800",
      paid: "bg-purple-100 text-purple-800",
      casual: "bg-green-100 text-green-800",
      unpaid: "bg-gray-100 text-gray-800",
      "half-day": "bg-orange-100 text-orange-700"
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

  const totalDays =
    formData.is_half_day && formData.from_date
      ? 0.5
      : leaveDayPreview?.totalDays ?? 0;

  // Leave type options shared between both forms
  const leaveTypeOptions = (
    <>
      <option value="">Select</option>
      {stats && stats.leaveSummary.filter(l => l.enabled).map(leave => {
        const netAvail = leave.available - leave.pending;
        return (
          <option key={leave.type} value={leave.type}>
            {leave.type.charAt(0).toUpperCase() + leave.type.slice(1)} Leave
            {netAvail >= 0
              ? ` (${formatDays(netAvail)} days available)`
              : ` (${formatDays(netAvail)} days)`}
          </option>
        );
      })}
      <option value="unpaid">Unpaid Leave</option>
    </>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            My Leave Applications
          </h1>
          <p className="text-gray-600 mt-2">Manage your leave requests and view balance</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleApplyClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Apply for Leave
          </button>
        </div>
      </div>
      

      {/* Leave Balance KPIs */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading statistics...</div>
      ) : stats && (
        <div>
          {/* Employment Status */}
          <div className="mb-4 flex flex-wrap gap-2">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              stats.employment_status === 'permanent'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              Employment Status: {stats.employment_status === 'permanent' ? 'Permanent' : 'Probation'}
            </span>
            {stats.employment_status === 'permanent' && stats.accrual_start_date && (
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                Leave Accrual Start Date: {stats.accrual_start_date}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.leaveSummary.map((leave) => {
              if (!leave.enabled) return null;
              const netAvailable = leave.available - leave.pending;
              const utilizationPercent = leave.allowed > 0
                ? (((leave.taken + leave.pending) / leave.allowed) * 100).toFixed(0)
                : 0;
              return (
                <div key={leave.type} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 capitalize">
                      {leave.type} Leave
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.type)}`}>
                      {leave.type}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Allowed</span>
                      <span className="text-lg font-bold text-gray-900">{formatDays(leave.allowed)} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        Taken
                      </span>
                      <span className="text-lg font-bold text-red-600">{formatDays(leave.taken)} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <TrendingUp className={`w-4 h-4 ${netAvailable >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                        Available
                      </span>
                      <span className={`text-lg font-bold ${netAvailable >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netAvailable >= 0
                          ? `${formatDays(netAvailable)} days`
                          : `-${formatDays(Math.abs(netAvailable))} days`}
                      </span>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Utilization</span>
                        <span>{utilizationPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            utilizationPercent > 80 ? 'bg-red-500' :
                            utilizationPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Unpaid Leave Card */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Unpaid Leave</h3>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">unpaid</span>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">No limit - always available</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-gray-600">Taken this year</span>
                  <span className="text-lg font-bold text-gray-900">{formatDays(stats.unpaidLeaves.taken)} days</span>
                </div>
                {stats.unpaidLeaves.pending > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm text-yellow-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Pending
                    </span>
                    <span className="text-sm font-semibold text-yellow-600">{formatDays(stats.unpaidLeaves.pending)} days</span>
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Leave History Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Leave History</h2>
        </div>

        {leaves.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No leave applications yet. Click &quot;Apply for Leave&quot; to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.leave_type)}`}>
                          {leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)}
                        </span>
                        {leave.is_half_day ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                            <Sun className="w-3 h-3" />
                            {leave.half_day_type === "1st_half" ? "1st Half" : "2nd Half"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {leave.is_half_day ? (
                        <div>{formatDate(leave.from_date)}</div>
                      ) : (
                        <>
                          <div>{formatDate(leave.from_date)}</div>
                          <div className="text-gray-500">to {formatDate(leave.to_date)}</div>
                        </>
                      )}
                      {leave.start_time && leave.end_time && (
                        <div className="text-gray-600 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{leave.start_time} — {leave.end_time}</span>
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
                      {leave.created_by ? (
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          {leave.created_by}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {leave.status !== "pending" && getStatusBadge(leave.status, leave.acknowledged_at)}
                      {leave.acknowledged_at && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                          <BadgeCheck className="w-3 h-3" />
                          Acknowledged
                        </div>
                      )}
                      {leave.status === "rejected" && leave.rejection_reason && (
                        <div className="mt-2 text-xs text-red-600 max-w-xs">
                          <div className="flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>{leave.rejection_reason}</span>
                          </div>
                        </div>
                      )}
                      {leave.acknowledgement_remark && (
                        <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-700 max-w-xs">
                          <div className="font-medium text-indigo-800 mb-1">Remark:</div>
                          <p className="text-indigo-600">{leave.acknowledgement_remark}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {leave.status === "pending" && !leave.acknowledged_at && (
                        <button
                          onClick={() => handleDelete(leave.id)}
                          className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
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
        </div>
      )}

      {/* Full-Day Leave Application Modal */}
      {showApplicationForm && (
        <div className="fixed inset-0 flex items-center sm:items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Apply for Leave</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {leaveTypeOptions}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Duration <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        is_half_day: false,
                        to_date: formData.is_half_day ? "" : formData.to_date,
                      })
                    }
                    className={`px-2 sm:px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-colors ${
                      !formData.is_half_day
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Full Day
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        is_half_day: true,
                        to_date: formData.from_date,
                      })
                    }
                    className={`px-2 sm:px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-colors ${
                      formData.is_half_day
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Half Day
                  </button>
                </div>
              </div>

              {formData.is_half_day && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Half-Day Session <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, half_day_type: "1st_half" })}
                      className={`px-2 sm:px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-colors ${
                        formData.half_day_type === "1st_half"
                          ? "bg-orange-100 text-orange-800 border-orange-300"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      1st Half (Morning)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, half_day_type: "2nd_half" })}
                      className={`px-2 sm:px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-colors ${
                        formData.half_day_type === "2nd_half"
                          ? "bg-orange-100 text-orange-800 border-orange-300"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      2nd Half (Afternoon)
                    </button>
                  </div>
                </div>
              )}

              <div className={formData.is_half_day ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"}>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    {formData.is_half_day ? "Date" : "From Date"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.from_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        from_date: e.target.value,
                        to_date: formData.is_half_day ? e.target.value : formData.to_date,
                      })
                    }
                    className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                {!formData.is_half_day && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      To Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.to_date}
                      onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                      min={formData.from_date}
                      className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Time Range Toggle + Start/End Time */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <div className="pr-0 sm:pr-4">
                    <p className="text-sm font-semibold text-gray-800">Specify Start & End Time</p>
                    <p className="text-xs text-gray-500">Turn on if leave duration is within a specific window of the day</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer self-start sm:self-auto flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={formData.has_time_range}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          has_time_range: e.target.checked,
                          ...(e.target.checked ? {} : { start_time: "", end_time: "" })
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {formData.has_time_range && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        From Date — Start Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        To Date — End Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {totalDays > 0 && (
                <div className={`border rounded-lg p-3 space-y-2 ${formData.is_half_day ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200"}`}>
                  <p className={`text-xs sm:text-sm ${formData.is_half_day ? "text-orange-800" : "text-blue-800"}`}>
                    Total Leave Days:{" "}
                    <span className="font-bold">
                      {formData.is_half_day ? "0.5 day (Half-Day)" : `${totalDays} days`}
                    </span>
                  </p>
                  {!formData.is_half_day && leaveDayPreview?.breakdown && (
                    <p className="text-[11px] sm:text-xs text-blue-700/90">
                      Continuous leave: includes{" "}
                      {leaveDayPreview.breakdown.weekdays} weekday
                      {leaveDayPreview.breakdown.weekdays !== 1 ? "s" : ""}
                      {leaveDayPreview.breakdown.sundays > 0
                        ? `, ${leaveDayPreview.breakdown.sundays} Sunday${leaveDayPreview.breakdown.sundays !== 1 ? "s" : ""}`
                        : ""}
                      {leaveDayPreview.breakdown.holidays > 0
                        ? `, ${leaveDayPreview.breakdown.holidays} holiday${leaveDayPreview.breakdown.holidays !== 1 ? "s" : ""}`
                        : ""}
                      {" "}in this span (continuous leave — all days from start to end date).
                    </p>
                  )}
                </div>
              )}

              {/* Sick Leave Notice and Attachment */}
              {formData.leave_type === "sick" && (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs sm:text-sm text-blue-800">
                        <p className="font-semibold mb-1">Sick Leave Guidelines:</p>
                        <ul className="list-disc list-inside space-y-1 ml-0 sm:ml-2">
                          <li className="break-words">Sick Leave is applicable on hospitalisation or as per doctor prescription with test report.</li>
                          <li>Doctor prescription/test report is required.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Upload Doctor Prescription / Test Report <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-600 mb-2">Accepted formats: PDF, JPG, PNG (Max 5MB)</p>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-28 sm:h-32 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
                        <div className="flex flex-col items-center justify-center p-3 sm:pt-5 sm:pb-6">
                          {formData.attachment ? (
                            <>
                              <p className="text-xs sm:text-sm font-medium text-blue-800 text-center break-all line-clamp-2">
                                ✓ File selected: {formData.attachment}
                              </p>
                              <p className="text-xs text-blue-600 mt-1">Click to change file</p>
                            </>
                          ) : (
                            <>
                              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500 mb-1 sm:mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                              </svg>
                              <p className="mb-1 sm:mb-2 text-xs sm:text-sm text-blue-700 text-center">
                                <span className="font-semibold">Click to upload</span>
                                <span className="hidden sm:inline"> or drag and drop</span>
                              </p>
                              <p className="text-[10px] sm:text-xs text-blue-600 text-center">PDF, JPG, PNG up to 5MB</p>
                            </>
                          )}
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              if (file.size > 5 * 1024 * 1024) {
                                alert("File size must be less than 5MB");
                                return;
                              }
                              setFormData({ 
                                ...formData, 
                                attachment: file.name,
                                attachmentFile: file
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Enter reason for leave..."
                  rows={3}
                  className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowApplicationForm(false);
                    setFormData({
                      leave_type: "",
                      from_date: "",
                      to_date: "",
                      reason: "",
                      is_half_day: false,
                      half_day_type: "1st_half",
                      has_time_range: false,
                      start_time: "",
                      end_time: "",
                      attachment: null,
                      attachmentFile: null
                    });
                  }}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Required Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Email Configuration Required</h2>
            <p className="text-gray-600 mb-6">
              You need to configure your email settings before applying for leave. This is required to send notifications to HR.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => router.push("/empcrm/user-dashboard/settings")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
