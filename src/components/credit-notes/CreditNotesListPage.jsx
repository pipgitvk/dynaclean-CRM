"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import {
  Eye,
  Search,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Inbox,
} from "lucide-react";

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function CreditNotesListPage({
  viewHrefBase = "/accounts-dashboard/credit-notes",
  orderHrefBase = "/accounts-dashboard/order",
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "saved_at", direction: "desc" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch("/api/credit-notes");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || "Failed to load credit notes");
        }
        if (!cancelled) setRows(json.data || []);
      } catch (e) {
        if (!cancelled) setLoadError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = rows.filter((row) => {
    const haystack = [
      row.credit_note_number,
      row.order_id,
      row.company_name,
      row.invoice_no,
      row.quote_number,
      row.created_by,
    ]
      .join(" ")
      .toLowerCase();
    if (searchQuery && !haystack.includes(searchQuery.toLowerCase())) {
      return false;
    }
    const rowDate = row.credit_note_date
      ? dayjs(row.credit_note_date).format("YYYY-MM-DD")
      : row.saved_at
        ? dayjs(row.saved_at).format("YYYY-MM-DD")
        : null;
    if (fromDate || toDate) {
      if (!rowDate) return false;
      if (fromDate && rowDate < fromDate) return false;
      if (toDate && rowDate > toDate) return false;
    }
    return true;
  });

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const key = sortConfig.key;
    const getVal = (row) => {
      switch (key) {
        case "credit_note_number":
          return (row.credit_note_number || "").toLowerCase();
        case "order_id":
          return (row.order_id || "").toLowerCase();
        case "company_name":
          return (row.company_name || "").toLowerCase();
        case "grand_total":
          return Number(row.grand_total || 0);
        case "credit_note_date":
          return row.credit_note_date
            ? dayjs(row.credit_note_date).valueOf()
            : 0;
        case "saved_at":
          return row.saved_at
            ? dayjs(row.saved_at).valueOf()
            : row.created_at
              ? dayjs(row.created_at).valueOf()
              : 0;
        default:
          return 0;
      }
    };
    const va = getVal(a);
    const vb = getVal(b);
    if (typeof va === "string") return va.localeCompare(String(vb)) * dir;
    return (va - vb) * dir;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="inline w-4 h-4 ml-0.5" />
    ) : (
      <ChevronDown className="inline w-4 h-4 ml-0.5" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Credit Notes</h1>
      </div>

      {loadError && (
        <p className="mb-4 text-red-600 font-medium">{loadError}</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500 block mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="CN no., order, company, invoice…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <TypeableDateFilterInput
            value={fromDate}
            onChange={setFromDate}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <TypeableDateFilterInput
            value={toDate}
            onChange={setToDate}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setSearchQuery("");
            setFromDate("");
            setToDate("");
          }}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-[960px] w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th
                className="p-3 text-left cursor-pointer"
                onClick={() => handleSort("credit_note_number")}
              >
                CN No. <SortIcon column="credit_note_number" />
              </th>
              <th
                className="p-3 text-left cursor-pointer"
                onClick={() => handleSort("order_id")}
              >
                Order <SortIcon column="order_id" />
              </th>
              <th
                className="p-3 text-left cursor-pointer"
                onClick={() => handleSort("company_name")}
              >
                Company <SortIcon column="company_name" />
              </th>
              <th className="p-3 text-left">Invoice</th>
              <th
                className="p-3 text-left cursor-pointer"
                onClick={() => handleSort("credit_note_date")}
              >
                CN Date <SortIcon column="credit_note_date" />
              </th>
              <th className="p-3 text-left">Return</th>
              <th
                className="p-3 text-right cursor-pointer"
                onClick={() => handleSort("grand_total")}
              >
                Amount <SortIcon column="grand_total" />
              </th>
              <th className="p-3 text-left">Created By</th>
              <th className="p-3 text-center">View</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-10 text-center text-gray-500">
                  <Inbox className="mx-auto mb-2 opacity-40" size={32} />
                  No credit notes found
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-gray-100 hover:bg-blue-50/40"
                >
                  <td className="p-3 font-medium text-teal-700">
                    {row.credit_note_number}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`${orderHrefBase}/${encodeURIComponent(row.order_id)}`}
                      className="text-blue-600 hover:underline"
                    >
                      {row.order_id}
                    </Link>
                  </td>
                  <td className="p-3">{row.company_name || "-"}</td>
                  <td className="p-3">{row.invoice_no || "-"}</td>
                  <td className="p-3">
                    {row.credit_note_date
                      ? dayjs(row.credit_note_date).format("DD-MM-YYYY")
                      : "-"}
                  </td>
                  <td className="p-3 capitalize">{row.return_type || "-"}</td>
                  <td className="p-3 text-right font-medium">
                    ₹ {fmtMoney(row.grand_total)}
                  </td>
                  <td className="p-3 text-gray-600">{row.created_by || "-"}</td>
                  <td className="p-3 text-center">
                    <Link
                      href={`${viewHrefBase}/${row.id}`}
                      className="inline-flex p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                      title="View credit note"
                    >
                      <Eye size={16} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
