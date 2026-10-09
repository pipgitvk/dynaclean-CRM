"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";

// Helper function to check if attendance is complete
function isAttendanceComplete(attendance) {
  if (!attendance) return false;
  
  const hasCheckIn = attendance.checkin_time && attendance.checkin_time.trim() !== "";
  const hasCheckOut = attendance.checkout_time && attendance.checkout_time.trim() !== "";
  
  return hasCheckIn && hasCheckOut;
}

// Helper function to check if attendance has issues
function hasAttendanceIssues(attendance) {
  if (!attendance) return true;
  
  const hasCheckIn = attendance.checkin_time && attendance.checkin_time.trim() !== "";
  const hasCheckOut = attendance.checkout_time && attendance.checkout_time.trim() !== "";
  
  return !hasCheckIn || !hasCheckOut;
}

// Helper function to check regularization status
function hasPendingRegularization(regularization) {
  return regularization && regularization.status === 'pending';
}

function hasApprovedRegularization(regularization) {
  return regularization && regularization.status === 'approved';
}

function hasRejectedRegularization(regularization) {
  return regularization && regularization.status === 'rejected';
}

// Format date for display
function formatDateHeader(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-IN', options);
}

export default function OvertimeManagementPage() {
  const [attendanceByDate, setAttendanceByDate] = useState({});
  const [datesSorted, setDatesSorted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [regularizationForm, setRegularizationForm] = useState({
    checkin_time: "",
    checkout_time: "",
    reason: "",
    attachment: null
  });
  const [showForm, setShowForm] = useState(false);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState("");
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState("");

  const showRemarks = (remarks) => {
    setSelectedRemarks(remarks);
    setShowRemarksModal(true);
  };

  const showPhoto = (photoUrl) => {
    setSelectedPhoto(photoUrl);
    setShowPhotoModal(true);
  };

  const fetchAttendanceByDate = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate days between from and to date
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const daysBack = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
      
      const res = await fetch(`/api/overtime/team-attendance?daysBack=${daysBack}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch attendance");
      }
      
      // Filter by date range
      let filteredDates = data.datesSorted || [];
      if (fromDate && toDate) {
        filteredDates = filteredDates.filter(date => date >= fromDate && date <= toDate);
      }
      
      const filteredAttendance = {};
      filteredDates.forEach(date => {
        filteredAttendance[date] = data.attendanceByDate[date];
      });
      
      setAttendanceByDate(filteredAttendance);
      setDatesSorted(filteredDates);
    } catch (error) {
      toast.error(error.message);
      setAttendanceByDate({});
      setDatesSorted([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchAttendanceByDate();
  }, [fetchAttendanceByDate]);

  const handleSubmitRegularization = async (e) => {
    e.preventDefault();
    
    if (!regularizationForm.reason.trim()) {
      toast.error("Please provide a reason for regularization");
      return;
    }
    if (
      !regularizationForm.checkin_time?.trim() ||
      !regularizationForm.checkout_time?.trim()
    ) {
      toast.error("Check-in and check-out times are required");
      return;
    }

    const formData = new FormData();
    formData.append("employee", selectedEmployee);
    formData.append("date", selectedDate);
    formData.append("checkin_time", regularizationForm.checkin_time);
    formData.append("checkout_time", regularizationForm.checkout_time);
    formData.append("reason", regularizationForm.reason);
    if (regularizationForm.attachment) {
      formData.append("attachment", regularizationForm.attachment);
    }

    try {
      const res = await fetch("/api/overtime/regularize", {
        method: "POST",
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit regularization request");
      }
      
      toast.success("Regularization request submitted for approval");
      setShowForm(false);
      setRegularizationForm({
        checkin_time: "",
        checkout_time: "",
        reason: "",
        attachment: null
      });
      fetchAttendanceByDate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading attendance records...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Overtime Management</h1>
          <p className="mt-2 text-gray-600">View assigned employees' attendance records organized by date</p>
        </div>

        {/* Navigation */}
        <div className="mb-6 flex space-x-4">
          <Link
            href="/empcrm/user-dashboard/attendance-regularization"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View Approval Requests
          </Link>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                max={toDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Employee
              </label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Assigned Employees</option>
                {Object.values(attendanceByDate)
                  .flat()
                  .filter((v, i, a) => a.findIndex(t => t.username === v.username) === i)
                  .map((emp) => (
                    <option key={emp.username} value={emp.username}>
                      {emp.username} ({emp.empId})
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => fetchAttendanceByDate()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Search
              </button>
            </div>
          </div>
          
          {employeeFilter && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Showing: <strong>{employeeFilter}</strong>
              </span>
              <button
                onClick={() => setEmployeeFilter("")}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>

        {/* Date-wise Attendance */}
        <div className="space-y-6">
          {datesSorted.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              No attendance records found
            </div>
          ) : (
            datesSorted.map((date) => {
              const employees = attendanceByDate[date];
              const filteredEmployees = employeeFilter
                ? employees.filter(e => e.username === employeeFilter)
                : employees;

              if (filteredEmployees.length === 0) return null;

              return (
                <div key={date} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  {/* Date Header */}
                  <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                      📅 {formatDateHeader(date)}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {filteredEmployees.length} assigned employee(s)
                    </p>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b border-gray-300">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">USER</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">CHECK-IN PHOTO</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">CHECK-IN</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">MORNING BREAK</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">LUNCH BREAK</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">EVENING BREAK</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">CHECK-OUT</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">STATUS</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.map((employee, idx) => (
                          <tr key={`${date}-${employee.username}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 border-b border-gray-200">
                              <div>
                                <div className="font-semibold text-gray-900">{employee.username}</div>
                                <div className="text-xs text-gray-600">ID: {employee.empId}</div>
                              </div>
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-center">
                              {employee.attendance?.checkin_photo ? (
                                <button
                                  onClick={() => showPhoto(employee.attendance.checkin_photo)}
                                  className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                                  title="View check-in photo"
                                >
                                  📷
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">No photo</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 font-mono text-gray-900 bg-green-50">
                              {employee.attendance?.checkin_time 
                                ? formatTime(employee.attendance.checkin_time)
                                : <span className="text-red-600">—</span>
                              }
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-900 bg-green-50">
                              {employee.attendance?.break_morning_start && employee.attendance?.break_morning_end ? (
                                `${formatTime(employee.attendance.break_morning_start)} - ${formatTime(employee.attendance.break_morning_end)}`
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-900 bg-green-50">
                              {employee.attendance?.break_lunch_start && employee.attendance?.break_lunch_end ? (
                                `${formatTime(employee.attendance.break_lunch_start)} - ${formatTime(employee.attendance.break_lunch_end)}`
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-900 bg-green-50">
                              {employee.attendance?.break_evening_start && employee.attendance?.break_evening_end ? (
                                `${formatTime(employee.attendance.break_evening_start)} - ${formatTime(employee.attendance.break_evening_end)}`
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 font-mono text-gray-900 bg-yellow-50">
                              {employee.attendance?.checkout_time 
                                ? formatTime(employee.attendance.checkout_time)
                                : <span className="text-red-600">—</span>
                              }
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200">
                              {hasPendingRegularization(employee.regularization) ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                                  Pending
                                </span>
                              ) : hasApprovedRegularization(employee.regularization) ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">
                                  Approved
                                </span>
                              ) : hasRejectedRegularization(employee.regularization) ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                                  Rejected
                                </span>
                              ) : employee.attendance && isAttendanceComplete(employee.attendance) ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">
                                  Complete
                                </span>
                              ) : employee.attendance ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 border border-orange-300">
                                  Incomplete
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                                  Absent
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-center">
                              {hasPendingRegularization(employee.regularization) ? (
                                <button
                                  onClick={() => showRemarks(employee.regularization.reviewer_comment)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  View
                                </button>
                              ) : hasApprovedRegularization(employee.regularization) ? (
                                <button
                                  onClick={() => showRemarks(employee.regularization.reviewer_comment)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  View
                                </button>
                              ) : hasRejectedRegularization(employee.regularization) ? (
                                <button
                                  onClick={() => showRemarks(employee.regularization.reviewer_comment)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  View
                                </button>
                              ) : hasAttendanceIssues(employee.attendance) ? (
                                <button
                                  onClick={() => {
                                    setSelectedEmployee(employee.username);
                                    setSelectedDate(date);
                                    setShowForm(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Regularize
                                </button>
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
              );
            })
          )}
        </div>

        {/* Regularization Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Request Attendance Regularization
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Employee: <strong>{selectedEmployee}</strong> | Date: <strong>{selectedDate}</strong>
                </p>
                
                <form onSubmit={handleSubmitRegularization} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Check-in Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={regularizationForm.checkin_time}
                      onChange={(e) => setRegularizationForm(prev => ({
                        ...prev,
                        checkin_time: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Check-out Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={regularizationForm.checkout_time}
                      onChange={(e) => setRegularizationForm(prev => ({
                        ...prev,
                        checkout_time: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason *
                    </label>
                    <textarea
                      value={regularizationForm.reason}
                      onChange={(e) => setRegularizationForm(prev => ({
                        ...prev,
                        reason: e.target.value
                      }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Please provide a reason..."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Attachment (Optional)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setRegularizationForm(prev => ({
                        ...prev,
                        attachment: e.target.files[0]
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setRegularizationForm({
                          checkin_time: "",
                          checkout_time: "",
                          reason: "",
                          attachment: null
                        });
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                    >
                      Submit Request
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Remarks Modal */}
        {showRemarksModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Remarks</h3>
                <button
                  onClick={() => setShowRemarksModal(false)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  ✕
                </button>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-800">
                  {selectedRemarks || "No remarks provided."}
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowRemarksModal(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Check-in Photo Modal */}
        {showPhotoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Check-in Photo</h3>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="text-gray-500 hover:text-gray-800 text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-96">
                {selectedPhoto ? (
                  <img 
                    src={selectedPhoto} 
                    alt="Check-in photo" 
                    className="max-w-full max-h-96 object-contain rounded-lg"
                  />
                ) : (
                  <span className="text-gray-400">No photo available</span>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-3">
                {selectedPhoto && (
                  <a
                    href={selectedPhoto}
                    download
                    className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Download
                  </a>
                )}
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
