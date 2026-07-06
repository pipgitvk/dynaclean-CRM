"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Edit, Trash2, CheckCircle, Eye, X } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function AMCCMCPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userRole, setUserRole] = useState("");
  const router = useRouter();

  // Get user role from session
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await fetch("/api/auth/current-user");
        if (!res.ok) throw new Error("Failed to fetch user info");
        const data = await res.json();
        const role = data.userRole ? String(data.userRole).trim().toUpperCase() : "";
        console.log("User role:", role);
        setUserRole(role);
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    fetchUserRole();
  }, []);

  const fetchRecords = useCallback(
    async (page, search = "", status = "") => {
      setLoading(true);
      try {
        const url = `/api/amc-cmc?page=${page}&limit=${pageSize}&search=${encodeURIComponent(
          search
        )}&status=${encodeURIComponent(status)}`;
        const res = await fetch(url);
        const data = await res.json();

        setRecords(data.amc_cmc || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setCurrentPage(data.currentPage || 1);
      } catch (error) {
        console.error("Error fetching records:", error);
        toast.error("Failed to fetch records");
        setRecords([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    fetchRecords(currentPage, searchQuery, statusFilter);
  }, [currentPage, fetchRecords]);

  useEffect(() => {
    setCurrentPage(1);
    fetchRecords(1, searchQuery, statusFilter);
  }, [searchQuery, statusFilter, fetchRecords]);

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
      const res = await fetch(`/api/amc-cmc/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");

      toast.success("Record deleted successfully");
      fetchRecords(currentPage, searchQuery, statusFilter);
    } catch (error) {
      toast.error("Failed to delete record");
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`/api/amc-cmc/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Approval failed");

      toast.success("Record approved successfully");
      fetchRecords(currentPage, searchQuery, statusFilter);
    } catch (error) {
      toast.error("Failed to approve record");
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await fetch(`/api/amc-cmc/${id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Rejection failed");

      toast.success("Record rejected successfully");
      fetchRecords(currentPage, searchQuery, statusFilter);
    } catch (error) {
      toast.error("Failed to reject record");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "expired":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="p-6 bg-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">AMC/CMC Management</h1>
        <Link
          href="/admin-dashboard/amc-cmc/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Add AMC/CMC
        </Link>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by serial number, company name, contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="overflow-x-auto shadow rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="p-3 text-left">Serial #</th>
              <th className="p-3 text-left">Model</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">AMC Period</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                </tr>
              ))
            ) : records.length > 0 ? (
              records.map((record) => (
                <tr key={record.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold">{record.serial_number}</td>
                  <td className="p-3">{record.model || "—"}</td>
                  <td className="p-3">{record.company_name}</td>
                  <td className="p-3">{record.contact || "—"}</td>
                  <td className="p-3 text-sm">
                    {new Date(record.amc_start_datetime).toLocaleDateString()} -{" "}
                    {new Date(record.amc_end_datetime).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                        record.status
                      )}`}
                    >
                      {getStatusLabel(record.status)}
                    </span>
                  </td>
                  <td className="p-3 text-sm">
                    {new Date(record.created_time).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-center flex-wrap">
                      {record.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(record.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded"
                            title="Approve"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(record.id)}
                            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded"
                            title="Reject"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <Link
                        href={`/admin-dashboard/amc-cmc/view/${record.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="View"
                      >
                        <Eye size={18} />
                      </Link>
                      <Link
                        href={`/admin-dashboard/amc-cmc/edit/${record.id}`}
                        className="text-yellow-600 hover:text-yellow-800"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="p-6 text-center text-gray-500">
                  No AMC/CMC records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && records.length > 0 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600">
            Showing {Math.min((currentPage - 1) * pageSize + 1, total)} to{" "}
            {Math.min(currentPage * pageSize, total)} of {total} records
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = Math.max(1, currentPage - 2) + i;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 border rounded ${
                    currentPage === pageNum
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
