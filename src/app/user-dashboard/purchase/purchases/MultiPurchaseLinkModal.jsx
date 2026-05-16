"use client";

import { useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

const MultiPurchaseLinkModal = ({ isOpen, closeModal, selectedPurchaseIds, selectedNetAmount, onLinkSuccess }) => {
  const router = useRouter();
  const [statements, setStatements] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const getCurrentMonthStart = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  };
  
  const getCurrentMonthEnd = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  };
  
  const [stmtStartDate, setStmtStartDate] = useState(getCurrentMonthStart());
  const [stmtEndDate, setStmtEndDate] = useState(getCurrentMonthEnd());

  useEffect(() => {
    if (!isOpen) return;
    setStatements([]);
    setSearch("");
    setSelectedStatementId(null);
    setStmtStartDate(getCurrentMonthStart());
    setStmtEndDate(getCurrentMonthEnd());
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
  }, [isOpen]);

  const getLinkedKeys = (stmt) => {
    const raw = stmt?.linked_purchase_ids;
    if (raw == null || String(raw).trim() === "") return [];
    let arr = null;
    try {
      const parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = String(raw).split(",").map(s => s.trim()).filter(Boolean);
    }
    const keys = [];
    for (const v of arr) {
      if (v == null) continue;
      const s = String(v).trim().toUpperCase();
      if (!s) continue;
      if (/^(PP|PS|SP)\d+$/.test(s)) {
        keys.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
      } else if (/^\d+$/.test(s)) {
        keys.push(`PP${s}`);
      }
    }
    return keys;
  };

  const eligibleStatements = useMemo(() => {
    const q = search.trim().toLowerCase();
    const isUnsettled = (s) =>
      (String(s.invoice_status || "").trim() === "Unsettled") ||
      (!s.invoice_status && !s.client_expense_id);
    const isDebit = (s) => String(s.type || "").trim() === "Debit";

    let rows = statements.filter((s) => {
      if (!isDebit(s)) return false;
      const linked = getLinkedKeys(s);
      if (isUnsettled(s) && linked.length === 0) {
        // Date filter
        if (stmtStartDate && stmtEndDate) {
          const stmtDate = new Date(s.date);
          const start = new Date(stmtStartDate);
          const end = new Date(stmtEndDate);
          end.setHours(23, 59, 59, 999);
          if (stmtDate < start || stmtDate > end) {
            return false;
          }
        }
        return true;
      }
      return false;
    });

    if (q) {
      rows = rows.filter((s) => {
        const id = String(s.id ?? "").toLowerCase();
        const transId = String(s.trans_id ?? "").toLowerCase();
        const desc = String(s.description ?? "").toLowerCase();
        const amount = String(s.amount ?? "").toLowerCase();
        const linked = String(s.linked_purchase_ids ?? "").toLowerCase();
        
        return id.includes(q) || transId.includes(q) || desc.includes(q) || amount.includes(q) || linked.includes(q);
      });
    }

    return rows;
  }, [statements, search, stmtStartDate, stmtEndDate]);

  const handleSelectStatement = (id) => {
    const statement = statements.find((s) => s.id === id);
    if (!statement) return;

    const amount = Number(statement.amount || 0);
    if (Math.abs(amount - selectedNetAmount) > 0.01) {
      toast.error(`Statement amount (₹${amount.toFixed(2)}) must exactly match selected total (₹${selectedNetAmount.toFixed(2)})`);
      return;
    }

    setSelectedStatementId(id);
  };

  const handleSave = async () => {
    if (!selectedStatementId) {
      toast.error("Please select a statement");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/statements/purchases-bulk-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_ids: Array.from(selectedPurchaseIds),
          statement_id: selectedStatementId
        }),
      });

      if (response.ok) {
        toast.success("Payment linked successfully to all selected purchases!");
        if (onLinkSuccess) onLinkSuccess();
        router.refresh();
        closeModal();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to link payment");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={closeModal}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-4 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Link Payment to Selected Purchases</h3>
            <div className="text-xs text-gray-500 mt-1">
              Select one statement with amount exactly matching selected total
            </div>
            <div className="text-sm font-medium mt-2">
              Selected Total: <span className="text-blue-700">₹{selectedNetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search statement..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border rounded-md text-sm w-72 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <input
              type="date"
              value={stmtStartDate}
              onChange={(e) => setStmtStartDate(e.target.value)}
              className="px-3 py-1.5 border rounded-md text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={stmtEndDate}
              onChange={(e) => setStmtEndDate(e.target.value)}
              className="px-3 py-1.5 border rounded-md text-sm"
            />
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
                  <td colSpan={6} className="p-10 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading statements...</span>
                    </div>
                  </td>
                </tr>
              ) : eligibleStatements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500">No matching unsettled statements found</td>
                </tr>
              ) : (
                eligibleStatements.map((s) => {
                  const isSelected = selectedStatementId === s.id;
                  const amountMatch = Math.abs(Number(s.amount || 0) - selectedNetAmount) <= 0.01;

                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                      <td className="p-3">
                        <input
                          type="radio"
                          name="statement"
                          checked={isSelected}
                          onChange={() => handleSelectStatement(s.id)}
                          disabled={!amountMatch}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-medium text-gray-600">#{s.id}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{s.trans_id || "—"}</td>
                      <td className="p-3 text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : "—"}</td>
                      <td className="p-3 max-w-[400px] truncate text-gray-600" title={s.description || ""}>{s.description || "—"}</td>
                      <td className="p-3 font-bold text-red-600">₹{Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="px-3 py-1.5 rounded border"
            disabled={saving}
          >
            Cancel
          </button>
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
};

export default MultiPurchaseLinkModal;
