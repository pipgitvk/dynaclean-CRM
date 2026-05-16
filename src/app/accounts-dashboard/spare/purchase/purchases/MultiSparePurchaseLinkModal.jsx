"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, X, Link2 } from "lucide-react";
import { toast } from "react-hot-toast";

export default function MultiSparePurchaseLinkModal({
  open,
  onClose,
  selectedNetAmount,
  selectedPurchaseIds,
  purchases,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStatementId, setSelectedStatementId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [stmtStartDate, setStmtStartDate] = useState("");
  const [stmtEndDate, setStmtEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    setStmtStartDate(firstDay);
    setStmtEndDate(lastDay);
    setStatements([]);
    setSearch("");
    setSelectedStatementId(null);
    let cancelled = false;
    setLoading(true);
    fetch("/api/statements", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.statements) ? data.statements : [];
        setStatements(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load statements");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const eligibleStatements = useMemo(() => {
    const qRaw = search.trim();
    const q = qRaw.toLowerCase();
    const isNumericSearch = /^\d+$/.test(qRaw);

    const isUnsettled = (s) =>
      (String(s.invoice_status || "").trim() === "Unsettled") ||
      (!s.invoice_status && !s.client_expense_id);
    const isDebit = (s) => String(s.type || "").trim() === "Debit";

    let rows = statements.filter((s) => {
      if (!isDebit(s)) return false;
      if (!isUnsettled(s)) return false;
      const rawLinked = s?.linked_purchase_ids;
      const hasLinked = rawLinked && String(rawLinked).trim() !== "";
      if (hasLinked) return false;
      if (stmtStartDate && s.date && new Date(s.date) < new Date(stmtStartDate)) return false;
      if (stmtEndDate && s.date && new Date(s.date) > new Date(stmtEndDate + "T23:59:59")) return false;
      return true;
    });

    if (q) {
      rows = rows.filter((s) => {
        const id = String(s.id ?? "").toLowerCase();
        const transId = String(s.trans_id ?? "").toLowerCase();
        const desc = String(s.description ?? "").toLowerCase();
        const amount = String(s.amount ?? "").toLowerCase();
        return id.includes(q) || transId.includes(q) || desc.includes(q) || amount.includes(q);
      });
    }

    return rows;
  }, [statements, search, stmtStartDate, stmtEndDate]);

  const selectedStatement = useMemo(
    () => eligibleStatements.find((s) => s.id === selectedStatementId),
    [eligibleStatements, selectedStatementId]
  );

  const handleToggle = (stmtId) => {
    if (selectedStatementId === stmtId) {
      setSelectedStatementId(null);
    } else {
      const stmt = eligibleStatements.find((s) => s.id === stmtId);
      if (Number(stmt?.amount) !== Number(selectedNetAmount)) {
        toast.error("Statement amount must exactly match selected purchases total");
        return;
      }
      setSelectedStatementId(stmtId);
    }
  };

  const handleSave = async () => {
    if (!selectedStatementId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/statements/spare-purchases-bulk-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          statementId: selectedStatementId,
          purchaseIds: Array.from(selectedPurchaseIds),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to link");
      toast.success("Payment linked successfully");
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const selectedPurchases = purchases.filter((p) => selectedPurchaseIds.has(Number(p.id)));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-4 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Link Payment to Selected Spare Purchases</h3>
            <p className="text-xs text-gray-500 mt-1">Select one statement with amount exactly matching selected total</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X /></button>
        </div>

        <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
          <h4 className="font-semibold text-sm text-gray-700 mb-2">Selected Spare Purchases ({selectedPurchaseIds.size})</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {selectedPurchases.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{p.spare_name}</span>
                <span className="font-medium text-gray-800">₹{Number(p.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-blue-300 flex justify-between">
            <span className="font-semibold text-gray-800">Total Amount:</span>
            <span className="font-bold text-blue-700">₹{Number(selectedNetAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search statement..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border rounded-md text-sm w-64"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={stmtStartDate}
                onChange={(e) => setStmtStartDate(e.target.value)}
                className="px-3 py-1.5 border rounded-md text-sm"
              />
              <input
                type="date"
                value={stmtEndDate}
                onChange={(e) => setStmtEndDate(e.target.value)}
                className="px-3 py-1.5 border rounded-md text-sm"
              />
              {(stmtStartDate || stmtEndDate) && (
                <button
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
                    setStmtStartDate(firstDay);
                    setStmtEndDate(lastDay);
                  }}
                  className="px-3 py-1.5 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Reset to Month
                </button>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-600 font-medium">
            {loading ? "Loading..." : `Showing ${eligibleStatements.length} statement(s)`}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3 border-b font-semibold text-gray-700">Select</th>
                <th className="p-3 border-b font-semibold text-gray-700">ID</th>
                <th className="p-3 border-b font-semibold text-gray-700">Trans ID</th>
                <th className="p-3 border-b font-semibold text-gray-700">Date</th>
                <th className="p-3 border-b font-semibold text-gray-700">Description</th>
                <th className="p-3 border-b font-semibold text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500">Loading statements...</td>
                </tr>
              ) : eligibleStatements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500">No matching unsettled statements found</td>
                </tr>
              ) : (
                eligibleStatements.map((s) => {
                  const isSelected = selectedStatementId === s.id;
                  const amountMatches = Number(s.amount) === Number(selectedNetAmount);
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50' : ''}`}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggle(s.id)}
                          disabled={!amountMatches && !isSelected}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                      </td>
                      <td className="p-3 font-medium text-gray-600">#{s.id}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{s.trans_id || "—"}</td>
                      <td className="p-3 text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : "—"}</td>
                      <td className="p-3 max-w-[300px] truncate text-gray-600">{s.description || "—"}</td>
                      <td className="p-3 font-bold text-red-600">₹{Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border" disabled={saving}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!selectedStatementId || saving}
            className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? "Linking..." : "Link Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
