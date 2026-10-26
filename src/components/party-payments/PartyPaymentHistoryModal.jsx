"use client";

import { useEffect, useState } from "react";
import { X, ArrowDownLeft, ArrowUpRight } from "lucide-react";

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

export default function PartyPaymentHistoryModal({ open, row, onClose }) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [titleName, setTitleName] = useState("");
  const [entryCreatedBy, setEntryCreatedBy] = useState("");

  useEffect(() => {
    if (!open || !row?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/party-payments/${row.id}/history`, {
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Failed to load history");
        setHistory(Array.isArray(data.history) ? data.history : []);
        setTitleName(data.name || row.name || "");
        setEntryCreatedBy(data.created_by || row.created_by || "");
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row?.id, row?.name]);

  if (!open || !row) return null;

  const totalIn = history
    .filter((h) => h.entry_type === "in")
    .reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const totalOut = history
    .filter((h) => h.entry_type === "out")
    .reduce((s, h) => s + (Number(h.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">In / Out history</h2>
            <p className="text-sm text-gray-500">
              #{row.id} · {titleName || row.name || row.customer_id}
              {entryCreatedBy ? (
                <span className="block text-xs mt-0.5">
                  Entry created by: <strong>{entryCreatedBy}</strong>
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 flex flex-wrap gap-4 text-sm border-b bg-gray-50">
          <span>
            In (history): <strong className="text-green-700">{formatInr(totalIn)}</strong>
          </span>
          <span>
            Out (history): <strong className="text-orange-700">{formatInr(totalOut)}</strong>
          </span>
        </div>

        <div className="overflow-auto flex-1 p-5">
          {loading ? (
            <p className="text-center text-gray-500 py-8">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No history entries yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Order</th>
                  <th className="pb-2 pr-3">Invoice</th>
                  <th className="pb-2 pr-3">Created By</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h) => {
                  const isIn = h.entry_type === "in";
                  return (
                    <tr key={h.id}>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            isIn
                              ? "bg-green-50 text-green-800"
                              : "bg-orange-50 text-orange-800"
                          }`}
                        >
                          {isIn ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          {isIn ? "In" : "Out"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(h.entry_date || h.created_at)}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {h.customer_name || h.customer_id || "—"}
                        {h.company_name ? (
                          <span className="block text-gray-500">{h.company_name}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {h.order_id || "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {h.invoice_number ||
                          (h.trans_id ? `UTR: ${h.trans_id}` : "—")}
                      </td>
                      <td className="py-2 pr-3 text-xs text-gray-600">
                        {h.created_by || "—"}
                      </td>
                      <td
                        className={`py-2 text-right font-medium ${
                          isIn ? "text-green-700" : "text-orange-700"
                        }`}
                      >
                        {formatInr(h.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
