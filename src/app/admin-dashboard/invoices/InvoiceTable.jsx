"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function InvoiceTable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Sorting
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchData = async () => {
    setLoading(true);

    const params = new URLSearchParams();
    params.append("page", currentPage);
    params.append("limit", limit);
    params.append("sort", sortBy);
    params.append("order", sortOrder);

    if (fromDate) params.append("fromDate", fromDate);
    if (toDate) params.append("toDate", toDate);
    if (search) params.append("search", search);

    try {
      const res = await fetch(`/api/invoice-list?${params.toString()}`);
      const response = await res.json();

      if (response.success) {
        setInvoices(response.data || []);
        setMeta(response.meta);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.error("Fetch invoices failed:", err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, limit, fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchData();
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const handleReset = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setSortBy("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const max = 5;
    let start = Math.max(1, currentPage - Math.floor(max / 2));
    let end = Math.min(meta.totalPages, start + max - 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const SortIcon = ({ column }) =>
    sortBy !== column ? (
      <span className="ml-1 text-gray-400">↕</span>
    ) : sortOrder === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );

  return (
    <div className="bg-white rounded shadow p-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row justify-between gap-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleReset}
            className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
          >
            Reset
          </button>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border px-3 py-1 rounded"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border px-3 py-1 rounded"
          />
        </div>
        <input
          type="text"
          placeholder="Search by invoice or buyer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-1 rounded w-full md:w-64"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto hidden md:block border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th
                onClick={() => handleSort("invoice_number")}
                className="px-4 py-2 cursor-pointer"
              >
                Invoice No <SortIcon column="invoice_number" />
              </th>
              <th className="px-4 py-2">Buyer</th>
              <th
                onClick={() => handleSort("order_date")}
                className="px-4 py-2 cursor-pointer"
              >
                Order Date <SortIcon column="order_date" />
              </th>
              <th className="px-4 py-2">Tax</th>
              <th className="px-4 py-2">Grand Total</th>
              <th
                onClick={() => handleSort("created_at")}
                className="px-4 py-2 cursor-pointer"
              >
                Created <SortIcon column="created_at" />
              </th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : invoices.length ? (
              invoices.map((i) => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{i.invoice_number}</td>
                  <td className="px-4 py-2">{i.buyer_name}</td>
                  <td className="px-4 py-2">
                    {new Date(i.order_date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2">
                    ₹{Number(i.tax_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    ₹{Number(i.grand_total).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2">
                    {new Date(i.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Link
                      href={`/admin-dashboard/invoices/${i.invoice_number}`}
                      className="bg-green-600 text-white px-3 py-1 rounded"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-500">
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center mt-6 gap-1">
          {getPageNumbers().map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`px-3 py-1 rounded ${p === currentPage ? "bg-green-600 text-white" : "bg-gray-100"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
