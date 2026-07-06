"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Edit, Eye } from "lucide-react";
import toast from "react-hot-toast";

export default function UserAMCCMCPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchRecords = useCallback(
    async (page, search = "") => {
      setLoading(true);
      try {
        const url = `/api/amc-cmc?page=${page}&limit=${pageSize}&search=${encodeURIComponent(
          search
        )}`;
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
    fetchRecords(currentPage, searchQuery);
  }, [currentPage, fetchRecords]);

  useEffect(() => {
    setCurrentPage(1);
    fetchRecords(1, searchQuery);
  }, [searchQuery, fetchRecords]);

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
        <h1 className="text-3xl font-bold">My AMC/CMC Requests</h1>
        <Link
          href="/user-dashboard/amc-cmc/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Add AMC/CMC Request
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
                    <div className="flex gap-2 justify-center">
                      <Link
                        href={`/user-dashboard/amc-cmc/view/${record.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="View"
                      >
                        <Eye size={18} />
                      </Link>
                      {record.status === "pending" && (
                        <>
                          <Link
                            href={`/user-dashboard/amc-cmc/edit/${record.id}`}
                            className="text-yellow-600 hover:text-yellow-800"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </Link>
                        </>
                      )}
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
