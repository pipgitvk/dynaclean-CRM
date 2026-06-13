"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  const [selectedStatementIds, setSelectedStatementIds] = useState(new Set());
  const [initialLinkedStatementIds, setInitialLinkedStatementIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [stmtStartDate, setStmtStartDate] = useState("");
  const [stmtEndDate, setStmtEndDate] = useState("");

  // Helper to get linked keys for a statement
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
        keys.push(`PS${s}`);
      }
    }
    return keys;
  };

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    setStmtStartDate(firstDay);
    setStmtEndDate(lastDay);
    setStatements([]);
    setSearch("");
    // Initialize selected statements with those already linked to our selected purchases
    const initialSelected = new Set();
    const initialLinked = new Set();
    let cancelled = false;
    setLoading(true);
    fetch("/api/statements", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.statements) ? data.statements : [];
        setStatements(rows);
        
        // Auto-select statements already linked to selected purchases
        const selectedPurchaseKeys = new Set(Array.from(selectedPurchaseIds).map(id => `PS${id}`));
        rows.forEach(stmt => {
          const linkedKeys = getLinkedKeys(stmt);
          const isLinkedToSelected = linkedKeys.some(key => selectedPurchaseKeys.has(key));
          if (isLinkedToSelected) {
            initialSelected.add(stmt.id);
            initialLinked.add(stmt.id);
          }
        });
        setSelectedStatementIds(initialSelected);
        setInitialLinkedStatementIds(initialLinked);
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
  }, [open, selectedPurchaseIds]);

  const { totalSelectedAmount, remainingAmount, statementDistribution, selectedGroups, purchaseDistribution } = useMemo(() => {
    // First, simulate what paid amount would be with only non-selected statements!
    const selectedPurchaseIdsList = Array.from(selectedPurchaseIds);
    const selectedPurchaseTokens = new Set(selectedPurchaseIdsList.map(id => `PS${id}`));
    
    // Split statements into selected and non-selected!
    const selectedStatementsList = statements.filter(s => selectedStatementIds.has(s.id)).sort((a, b) => a.id - b.id);
    const nonSelectedStatementsList = statements.filter(s => !selectedStatementIds.has(s.id));

    // Find non-selected statements that are still linked to selected purchases!
    const nonSelectedStillLinked = nonSelectedStatementsList.filter(stmt => {
      const tokens = getLinkedKeys(stmt);
      return tokens.some(t => selectedPurchaseTokens.has(t));
    });

    // Now, get selected purchases sorted!
    const selectedPurchases = purchases.filter(p => selectedPurchaseIds.has(Number(p.id)));
    const parentId = Math.max(...selectedPurchases.map(p => p.id));
    const children = selectedPurchases.filter(p => p.id !== parentId);
    const sortedChildren = children.sort((a, b) => a.id - b.id);
    const selectedPurchasesSorted = [...sortedChildren, ...selectedPurchases.filter(p => p.id === parentId)];

    // Simulate paid_amount!
    const simulatedPaid = {};
    selectedPurchasesSorted.forEach(p => simulatedPaid[p.id] = 0);
    [...nonSelectedStillLinked].sort((a, b) => a.id - b.id).forEach(stmt => {
      let remainingToAllocate = Number(stmt.amount || 0);
      for (const purchase of selectedPurchasesSorted) {
        if (remainingToAllocate <= 0) break;
        const net = Number(purchase.net_amount || 0);
        const needed = net - simulatedPaid[purchase.id];
        if (needed <= 0) continue;
        const apply = Math.min(needed, remainingToAllocate);
        simulatedPaid[purchase.id] += apply;
        remainingToAllocate -= apply;
      }
    });

    // Calculate total simulatedPaid first!
    let totalSimulatedPaid = 0;
    Object.values(simulatedPaid).forEach(paid => totalSimulatedPaid += paid);
    const remainingNeededFromSelected = Math.max(0, selectedNetAmount - totalSimulatedPaid);
    
    // Now calculate selected statements distribution with applied and remaining!
    const distribution = {};
    let totalPaymentAvailable = 0;
    let remainingToDistributeStatements = remainingNeededFromSelected;
    selectedStatementsList.forEach(s => {
      const stmtAmount = Number(s.amount || 0);
      const toApply = Math.min(stmtAmount, remainingToDistributeStatements);
      distribution[s.id] = {
        amount: stmtAmount,
        applied: toApply,
        remaining: stmtAmount - toApply
      };
      totalPaymentAvailable += toApply;
      remainingToDistributeStatements -= toApply;
    });

    // Now distribute selected statements to purchases!
    const purchaseDist = {};
    let remainingToAllocateSelected = totalPaymentAvailable;
    
    const newPaid = { ...simulatedPaid };
    selectedPurchasesSorted.forEach(purchase => {
      const netAmount = Number(purchase.net_amount || 0);
      const currentPaid = simulatedPaid[purchase.id];
      const needed = netAmount - currentPaid;
      const apply = Math.min(needed, remainingToAllocateSelected);
      
      purchaseDist[purchase.id] = {
        netAmount: netAmount,
        paidAmount: currentPaid,
        needed: needed,
        applied: apply,
        remaining: needed - apply,
        newPaidAmount: currentPaid + apply
      };
      
      newPaid[purchase.id] += apply;
      remainingToAllocateSelected -= apply;
    });

    // Group selected statements by trans_id for top section display
    const groups = {};
    let totalApplied = 0;
    Object.values(purchaseDist).forEach(p => totalApplied += p.applied);
    
    statements.forEach(s => {
      if (selectedStatementIds.has(s.id)) {
        const key = s.trans_id || `_id_${s.id}`;
        if (!groups[key]) {
          groups[key] = {
            trans_id: s.trans_id,
            totalAmount: 0,
            totalApplied: 0
          };
        }
        groups[key].totalAmount += Number(s.amount || 0);
        groups[key].totalApplied += distribution[s.id]?.applied || 0;
      }
    });

    return {
      totalSelectedAmount: totalPaymentAvailable,
      remainingAmount: Math.max(0, selectedNetAmount - (totalSimulatedPaid + totalApplied)),
      statementDistribution: distribution,
      selectedGroups: groups,
      purchaseDistribution: purchaseDist
    };
  }, [statements, selectedStatementIds, selectedNetAmount, purchases, selectedPurchaseIds]);

  const eligibleStatements = useMemo(() => {
    const qRaw = search.trim();
    const q = qRaw.toLowerCase();
    const isNumericSearch = /^\d+$/.test(qRaw);

    const isUnsettled = (s) =>
      (String(s.invoice_status || "").trim() === "Unsettled") ||
      (!s.invoice_status && !s.client_expense_id);
    const isDebit = (s) => String(s.type || "").trim() === "Debit";

    // Get purchase keys for selected purchases (PS{id})
    const selectedPurchaseKeys = new Set(Array.from(selectedPurchaseIds).map(id => `PS${id}`));

    let rows = statements.filter((s) => {
      if (!isDebit(s)) return false;
      const linked = getLinkedKeys(s);
      // Check if statement is either:
      // 1. Unsettled and not linked to any purchase
      // 2. Linked to at least one of our selected purchases
      const isLinkedToSelected = linked.some(key => selectedPurchaseKeys.has(key));
      if (!isUnsettled(s) && !isLinkedToSelected) return false;
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



  const handleToggle = (stmtId) => {
    const statement = statements.find((s) => s.id === stmtId);
    if (!statement) return;

    setSelectedStatementIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stmtId)) {
        newSet.delete(stmtId);
      } else {
        // Calculate how much we already have selected
        let currentTotal = 0;
        newSet.forEach(sid => {
          const s = statements.find(ss => ss.id === sid);
          if (s) currentTotal += Number(s.amount || 0);
        });
        
        // Calculate how much we need
        let simulatedPaidLocal = 0;
        const selectedPurchaseIdsList = Array.from(selectedPurchaseIds);
        const selectedPurchaseTokens = new Set(selectedPurchaseIdsList.map(pid => `PS${pid}`));
        const nonSelectedStatementsList = statements.filter(s => !newSet.has(s.id) && s.id !== stmtId);
        const nonSelectedStillLinked = nonSelectedStatementsList.filter(stmt => {
          const tokens = getLinkedKeys(stmt);
          return tokens.some(t => selectedPurchaseTokens.has(t));
        });
        
        const selectedPurchasesLocal = purchases.filter(p => selectedPurchaseIds.has(Number(p.id)));
        const parentIdLocal = Math.max(...selectedPurchasesLocal.map(p => p.id));
        const childrenLocal = selectedPurchasesLocal.filter(p => p.id !== parentIdLocal);
        const sortedChildrenLocal = childrenLocal.sort((a, b) => a.id - b.id);
        const selectedPurchasesSortedLocal = [...sortedChildrenLocal, ...selectedPurchasesLocal.filter(p => p.id === parentIdLocal)];
        
        const simPaid = {};
        selectedPurchasesSortedLocal.forEach(p => simPaid[p.id] = 0);
        [...nonSelectedStillLinked].sort((a, b) => a.id - b.id).forEach(stmt => {
          let remToAlloc = Number(stmt.amount || 0);
          for (const purchase of selectedPurchasesSortedLocal) {
            if (remToAlloc <= 0) break;
            const net = Number(purchase.net_amount || 0);
            const needed = net - simPaid[purchase.id];
            if (needed <= 0) continue;
            const apply = Math.min(needed, remToAlloc);
            simPaid[purchase.id] += apply;
            remToAlloc -= apply;
          }
        });
        
        Object.values(simPaid).forEach(paid => simulatedPaidLocal += paid);
        const remainingNeeded = Math.max(0, selectedNetAmount - simulatedPaidLocal);
        
        const statementAmount = Number(statement.amount || 0);
        if (currentTotal + statementAmount > remainingNeeded) {
          toast.error(`Cannot select this statement! Selected total cannot exceed ₹${remainingNeeded.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
          return prev;
        }
        
        newSet.add(stmtId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/statements/spare-purchases-bulk-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          statementIds: Array.from(selectedStatementIds),
          purchaseIds: Array.from(selectedPurchaseIds),
          initialLinkedStatementIds: Array.from(initialLinkedStatementIds),
          remainingAmount: remainingAmount
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast.success("Payments updated successfully");
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl p-6 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Link Payment to Selected Spare Purchases</h3>
            <p className="text-xs text-gray-500 mt-1">Select multiple statements (total amount must be ≤ selected total)</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X /></button>
        </div>

        <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
          <h4 className="font-semibold text-sm text-gray-700 mb-2">Selected Spare Purchases ({selectedPurchaseIds.size})</h4>
          <div className="max-h-48 overflow-y-auto">
            <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-gray-700 mb-2 pb-1 border-b border-blue-200">
              <div>ID</div>
              <div>Net Amount</div>
              <div>Payment Applied</div>
              <div>Remaining</div>
              <div>New Paid Amount</div>
            </div>
            {selectedPurchases.sort((a, b) => a.id - b.id).map((p) => {
              const dist = purchaseDistribution[p.id];
              return (
                <div key={p.id} className="grid grid-cols-5 gap-2 text-sm mb-1">
                  <div className="text-gray-700 font-medium">#{p.id}</div>
                  <div className="text-gray-800">₹{Number(p.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <div className="text-green-700 font-medium">
                    {dist ? `₹${dist.applied.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                  </div>
                  <div className="text-orange-700 font-medium">
                    {dist ? `₹${dist.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                  </div>
                  <div className="text-blue-700 font-medium">
                    {dist ? `₹${dist.newPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-blue-300 flex flex-wrap gap-4 justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="font-semibold text-gray-800">Selected Purchase IDs:</span>
                <span className="font-medium text-gray-800 ml-2">{Array.from(selectedPurchaseIds).sort((a, b) => a - b).join(', ')}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Total Amount:</span>
                <span className="font-bold text-blue-700 ml-2">₹{Number(selectedNetAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Selected Payments:</span>
                <span className="font-bold text-purple-700 ml-2">₹{totalSelectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Remaining:</span>
                <span className="font-bold text-green-700 ml-2">₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          {/* Show grouped totals for selected payments */}
          {Object.keys(selectedGroups).length > 0 && (
            <div className="mt-2 p-2 bg-white rounded-md border border-blue-300">
              <h4 className="text-xs font-semibold text-gray-700 mb-1">Payment Details:</h4>
              {Object.values(selectedGroups).map((group, index) => (
                <div key={index} className="text-xs flex items-center gap-2">
                  <span className="text-gray-600">
                    {group.trans_id ? `Trans ID: ${group.trans_id}` : `Statement ID: ${index + 1}`}
                  </span>
                  <span className="text-red-600">
                    Amount: ₹{group.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-green-700">
                    Settled: ₹{group.totalApplied.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
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
                <th className="p-3 border-b font-semibold text-gray-700">Applied</th>
                <th className="p-3 border-b font-semibold text-gray-700">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500">Loading statements...</td>
                </tr>
              ) : eligibleStatements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500">No matching unsettled statements found</td>
                </tr>
              ) : (
                eligibleStatements.map((s) => {
                  const isSelected = selectedStatementIds.has(s.id);
                  const distribution = statementDistribution[s.id];
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50' : ''}`}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggle(s.id)}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-medium text-gray-600">#{s.id}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{s.trans_id || "—"}</td>
                      <td className="p-3 text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : "—"}</td>
                      <td className="p-3 max-w-[300px] truncate text-gray-600" title={s.description || ""}>{s.description || "—"}</td>
                      <td className="p-3 font-bold text-red-600">₹{Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 font-medium text-green-700">
                        {isSelected && selectedGroups[s.trans_id || `_id_${s.id}`] ? 
                          `₹${selectedGroups[s.trans_id || `_id_${s.id}`].totalApplied.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="p-3 font-medium text-orange-600">
                        {isSelected ? 
                          `₹${(Number(s.amount || 0) - (selectedGroups[s.trans_id || `_id_${s.id}`]?.totalApplied || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
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
            disabled={saving}
            className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? "Updating..." : "Update Payments"}
          </button>
        </div>
      </div>
    </div>
  );
}
