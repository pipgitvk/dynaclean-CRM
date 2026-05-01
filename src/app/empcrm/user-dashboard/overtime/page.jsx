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
  if (!attendance) return true; // No record = issue
  
  const hasCheckIn = attendance.checkin_time && attendance.checkin_time.trim() !== "";
  const hasCheckOut = attendance.checkout_time && attendance.checkout_time.trim() !== "";
  
  // Show regularization if either check-in or check-out is missing
  return !hasCheckIn || !hasCheckOut;
}

// Helper function to check if employee has pending regularization
function hasPendingRegularization(regularization) {
  return regularization && regularization.status === 'pending';
}

export default function OvertimeManagementPage() {
  const [employeesWithAttendance, setEmployeesWithAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [regularizationForm, setRegularizationForm] = useState({
    checkin_time: "",
    checkout_time: "",
    reason: "",
    attachment: null
  });
  const [showForm, setShowForm] = useState(false);

  const fetchEmployeesWithAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/overtime/team-attendance?date=${selectedDate}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch team attendance");
      }
      setEmployeesWithAttendance(data.employees || []);
    } catch (error) {
      toast.error(error.message);
      setEmployeesWithAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchEmployeesWithAttendance();
  }, [fetchEmployeesWithAttendance]);

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
      fetchEmployeesWithAttendance();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Filter employees based on the selected filter
  const filteredEmployees = employeeFilter
    ? employeesWithAttendance.filter(emp => emp.username === employeeFilter)
    : employeesWithAttendance;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading team attendance...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Overtime Management</h1>
          <p className="mt-2 text-gray-600">Manage attendance regularization for your team members</p>
        </div>

        {/* Navigation */}
        <div className="mb-6 flex space-x-4">
          <Link
            href="/empcrm/user-dashboard/attendance-regularization"
            className="text-blue-600 hover:text-blue-800"
          >
            View Approval Requests
          </Link>
        </div>

        {/* Date and Employee Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
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
                <option value="">All Employees</option>
                {employeesWithAttendance.map((emp) => (
                  <option key={emp.username} value={emp.username}>
                    {emp.username} ({emp.empId})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {employeeFilter && (
            <div className="mt-3 flex items-center justify-between">
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

        {/* Employee List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Team Attendance - {selectedDate}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredEmployees.length} of {employeesWithAttendance.length} assigned employees
            </p>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              {employeeFilter ? 'No employees found matching the filter' : 'No assigned employees found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check-in
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check-out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.username}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {employee.username}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {employee.empId}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.attendance?.checkin_time 
                          ? formatTime(employee.attendance.checkin_time)
                          : "Not recorded"
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.attendance?.checkout_time 
                          ? formatTime(employee.attendance.checkout_time)
                          : "Not recorded"
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          hasPendingRegularization(employee.regularization)
                            ? 'bg-yellow-100 text-yellow-800'
                            : employee.attendance 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                        }`}>
                          {hasPendingRegularization(employee.regularization)
                            ? 'Pending'
                            : employee.attendance 
                              ? 'Present' 
                              : 'Absent'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {hasPendingRegularization(employee.regularization) ? (
                          <span className="text-yellow-600 text-sm">
                            Regularization Pending
                          </span>
                        ) : hasAttendanceIssues(employee.attendance) ? (
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee.username);
                              setShowForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Request Regularization
                          </button>
                        ) : (
                          <span className="text-green-600 text-sm">
                            Attendance Complete
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  Employee: {selectedEmployee} | Date: {selectedDate}
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
                      placeholder="Please provide a reason for the regularization request..."
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      </div>
    </div>
  );
}
