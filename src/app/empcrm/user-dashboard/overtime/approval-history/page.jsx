"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";

function formatLogDate(v) {
  if (v == null) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date(v).toLocaleDateString();
}

export default function OvertimeApprovalHistoryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/regularization?scope=my-approvals");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load approval history");
      }
      setRequests(data.requests || []);
    } catch (error) {
      toast.error(error.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter requests based on employee filter
  const filteredRequests = employeeFilter
    ? requests.filter(req => req.username === employeeFilter)
    : requests;

  // Get unique employee names for filter dropdown
  const employeeNames = [...new Set(requests.map(req => req.username))].sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading approval history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Approval History</h1>
          <p className="mt-2 text-gray-600">View your attendance regularization approval history</p>
        </div>

        {/* Navigation */}
        <div className="mb-6 flex space-x-4">
          <Link
            href="/empcrm/user-dashboard/overtime"
            className="text-blue-600 hover:text-blue-800"
          >
            Back to Overtime Management
          </Link>
          <Link
            href="/empcrm/user-dashboard/attendance-regularization"
            className="text-blue-600 hover:text-blue-800"
          >
            View Pending Approvals
          </Link>
        </div>

        {/* Employee Filter */}
        {employeeNames.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Employee
              </label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Employees</option>
                {employeeNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {employeeFilter && (
                <button
                  onClick={() => setEmployeeFilter("")}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Requests List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Approval History
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredRequests.length} of {requests.length} requests
            </p>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              {employeeFilter ? 'No requests found for this employee' : 'No approval history found'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <h3 className="text-sm font-medium text-gray-900">
                          {request.username}
                        </h3>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          request.status === 'approved' 
                            ? 'bg-green-100 text-green-800'
                            : request.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-600">
                        <p>Date: {formatLogDate(request.log_date)}</p>
                        {request.reviewed_at && (
                          <p>Reviewed: {new Date(request.reviewed_at).toLocaleString()}</p>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Original Times:</p>
                          <p className="text-sm text-gray-600">
                            In: {request.original_checkin_time ? formatTime(request.original_checkin_time) : 'Not recorded'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Out: {request.original_checkout_time ? formatTime(request.original_checkout_time) : 'Not recorded'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700">Proposed Times:</p>
                          <p className="text-sm text-gray-600">
                            In: {request.proposed_checkin_time ? formatTime(request.proposed_checkin_time) : 'Not proposed'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Out: {request.proposed_checkout_time ? formatTime(request.proposed_checkout_time) : 'Not proposed'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700">Reason:</p>
                        <p className="text-sm text-gray-600">{request.reason || 'No reason provided'}</p>
                      </div>

                      {request.attachment_url && (
                        <div className="mt-3">
                          <a
                            href={request.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View Attachment
                          </a>
                        </div>
                      )}

                      {request.reviewed_by && (
                        <div className="mt-3 text-sm text-gray-600">
                          <p>Reviewed by: {request.reviewed_by}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
