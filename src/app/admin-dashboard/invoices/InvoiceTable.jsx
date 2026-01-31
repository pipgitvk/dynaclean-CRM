"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function InvoiceTable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Sorting state
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchData = async () => {
    setLoading(true);

    // Build query parameters - matching API's camelCase naming
    const params = new URLSearchParams();
    params.append("page", currentPage);
    params.append("limit", limit);
    params.append("sort", sortBy);
    params.append("order", sortOrder);

    if (fromDate) params.append("fromDate", fromDate); // camelCase to match API
    if (toDate) params.append("toDate", toDate); // camelCase to match API
    if (search) params.append("search", search);

    const url = `/api/invoice-list?${params.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const response = await res.json();

      if (response.success) {
        setInvoices(response.data || []);
        setMeta(
          response.meta || {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
          },
        );
      } else {
        setInvoices([]);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters, pagination, or sorting changes
  useEffect(() => {
    fetchData();
  }, [currentPage, limit, fromDate, toDate, sortBy, sortOrder]);

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1); // Reset to page 1 when searching
      } else {
        fetchData();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [search]);

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSearch("");
    setCurrentPage(1);
    setSortBy("created_at");
    setSortOrder("desc");
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= meta.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setCurrentPage(1); // Reset to first page when changing limit
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle order if same column
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New column, default to descending
      setSortBy(column);
      setSortOrder("desc");
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(meta.totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  // Sort indicator component
  const SortIcon = ({ column }) => {
    if (sortBy !== column) {
      return <span className="ml-1 text-gray-400">↕</span>;
    }
    return sortOrder === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
  };

  return (
    <div className="bg-white rounded shadow p-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row justify-between gap-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={handleReset}
            className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 w-full sm:w-auto"
          >
            Reset
          </button>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 w-full"
            placeholder="From Date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 w-full"
            placeholder="To Date"
          />
        </div>
        <input
          type="text"
          placeholder="By invoice,quotation num..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 w-full md:w-64"
        />
      </div>

      {/* Results count and items per page */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
        <div className="text-sm text-gray-600">
          Showing {invoices.length > 0 ? (currentPage - 1) * limit + 1 : 0} to{" "}
          {Math.min(currentPage * limit, meta.total)} of {meta.total} invoices
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="limit" className="text-sm text-gray-600">
            Per page:
          </label>
          <select
            id="limit"
            value={limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table - Visible on medium screens and larger */}
      <div className="overflow-x-auto hidden md:block border rounded shadow">
        <table className="min-w-full table-auto text-sm text-gray-800 divide-y divide-gray-200">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th
                className="px-4 py-2 cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort("invoice_number")}
              >
                Invoice Number <SortIcon column="invoice_number" />
              </th>
              <th className="px-4 py-2">Quotation ID</th>
              <th className="px-4 py-2">Quotation No.</th>
              <th
                className="px-4 py-2 cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort("invoice_date")}
              >
                Invoice Date <SortIcon column="invoice_date" />
              </th>
              <th className="px-4 py-2">Due Date</th>
              <th className="px-4 py-2">Total Amount</th>
              <th className="px-4 py-2">Tax Amount</th>
              <th className="px-4 py-2">Grand Total</th>
              <th className="px-4 py-2">Status</th>
              <th
                className="px-4 py-2 cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort("created_at")}
              >
                Created At <SortIcon column="created_at" />
              </th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" className="text-center py-4 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : invoices.length > 0 ? (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 py-2">{invoice.quotation_id}</td>
                  <td className="px-4 py-2">{invoice.quote_number}</td>
                  <td className="px-4 py-2">
                    {new Date(invoice.invoice_date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2">
                    {invoice.due_date
                      ? new Date(invoice.due_date).toLocaleDateString("en-IN")
                      : "-"}
                  </td>
                  <td className="px-4 py-2">
                    ₹{parseFloat(invoice.total_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2">
                    ₹{parseFloat(invoice.tax_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    ₹{parseFloat(invoice.grand_total).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        invoice.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : invoice.status === "draft"
                            ? "bg-gray-100 text-gray-800"
                            : invoice.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                      }`}
                    >
                      {invoice.status.charAt(0).toUpperCase() +
                        invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {new Date(invoice.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Link
                      href={`/admin-dashboard/invoices/${invoice.invoice_number}`}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 inline-block"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="10"
                  className="text-center text-gray-500 py-6 italic"
                >
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards - Visible on small screens */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading...</div>
        ) : invoices.length > 0 ? (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-white p-4 rounded-lg shadow-md border border-gray-200"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">
                    {invoice.invoice_number}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Quotation ID: {invoice.quotation_id}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    invoice.status === "paid"
                      ? "bg-green-100 text-green-800"
                      : invoice.status === "draft"
                        ? "bg-gray-100 text-gray-800"
                        : invoice.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                  }`}
                >
                  {invoice.status.charAt(0).toUpperCase() +
                    invoice.status.slice(1)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-gray-700 text-sm">
                  <strong className="font-medium">Invoice Date:</strong>{" "}
                  {new Date(invoice.invoice_date).toLocaleDateString("en-IN")}
                </p>
                {invoice.due_date && (
                  <p className="text-gray-700 text-sm">
                    <strong className="font-medium">Due Date:</strong>{" "}
                    {new Date(invoice.due_date).toLocaleDateString("en-IN")}
                  </p>
                )}
                <p className="text-gray-700 text-sm">
                  <strong className="font-medium">Total Amount:</strong> ₹
                  {parseFloat(invoice.total_amount).toLocaleString("en-IN")}
                </p>
                <p className="text-gray-700 text-sm">
                  <strong className="font-medium">Tax Amount:</strong> ₹
                  {parseFloat(invoice.tax_amount).toLocaleString("en-IN")}
                </p>
                <p className="text-gray-700 text-sm">
                  <strong className="font-medium">Grand Total:</strong>{" "}
                  <span className="text-lg font-semibold text-gray-900">
                    ₹{parseFloat(invoice.grand_total).toLocaleString("en-IN")}
                  </span>
                </p>
                <p className="text-gray-700 text-sm">
                  <strong className="font-medium">Created:</strong>{" "}
                  {new Date(invoice.created_at).toLocaleDateString("en-IN")}
                </p>
              </div>

              <div className="flex justify-end">
                <Link
                  href={`/admin-dashboard/invoices/${invoice.id}`}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
                >
                  View Invoice
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">
            No invoices found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {meta.totalPages}
          </div>

          <div className="flex flex-wrap gap-1 justify-center">
            {/* First Page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded text-sm ${
                currentPage === 1
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              First
            </button>

            {/* Previous Page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded text-sm ${
                currentPage === 1
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Prev
            </button>

            {/* Page Numbers */}
            {getPageNumbers().map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 rounded text-sm ${
                  currentPage === page
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {page}
              </button>
            ))}

            {/* Next Page */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === meta.totalPages}
              className={`px-3 py-1 rounded text-sm ${
                currentPage === meta.totalPages
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Next
            </button>

            {/* Last Page */}
            <button
              onClick={() => handlePageChange(meta.totalPages)}
              disabled={currentPage === meta.totalPages}
              className={`px-3 py-1 rounded text-sm ${
                currentPage === meta.totalPages
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
