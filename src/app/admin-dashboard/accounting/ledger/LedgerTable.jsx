"use client";

import { useState, useMemo, useRef } from "react";
import { Plus, Trash2, Search, Download, ArrowUp, ArrowDown, X } from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

const VCH_TYPES = [
  "Payment",
  "Receipt",
  "Journal",
  "Sales",
  "Purchase",
  "Contra",
  "Credit Note",
  "Debit Note",
  "Opening",
  "Other",
];

const EMPTY_FORM = {
  entry_date: dayjs().format("YYYY-MM-DD"),
  particulars: "",
  vch_type: "",
  vch_no: "",
  debit: "",
  credit: "",
};

export default function LedgerTable({ rows: initialRows }) {
  const [rows, setRows] = useState(initialRows ?? []);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [vchTypeFilter, setVchTypeFilter] = useState("");
  const [sortCol, setSortCol] = useState("entry_date");
  const [sortDir, setSortDir] = useState("desc");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // ─── Sorting ───────────────────────────────────────────────────
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ArrowUp size={13} className="opacity-30 ml-1 inline" />;
    return sortDir === "asc"
      ? <ArrowUp size={13} className="ml-1 inline text-blue-600" />
      : <ArrowDown size={13} className="ml-1 inline text-blue-600" />;
  };

  // ─── Filtered + sorted rows ────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...rows];

    if (dateFrom) {
      data = data.filter((r) => r.entry_date >= dateFrom);
    }
    if (dateTo) {
      data = data.filter((r) => r.entry_date <= dateTo);
    }
    if (vchTypeFilter) {
      data = data.filter(
        (r) => r.vch_type?.toLowerCase() === vchTypeFilter.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      data = data.filter(
        (r) =>
          r.particulars?.toLowerCase().includes(q) ||
          r.vch_no?.toLowerCase().includes(q) ||
          r.vch_type?.toLowerCase().includes(q)
      );
    }

    // Sort
    data.sort((a, b) => {
      let aVal = a[sortCol] ?? "";
      let bVal = b[sortCol] ?? "";
      if (sortCol === "debit" || sortCol === "credit") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [rows, dateFrom, dateTo, vchTypeFilter, searchQuery, sortCol, sortDir]);

  // ─── Totals ────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const debit = filtered.reduce((s, r) => s + Number(r.debit || 0), 0);
    const credit = filtered.reduce((s, r) => s + Number(r.credit || 0), 0);
    return { debit, credit, balance: debit - credit };
  }, [filtered]);

  const fmt = (n) =>
    Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ─── Add entry ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.entry_date) return toast.error("Date is required");
    if (!form.particulars.trim()) return toast.error("Particulars is required");
    if (!form.vch_type) return toast.error("Vch Type is required");
    const debit = parseFloat(form.debit) || 0;
    const credit = parseFloat(form.credit) || 0;
    if (debit === 0 && credit === 0) return toast.error("Enter Debit or Credit amount");

    setSaving(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entry_date: form.entry_date,
          particulars: form.particulars.trim(),
          vch_type: form.vch_type,
          vch_no: form.vch_no.trim(),
          debit,
          credit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setRows((prev) => [data.entry, ...prev]);
      toast.success("Entry added");
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete entry ──────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm("Delete this ledger entry?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ledger/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Entry deleted");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── CSV Export ────────────────────────────────────────────────
  const handleExport = () => {
    const header = ["Date", "Particulars", "Vch Type", "Vch No", "Debit", "Credit"];
    const csvRows = filtered.map((r) => [
      r.entry_date,
      `"${(r.particulars || "").replace(/"/g, '""')}"`,
      r.vch_type || "",
      r.vch_no || "",
      r.debit || "0.00",
      r.credit || "0.00",
    ]);
    const csv = [header.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Ledger</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {filtered.length} entries
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Debit", value: totals.debit, color: "text-red-600" },
          { label: "Total Credit", value: totals.credit, color: "text-green-600" },
          {
            label: "Net Balance",
            value: Math.abs(totals.balance),
            color: totals.balance >= 0 ? "text-red-600" : "text-green-600",
            suffix: totals.balance >= 0 ? " (Dr)" : " (Cr)",
          },
        ].map(({ label, value, color, suffix }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:bg-gray-800 dark:border-gray-700"
          >
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {label}
            </p>
            <p className={`mt-1 text-xl font-bold ${color}`}>
              ₹{fmt(value)}{suffix ?? ""}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search particulars, vch no…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white w-56"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="text-sm rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="text-sm rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        <select
          value={vchTypeFilter}
          onChange={(e) => setVchTypeFilter(e.target.value)}
          className="text-sm rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="">All Vch Types</option>
          {VCH_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(searchQuery || vchTypeFilter) && (
          <button
            onClick={() => { setSearchQuery(""); setVchTypeFilter(""); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              {[
                { label: "Date", col: "entry_date" },
                { label: "Particulars", col: "particulars" },
                { label: "Vch Type", col: "vch_type" },
                { label: "Vch No", col: "vch_no" },
                { label: "Debit (₹)", col: "debit" },
                { label: "Credit (₹)", col: "credit" },
              ].map(({ label, col }) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none whitespace-nowrap hover:text-blue-600"
                >
                  {label}
                  <SortIcon col={col} />
                </th>
              ))}
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No ledger entries found.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-200">
                    {dayjs(row.entry_date).format("DD MMM YYYY")}
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-100 max-w-xs">
                    {row.particulars}
                  </td>
                  <td className="px-4 py-3">
                    <VchBadge type={row.vch_type} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {row.vch_no || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 whitespace-nowrap">
                    {Number(row.debit) > 0 ? `₹${fmt(row.debit)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600 whitespace-nowrap">
                    {Number(row.credit) > 0 ? `₹${fmt(row.credit)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition"
                      title="Delete entry"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-gray-700 dark:text-gray-200">
                  Total ({filtered.length} entries)
                </td>
                <td className="px-4 py-3 text-right font-mono text-red-600">
                  ₹{fmt(totals.debit)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-green-600">
                  ₹{fmt(totals.credit)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-gray-400">No ledger entries found.</p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {row.particulars}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {dayjs(row.entry_date).format("DD MMM YYYY")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(row.id)}
                  disabled={deletingId === row.id}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <VchBadge type={row.vch_type} />
                {row.vch_no && (
                  <span className="text-gray-500 dark:text-gray-400">#{row.vch_no}</span>
                )}
              </div>
              <div className="mt-3 flex gap-4 text-sm font-mono">
                {Number(row.debit) > 0 && (
                  <span className="text-red-600 font-semibold">Dr ₹{fmt(row.debit)}</span>
                )}
                {Number(row.credit) > 0 && (
                  <span className="text-green-600 font-semibold">Cr ₹{fmt(row.credit)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                Add Ledger Entry
              </h2>
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Particulars */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Particulars <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash received from XYZ"
                  value={form.particulars}
                  onChange={(e) => setForm((f) => ({ ...f, particulars: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Vch Type + Vch No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Vch Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.vch_type}
                    onChange={(e) => setForm((f) => ({ ...f, vch_type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select Type</option>
                    {VCH_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Vch No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-001"
                    value={form.vch_no}
                    onChange={(e) => setForm((f) => ({ ...f, vch_no: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              {/* Debit + Credit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Debit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.debit}
                    onChange={(e) => setForm((f) => ({ ...f, debit: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Credit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.credit}
                    onChange={(e) => setForm((f) => ({ ...f, credit: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VchBadge({ type }) {
  const colorMap = {
    Payment:      "bg-orange-100 text-orange-700",
    Receipt:      "bg-green-100 text-green-700",
    Journal:      "bg-blue-100 text-blue-700",
    Sales:        "bg-purple-100 text-purple-700",
    Purchase:     "bg-red-100 text-red-700",
    Contra:       "bg-yellow-100 text-yellow-700",
    "Credit Note":"bg-teal-100 text-teal-700",
    "Debit Note": "bg-pink-100 text-pink-700",
    Opening:      "bg-gray-100 text-gray-700",
    Other:        "bg-slate-100 text-slate-700",
  };
  const cls = colorMap[type] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {type || "—"}
    </span>
  );
}
