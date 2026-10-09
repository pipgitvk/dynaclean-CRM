"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const InvoiceEditModal = dynamic(() => import("@/app/admin-dashboard/invoices/InvoiceEditModal"), { ssr: false });

export default function PerformaInvoiceList({
  viewHrefBase = "/user-dashboard/invoices",
}) {
  const getMonthStartEnd = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { firstDay, lastDay };
  };

  const formatDateForInput = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const { firstDay: firstDayOfMonth, lastDay: lastDayOfMonth } = getMonthStartEnd();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(formatDateForInput(firstDayOfMonth));
  const [toDate, setToDate] = useState(formatDateForInput(lastDayOfMonth));
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [fetchError, setFetchError] = useState(null);
  const [editId, setEditId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.append("page", 1);
    params.append("limit", 10000);
    params.append("sort", sortBy);
    params.append("order", sortOrder);
    params.append("invoiceType", "performa");
    if (fromDate) params.append("fromDate", fromDate);
    if (toDate) params.append("toDate", toDate);
    if (search) params.append("search", search);
    params.append("includeDetails", "1");

    try {
      setFetchError(null);
      const res = await fetch(`/api/invoice-table?${params.toString()}`);
      const response = await res.json();

      if (response.success) {
        const data = response.data || [];
        const sorted = [...data].sort((a, b) => {
          if (sortOrder === "desc") {
            return String(b[sortBy] || "").localeCompare(String(a[sortBy] || ""));
          }
          return String(a[sortBy] || "").localeCompare(String(b[sortBy] || ""));
        });
        setInvoices(sorted);
      } else {
        setInvoices([]);
        setFetchError(response.detail || response.error || "Failed to load");
      }
    } catch (err) {
      console.error("Fetch performa invoices failed:", err);
      setInvoices([]);
      setFetchError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleReset = () => {
    const { firstDay, lastDay } = getMonthStartEnd();
    setSearch("");
    setFromDate(formatDateForInput(firstDay));
    setToDate(formatDateForInput(lastDay));
    setSortBy("created_at");
    setSortOrder("desc");
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }) =>
    sortBy !== column ? (
      <span className="ml-1 text-gray-400">↕</span>
    ) : sortOrder === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );

  const summary = {
    count: invoices.length,
    grandTotal: invoices.reduce((s, i) => s + Number(i.grand_total || 0), 0),
  };

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <h3 className="text-lg font-bold text-purple-700 flex items-center gap-2">
          <span className="w-1 h-6 bg-purple-500 rounded"></span>
          Performa Invoices
          <span className="text-sm font-normal text-gray-500">
            ({summary.count} records)
          </span>
        </h3>
        <div className="text-sm text-gray-600">
          Total: <span className="font-bold text-purple-700">₹{fmt(summary.grandTotal)}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <button
          onClick={handleReset}
          className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm whitespace-nowrap"
        >
          Reset
        </button>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border px-3 py-1 rounded text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border px-3 py-1 rounded text-sm"
        />
        <input
          type="text"
          placeholder="Search invoice / buyer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-1 rounded text-sm flex-1"
        />
      </div>

      {/* Desktop Table */}
      <div className="overflow-x-auto hidden md:block border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th onClick={() => handleSort("invoice_number")} className="px-3 py-2 cursor-pointer text-left">
                Invoice No <SortIcon column="invoice_number" />
              </th>
              <th className="px-3 py-2 text-left">Buyer</th>
              <th className="px-3 py-2 text-left">Created By</th>
              <th onClick={() => handleSort("invoice_date")} className="px-3 py-2 cursor-pointer text-left">
                Date <SortIcon column="invoice_date" />
              </th>
              <th className="px-3 py-2 text-right">Grand Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th onClick={() => handleSort("created_at")} className="px-3 py-2 cursor-pointer text-left">
                Created <SortIcon column="created_at" />
              </th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-4 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan="8" className="text-center py-6 text-red-600">
                  {fetchError}
                </td>
              </tr>
            ) : invoices.length ? (
              invoices.map((i) => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">
                    {i.invoice_number}
                  </td>
                  <td className="px-3 py-2">{i.buyer_name}</td>
                  <td className="px-3 py-2">{i.created_by || i.employee_name || "-"}</td>
                  <td className="px-3 py-2">
                    {new Date(i.invoice_date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    ₹{fmt(i.grand_total)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      i.status === 'PAID' ? 'bg-green-100 text-green-800' :
                      i.status === 'PARTIAL PAID' ? 'bg-yellow-100 text-yellow-800' :
                      i.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {i.status || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {new Date(i.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-1.5">
                      <Link
                        href={`${viewHrefBase}/${encodeURIComponent(i.invoice_number)}`}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => setEditId(i.id)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center py-6 text-gray-500">
                  No performa invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading...</div>
        ) : fetchError ? (
          <div className="text-center py-6 text-red-600">{fetchError}</div>
        ) : invoices.length ? (
          invoices.map((i) => (
            <div key={i.id} className="border rounded p-3 bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium text-sm">{i.invoice_number}</div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  i.status === 'PAID' ? 'bg-green-100 text-green-800' :
                  i.status === 'PARTIAL PAID' ? 'bg-yellow-100 text-yellow-800' :
                  i.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {i.status || '—'}
                </span>
              </div>
              <div className="text-sm mb-1"><span className="text-gray-500">Buyer:</span> {i.buyer_name}</div>
              <div className="text-xs text-gray-500 mb-1">
                Created by: {i.created_by || i.employee_name || "-"}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Date: {new Date(i.invoice_date).toLocaleDateString("en-IN")} | Created: {new Date(i.created_at).toLocaleDateString("en-IN")}
              </div>
              <div className="flex justify-between items-center">
                <div className="font-bold text-purple-700">₹{fmt(i.grand_total)}</div>
                <div className="flex gap-1.5">
                  <Link
                    href={`${viewHrefBase}/${encodeURIComponent(i.invoice_number)}`}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => setEditId(i.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-gray-500">No performa invoices found</div>
        )}
      </div>

      {editId != null && (
        <InvoiceEditModal
          open
          invoiceId={editId}
          onClose={() => setEditId(null)}
          onSaved={fetchData}
          viewHrefBase={viewHrefBase}
        />
      )}
    </div>
  );
}
