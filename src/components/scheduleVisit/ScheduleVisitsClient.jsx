"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import Link from "next/link";
import ScheduleVisitModal from "./ScheduleVisitModal";

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  visited: "bg-purple-100 text-purple-800 border-purple-200",
  completed: "bg-green-100 text-green-800 border-green-200",
};

function StatusBadge({ status }) {
  const s = status || "pending";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase border ${STATUS_STYLES[s] || STATUS_STYLES.pending}`}
    >
      {s}
    </span>
  );
}

export default function ScheduleVisitsClient({ dashboardPrefix = "user-dashboard" }) {
  const [data, setData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [reportees, setReportees] = useState([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    date_from: "",
    date_to: "",
  });

  const [modal, setModal] = useState(null);
  const [assignedTo, setAssignedTo] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [discussionSummary, setDiscussionSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);

      const res = await fetch(`/api/schedule-visit?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data || []);
        setEmployees(result.employees || []);
        setReportees(result.reportees || []);
        setUsername(result.username || "");
        setRole(result.role || "");
      } else {
        toast.error(result.error || "Failed to load visits");
        setData([]);
      }
    } catch {
      toast.error("Failed to load visits");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isPrivileged = ["SUPERADMIN", "DIRECTOR", "ADMIN"].includes(
    String(role).toUpperCase()
  );

  const canApprove = (row) =>
    row.visit_status === "pending" &&
    (isPrivileged || reportees.includes(row.created_by));

  const canRecordVisit = (row) =>
    row.visit_status === "approved" &&
    (isPrivileged ||
      row.assigned_to === username ||
      row.created_by === username ||
      reportees.includes(row.created_by));

  const canComplete = (row) =>
    row.visit_status === "visited" &&
    (isPrivileged || reportees.includes(row.created_by));

  const handleAction = async (id, action, extra = {}) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/schedule-visit/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message || "Updated successfully");
        setModal(null);
        setAssignedTo("");
        setRejectionReason("");
        setVisitDate("");
        setDiscussionSummary("");
        fetchData();
      } else {
        toast.error(result.error || "Update failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const customerLinkPrefix =
    dashboardPrefix === "admin-dashboard" ? "admin-dashboard" : "user-dashboard";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search name, contact, purpose..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="visited">Visited</option>
          <option value="completed">Completed</option>
        </select>
        <input
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
        >
          Apply Filters
        </button>
        <ScheduleVisitModal
          buttonLabel="+ Schedule Visit"
          variant="primary"
          onCreated={fetchData}
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Address</th>
              <th className="p-3 text-left">Purpose</th>
              <th className="p-3 text-left">Scheduled</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Assigned To</th>
              <th className="p-3 text-left">Visited By</th>
              <th className="p-3 text-left">Visit Date</th>
              <th className="p-3 text-left">Summary</th>
              <th className="p-3 text-left">Created By</th>
              <th className="p-3 text-left">Approved By</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="p-8 text-center text-gray-500">Loading...</td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-8 text-center text-gray-500">No visits found</td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <Link
                      href={`/${customerLinkPrefix}/view-customer/${row.customer_id}`}
                      className="text-violet-600 hover:underline"
                    >
                      {row.customer_name}
                    </Link>
                    <span className="text-gray-400 text-xs block">#{row.customer_id}</span>
                  </td>
                  <td className="p-3">{row.contact || "—"}</td>
                  <td className="p-3 max-w-[150px] truncate" title={row.visit_address}>
                    {row.visit_address}
                  </td>
                  <td className="p-3 max-w-[120px] truncate" title={row.purpose}>
                    {row.purpose}
                  </td>
                  <td className="p-3">
                    {row.scheduled_date
                      ? dayjs(row.scheduled_date).format("DD MMM YYYY, hh:mm A")
                      : "—"}
                  </td>
                  <td className="p-3"><StatusBadge status={row.visit_status} /></td>
                  <td className="p-3">{row.assigned_to || "—"}</td>
                  <td className="p-3">{row.visited_by || "—"}</td>
                  <td className="p-3">
                    {row.visit_date
                      ? dayjs(row.visit_date).format("DD MMM YYYY, hh:mm A")
                      : "—"}
                  </td>
                  <td className="p-3 max-w-[150px] truncate" title={row.discussion_summary}>
                    {row.discussion_summary || "—"}
                  </td>
                  <td className="p-3">{row.created_by}</td>
                  <td className="p-3">{row.approved_by || "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      {canApprove(row) && (
                        <>
                          <button
                            onClick={() => setModal({ type: "approve", row })}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setModal({ type: "reject", row })}
                            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {canRecordVisit(row) && (
                        <button
                          onClick={() => setModal({ type: "record_visit", row })}
                          className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          Record Visit
                        </button>
                      )}
                      {canComplete(row) && (
                        <button
                          onClick={() => handleAction(row.id, "complete")}
                          className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {modal.type === "approve" && "Approve Visit"}
              {modal.type === "reject" && "Reject Visit"}
              {modal.type === "record_visit" && "Record Visit"}
            </h3>
            <p className="text-sm text-gray-600">
              Customer: <strong>{modal.row.customer_name}</strong>
            </p>

            {modal.type === "approve" && (
              <div>
                <label className="block text-sm font-medium mb-1">Assign To</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            )}

            {modal.type === "reject" && (
              <div>
                <label className="block text-sm font-medium mb-1">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm h-20"
                  placeholder="Optional reason"
                />
              </div>
            )}

            {modal.type === "record_visit" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Visit Date & Time</label>
                  <input
                    type="datetime-local"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discussion Summary</label>
                  <textarea
                    value={discussionSummary}
                    onChange={(e) => setDiscussionSummary(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm h-24"
                    placeholder="Summary of discussion during visit"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={() => {
                  if (modal.type === "approve") {
                    if (!assignedTo) {
                      toast.error("Please select assignee");
                      return;
                    }
                    handleAction(modal.row.id, "approve", { assignedTo });
                  } else if (modal.type === "reject") {
                    handleAction(modal.row.id, "reject", { rejectionReason });
                  } else if (modal.type === "record_visit") {
                    handleAction(modal.row.id, "record_visit", {
                      visitDate: visitDate || new Date().toISOString(),
                      discussionSummary,
                    });
                  }
                }}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
