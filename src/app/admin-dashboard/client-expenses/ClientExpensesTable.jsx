"use client";

import React from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, Pencil, Trash2, Search, RotateCcw, ChevronUp, ChevronDown, ArrowLeft, Inbox, X, Calendar } from "lucide-react";

export default function ClientExpensesTable({ rows, client, group, initialSearchQuery = "" }) {
  const router = useRouter();

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  const [searchQuery, setSearchQuery] = useState(() => initialSearchQuery || "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [deletingId, setDeletingId] = useState(null);
  const [expandedHeads] = useState(new Set());

  const handleDelete = async (id, e) => {
    e?.preventDefault();
    if (!confirm("Are you sure you want to delete this client expense? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/client-expenses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Client expense deleted successfully!");
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      !searchQuery ||
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (fromDate || toDate) {
      const rowDate = row.created_at ? dayjs(row.created_at).format("YYYY-MM-DD") : null;
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
        : { key, direction: "asc" }
    );
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const key = sortConfig.key;

    const getVal = (row) => {
      switch (key) {
        case "id":
          return Number(row.id || 0);
        case "expense_name":
          return (row.expense_name || "").toLowerCase();
        case "client_name":
          return (row.client_name || "").toLowerCase();
        case "group_name":
          return (row.group_name || "").toLowerCase();
        case "main_head":
          return (row.main_head || "").toLowerCase();
        case "head":
          return (row.head || "").toLowerCase();
        case "sub_head":
          return (row.sub_head || "").toLowerCase();
        case "supply":
          return (row.supply || "").toLowerCase();
        case "transaction_id":
          return (row.transaction_id || "").toLowerCase();
        case "amount":
          return Number(row.amount || 0);
        case "created_at":
          return row.created_at ? dayjs(row.created_at).valueOf() : 0;
        default:
          return 0;
      }
    };

    const va = getVal(a);
    const vb = getVal(b);
    if (typeof va === "string" || typeof vb === "string") {
      return va.localeCompare(vb) * dir;
    }
    return (va - vb) * dir;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" ? <ChevronUp className="inline w-4 h-4 ml-0.5" /> : <ChevronDown className="inline w-4 h-4 ml-0.5" />;
  };

  const handleReset = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
  };

  const renderRow = (row) => (
    <tr
      key={row.id}
      className="hover:bg-blue-50/50 transition-colors duration-150 border-b border-gray-100 last:border-0"
    >
      <td className="p-3 font-medium text-gray-600">{row.id}</td>
      <td className="p-3">{row.expense_name}</td>
      <td className="p-3 font-medium text-gray-800">{row.client_name}</td>
      <td className="p-3 text-gray-600">{row.group_name || "-"}</td>
      <td className="p-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${row.main_head === "Direct" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
          {row.main_head}
        </span>
      </td>
      <td className="p-3 text-gray-600">{row.head || "-"}</td>
      <td className="p-3 text-gray-600">{row.sub_head || "-"}</td>
      <td className="p-3 text-gray-600">{row.supply || "-"}</td>
      <td className="p-3 text-gray-600 font-mono text-xs max-w-[140px] truncate" title={row.transaction_id || ""}>{row.transaction_id || "-"}</td>
      <td className="p-3 font-semibold text-emerald-700 tabular-nums">{row.amount != null ? `₹${Number(row.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}</td>
      <td className="p-3 text-gray-600">{row.created_at ? dayjs(row.created_at).format("DD MMM YYYY") : "-"}</td>
      <td className="p-3">
        <div className="flex gap-1.5 items-center">
          <Link href={`/admin-dashboard/client-expenses/${row.id}`} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors" title="View">
            <Eye size={16} />
          </Link>
          <Link href={`/admin-dashboard/client-expenses/edit/${row.id}`} className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-colors" title="Edit">
            <Pencil size={16} />
          </Link>
          <button
            type="button"
            onClick={(e) => handleDelete(row.id, e)}
            disabled={deletingId === row.id}
            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:shadow transition-all w-full sm:w-auto"
            >
              <RotateCcw size={16} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(
                  client && group
                    ? `/admin-dashboard/client-expenses/sub-head-cards?client=${encodeURIComponent(client)}&group=${encodeURIComponent(group)}`
                    : "/admin-dashboard/client-expenses/cards"
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:shadow transition-all w-full sm:w-auto"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
            <div className="relative w-full sm:w-[300px] sm:min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 min-w-0 w-full sm:w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <span className="text-gray-400 shrink-0">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="flex-1 min-w-0 w-full sm:w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors w-full sm:w-auto shrink-0"
            >
              <X size={14} />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:block overflow-auto bg-white shadow-lg rounded-xl border border-gray-200">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gradient-to-r from-slate-700 to-slate-800 sticky top-0 z-10">
            <tr className="text-left font-medium text-white">
              <th onClick={() => handleSort("id")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors rounded-tl-xl">ID<SortIcon column="id" /></th>
              <th onClick={() => handleSort("expense_name")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Expense Name<SortIcon column="expense_name" /></th>
              <th onClick={() => handleSort("client_name")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Client Name<SortIcon column="client_name" /></th>
              <th onClick={() => handleSort("group_name")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Group Name<SortIcon column="group_name" /></th>
              <th onClick={() => handleSort("main_head")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Main Head<SortIcon column="main_head" /></th>
              <th onClick={() => handleSort("head")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Head<SortIcon column="head" /></th>
              <th onClick={() => handleSort("sub_head")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Sub-head<SortIcon column="sub_head" /></th>
              <th onClick={() => handleSort("supply")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Supply<SortIcon column="supply" /></th>
              <th onClick={() => handleSort("transaction_id")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Trans. ID<SortIcon column="transaction_id" /></th>
              <th onClick={() => handleSort("amount")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Amount<SortIcon column="amount" /></th>
              <th onClick={() => handleSort("created_at")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Created<SortIcon column="created_at" /></th>
              <th className="p-3 rounded-tr-xl">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 bg-white">
            {sortedRows.length > 0 ? (
              <>
                {sortedRows.map((row) => renderRow(row))}
              </>
            ) : (
              <tr>
                <td colSpan="12" className="p-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="w-12 h-12 text-gray-300" />
                    <span className="font-medium">No entries found.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden flex flex-col gap-4">
        {sortedRows.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-500">
            <Inbox className="w-12 h-12 text-gray-300" />
            <span className="font-medium">No entries found.</span>
          </div>
        )}
        {sortedRows.map((row) => (
          <div key={row.id} className="border border-gray-200 rounded-xl p-4 shadow-md bg-white text-sm space-y-2 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-xs font-medium text-gray-500">ID {row.id}</span>
                <div className="font-semibold text-gray-800 mt-0.5">{row.expense_name}</div>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${row.main_head === "Direct" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{row.main_head}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
              <div><span className="text-gray-500">client_name:</span> {row.client_name}</div>
              <div><span className="text-gray-500">group_name:</span> {row.group_name || "-"}</div>
              <div><span className="text-gray-500">Head:</span> {row.head || "-"}</div>
              <div><span className="text-gray-500">Sub-head:</span> {row.sub_head || "-"}</div>
              <div><span className="text-gray-500">Supply:</span> {row.supply || "-"}</div>
              <div className="col-span-2"><span className="text-gray-500">Trans. ID:</span> <span className="font-mono text-xs break-all">{row.transaction_id || "-"}</span></div>
              <div><span className="text-gray-500">Created:</span> {row.created_at ? dayjs(row.created_at).format("DD MMM YYYY") : "-"}</div>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-emerald-700">₹{row.amount != null ? Number(row.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</span>
              <div className="flex gap-1.5">
                <Link href={`/admin-dashboard/client-expenses/${row.id}`} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="View"><Eye size={16} /></Link>
                <Link href={`/admin-dashboard/client-expenses/edit/${row.id}`} className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100" title="Edit"><Pencil size={16} /></Link>
                <button type="button" onClick={(e) => handleDelete(row.id, e)} disabled={deletingId === row.id} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50" title="Delete"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {/* mobile cards already simple list; no expand/collapse now */}
      </div>
    </div>
  );
}
