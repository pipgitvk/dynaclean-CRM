"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, Plus, Search, IndianRupee, History } from "lucide-react";
import PartyPaymentHistoryModal from "@/components/party-payments/PartyPaymentHistoryModal";
import {
  derivePartyPaymentStatus,
  partyPaymentStatusLabel,
} from "@/lib/partyPaymentsCompute";
import PartyPaymentEntryModal from "@/components/party-payments/PartyPaymentEntryModal";

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(val) {
  if (!val) return "—";
  const s = String(val).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export default function PartyPaymentsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [historyRow, setHistoryRow] = useState(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const q = appliedSearch ? `?search=${encodeURIComponent(appliedSearch)}` : "";
      const res = await fetch(`/api/party-payments${q}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      toast.error(err.message || "Failed to load party payments");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (row) => {
    if (
      !window.confirm(
        `Delete payment entry for ${row.name || row.customer_id || "this party"}?`,
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/party-payments/${row.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Deleted");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      toast.error(err.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.in += Number(r.amount_in) || 0;
        acc.out += Number(r.amount_out) || 0;
        acc.balance += Number(r.balance) || 0;
        const st =
          r.status || derivePartyPaymentStatus(r.amount_in, r.amount_out);
        if (st === "utilize") acc.utilize += 1;
        else if (st === "partial-utilize") acc.partial += 1;
        else acc.unUtilize += 1;
        return acc;
      },
      { in: 0, out: 0, balance: 0, utilize: 0, partial: 0, unUtilize: 0 },
    );
  }, [rows]);

  return (
    <div className="max-w-full mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <IndianRupee className="w-8 h-8 text-blue-600" />
            Party Payments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Customer-wise payment in / out, balance, and utilization.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add Entry
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setAppliedSearch(search.trim());
            }}
            placeholder="Search party payments or customers (ID, name, company, phone)…"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setAppliedSearch(search.trim())}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
        >
          Search
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total In", value: formatInr(totals.in) },
          { label: "Total Out", value: formatInr(totals.out) },
          { label: "Balance", value: formatInr(totals.balance) },
          { label: "Utilize", value: String(totals.utilize) },
          { label: "Partial-utilize", value: String(totals.partial) },
          { label: "Un-utilize", value: String(totals.unUtilize) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500">{card.label}</p>
            <p className="text-lg font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="px-3 py-3">Customer ID</th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Company</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Payment Date</th>
              <th className="px-3 py-3">Created By</th>
              <th className="px-3 py-3 text-right">In</th>
              <th className="px-3 py-3 text-right">Out</th>
              <th className="px-3 py-3 text-right">Balance</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                  No party payment entries yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{row.customer_id || "—"}</td>
                  <td className="px-3 py-2">{row.name || "—"}</td>
                  <td className="px-3 py-2">{row.company_name || "—"}</td>
                  <td className="px-3 py-2">{row.phone || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.payment_date)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{row.created_by || "—"}</td>
                  <td className="px-3 py-2 text-right">{formatInr(row.amount_in)}</td>
                  <td className="px-3 py-2 text-right">{formatInr(row.amount_out)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatInr(row.balance)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      status={
                        row.status ||
                        derivePartyPaymentStatus(row.amount_in, row.amount_out)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryRow(row)}
                        className="p-1.5 rounded text-violet-600 hover:bg-violet-50"
                        title="In / Out history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="p-1.5 rounded text-blue-600 hover:bg-blue-50"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PartyPaymentEntryModal
        open={showModal}
        onClose={closeModal}
        editing={editing}
        onSuccess={fetchRows}
      />

      <PartyPaymentHistoryModal
        open={Boolean(historyRow)}
        row={historyRow}
        onClose={() => setHistoryRow(null)}
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const label = partyPaymentStatusLabel(status);
  const styles =
    status === "utilize"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "partial-utilize"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles}`}
    >
      {label}
    </span>
  );
}
