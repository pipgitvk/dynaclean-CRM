"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useState } from "react";
import { Eye, Download, Pencil } from "lucide-react";

export default function OtherIncomeTable({ rows, role }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [selectedStatus, setSelectedStatus] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Filter rows based on search, status, and date range
  const filteredRows = rows.filter((row) => {
    const totalIncome = Number(row.amount || 0) + Number(row.gst_amount || 0);
    const formattedDate = dayjs(row.income_date).format("DD MMM YYYY");

    const matchesSearch =
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      formattedDate.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !selectedStatus || row.approval_status === selectedStatus;

    const matchesDateRange =
      (!fromDate || dayjs(row.income_date).isAfter(dayjs(fromDate).subtract(1, "day"))) &&
      (!toDate || dayjs(row.income_date).isBefore(dayjs(toDate).add(1, "day")));

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  // Sort rows
  let sortedRows = [...filteredRows];
  if (sortConfig.key) {
    sortedRows.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const downloadFile = (filePath) => {
    if (filePath) {
      const link = document.createElement("a");
      link.href = filePath;
      link.download = filePath.split("/").pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Filters</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name, source, etc."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full border p-2 rounded-md"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th
                className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort("income_date")}
              >
                Date {sortConfig.key === "income_date" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-3 text-left font-semibold">Income Name</th>
              <th className="px-4 py-3 text-left font-semibold">Source</th>
              <th className="px-4 py-3 text-left font-semibold">Category</th>
              <th
                className="px-4 py-3 text-right font-semibold cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort("amount")}
              >
                Amount {sortConfig.key === "amount" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-3 text-right font-semibold">GST</th>
              <th className="px-4 py-3 text-center font-semibold">Receipt Mode</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length > 0 ? (
              sortedRows.map((row, idx) => (
                <tr key={row.id || idx} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {dayjs(row.income_date).format("DD MMM YYYY")}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{row.income_name}</td>
                  <td className="px-4 py-3 text-gray-700">{row.income_source}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{row.income_category}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    ₹{Number(row.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {row.gst_amount ? `₹${Number(row.gst_amount).toFixed(2)}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{row.receipt_mode || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(row.approval_status)}`}>
                      {row.approval_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <Link
                        href={`/accounts-dashboard/other-income/${row.id}`}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="View"
                      >
                        <Eye size={18} />
                      </Link>

                      {row.receipt_attachment_path && (
                        <button
                          onClick={() => downloadFile(row.receipt_attachment_path)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Download Receipt"
                        >
                          <Download size={18} />
                        </button>
                      )}

                      {["Pending"].includes(row.approval_status) && (
                        <Link
                          href={`/accounts-dashboard/other-income/edit/${row.id}`}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title="Edit"
                        >
                          <Pencil size={18} />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="px-4 py-6 text-center text-gray-500">
                  No other income entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      {sortedRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600">Total Income</p>
            <p className="text-2xl font-bold text-blue-600">
              ₹{sortedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2)}
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-gray-600">Total GST</p>
            <p className="text-2xl font-bold text-green-600">
              ₹{sortedRows.reduce((sum, row) => sum + Number(row.gst_amount || 0), 0).toFixed(2)}
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-sm text-gray-600">Entries</p>
            <p className="text-2xl font-bold text-purple-600">{sortedRows.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
