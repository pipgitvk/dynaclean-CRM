"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

const MultiPurchaseLinkModal = ({ isOpen, closeModal, selectedPurchaseIds, selectedNetAmount, purchases, onLinkSuccess }) => {
  const router = useRouter();
  const [statements, setStatements] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedStatementIds, setSelectedStatementIds] = useState(new Set());
  const [initialLinkedStatementIds, setInitialLinkedStatementIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  
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
        keys.push(s.startsWith("SP") ? `PP${s.slice(2)}` : s);
      } else if (/^\d+$/.test(s)) {
        keys.push(`PP${s}`);
      }
    }
    return keys;
  };
  
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
    // Initialize selected statements with those already linked to our selected purchases
    const initialSelected = new Set();
    const initialLinked = new Set();
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
        
        // Auto-select statements already linked to selected purchases
        const selectedPurchaseKeys = new Set(Array.from(selectedPurchaseIds).map(id => `PP${id}`));
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
  }, [isOpen, selectedPurchaseIds]);

  const eligibleStatements = useMemo(() => {
    const q = search.trim().toLowerCase();
    const isUnsettled = (s) =>
      (String(s.invoice_status || "").trim() === "Unsettled") ||
      (!s.invoice_status && !s.client_expense_id);
    const isDebit = (s) => String(s.type || "").trim() === "Debit";

    // Get purchase keys for selected purchases (PP{id})
    const selectedPurchaseKeys = new Set(Array.from(selectedPurchaseIds).map(id => `PP${id}`));

    let rows = statements.filter((s) => {
      if (!isDebit(s)) return false;
      const linked = getLinkedKeys(s);
      // Check if statement is either:
      // 1. Unsettled and not linked to any purchase
      // 2. Linked to at least one of our selected purchases
      const isLinkedToSelected = linked.some(key => selectedPurchaseKeys.has(key));
      if ((isUnsettled(s) && linked.length === 0) || isLinkedToSelected) {
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

  const { totalSelectedAmount, remainingAmount, statementDistribution, selectedGroups, purchaseDistribution } = useMemo(() => {
    // First, calculate what the paid amount WOULD BE if we only keep statements NOT selected!
    // We need to simulate:
    // 1. Reset paid to 0
    // 2. Distribute all non-selected statements that are still linked to these purchases
    // 3. Distribute the selected statements!
    const selectedPurchaseIdsList = Array.from(selectedPurchaseIds);
    const selectedPurchaseTokens = new Set(selectedPurchaseIdsList.map(id => `PP${id}`));
    
    // Split into selected and non-selected statements
    const selectedStatementsList = statements.filter(s => selectedStatementIds.has(s.id)).sort((a, b) => a.id - b.id);
    const nonSelectedStatementsList = statements.filter(s => !selectedStatementIds.has(s.id));
    
    // First, calculate which non-selected statements are STILL linked to any selected purchases!
    const nonSelectedStillLinked = nonSelectedStatementsList.filter(stmt => {
      const tokens = getLinkedKeys(stmt);
      return tokens.some(t => selectedPurchaseTokens.has(t));
    });

    // Now, simulate distribution of non-selected statements first!
    // First, get selected purchases sorted!
    const selectedPurchases = purchases.filter(p => selectedPurchaseIds.has(Number(p.id)));
    const parentId = Math.max(...selectedPurchases.map(p => p.id));
    const children = selectedPurchases.filter(p => p.id !== parentId);
    const sortedChildren = children.sort((a, b) => a.id - b.id);
    const selectedPurchasesSorted = [...sortedChildren, ...selectedPurchases.filter(p => p.id === parentId)];

    // Simulate paid_amount!
    const simulatedPaid = {};
    selectedPurchasesSorted.forEach(p => simulatedPaid[p.id] = 0);

    // Distribute non-selected still linked statements first!
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
    // Now, remainingToDistribute should be how much we need from selected statements!
    const remainingNeededFromSelected = Math.max(0, selectedNetAmount - totalSimulatedPaid);
    
    // Now, process selected statements distribution!
    const distribution = {};
    let remainingToDistribute = remainingNeededFromSelected;
    let totalSelectedAmountVal = 0;

    selectedStatementsList.forEach(s => {
      const stmtAmount = Number(s.amount || 0);
      const toApply = Math.min(stmtAmount, remainingToDistribute);
      distribution[s.id] = {
        applied: toApply,
        remaining: stmtAmount - toApply
      };
      totalSelectedAmountVal += toApply;
      remainingToDistribute -= toApply;
    });

    // Now distribute selected statements to purchases!
    const purchaseDist = {};
    let remainingToAllocateSelected = totalSelectedAmountVal;
    
    // Make a copy to modify!
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
      totalSelectedAmount: totalSelectedAmountVal,
      remainingAmount: Math.max(0, selectedNetAmount - totalSelectedAmountVal),
      statementDistribution: distribution,
      selectedGroups: groups,
      purchaseDistribution: purchaseDist
    };
  }, [statements, selectedStatementIds, selectedNetAmount, purchases, selectedPurchaseIds]);

  const handleSelectStatement = (id) => {
    const statement = statements.find((s) => s.id === id);
    if (!statement) return;

    setSelectedStatementIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
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
        const selectedPurchaseTokens = new Set(selectedPurchaseIdsList.map(pid => `PP${pid}`));
        const nonSelectedStatementsList = statements.filter(s => !newSet.has(s.id) && s.id !== id);
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
        
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/statements/purchases-bulk-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_ids: Array.from(selectedPurchaseIds),
          statement_ids: Array.from(selectedStatementIds),
          initial_linked_statement_ids: Array.from(initialLinkedStatementIds),
          remaining_amount: remainingAmount
        }),
      });

      if (response.ok) {
        toast.success("Payments updated successfully to all selected purchases!");
        if (onLinkSuccess) onLinkSuccess();
        router.refresh();
        closeModal();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update payments");
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl p-6 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Link Payment to Selected Purchases</h3>
            <div className="text-xs text-gray-500 mt-1">
              Select multiple statements (total amount must be ≤ selected total)
            </div>
            {/* Selected Purchases Details */}
            <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Selected Purchases ({selectedPurchaseIds.size})</h4>
              <div className="max-h-48 overflow-y-auto">
                <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-gray-700 mb-2 pb-1 border-b border-blue-200">
                  <div>ID</div>
                  <div>Net Amount</div>
                  <div>Payment Applied</div>
                  <div>Remaining</div>
                  <div>New Paid Amount</div>
                </div>
                {purchases.filter(p => selectedPurchaseIds.has(Number(p.id))).sort((a, b) => a.id - b.id).map((p) => {
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
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-medium mt-2">
              <div>Selected Purchase IDs: <span className="text-gray-800">{Array.from(selectedPurchaseIds).sort((a, b) => a - b).join(', ')}</span></div>
              <div>Selected Total: <span className="text-blue-700">₹{selectedNetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div>Selected Payments: <span className="text-purple-700">₹{totalSelectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div>Remaining: <span className="text-green-700">₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </div>
            {/* Show grouped totals for selected payments */}
            {Object.keys(selectedGroups).length > 0 && (
              <div className="mt-3 p-2 bg-gray-50 rounded-md">
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
                <th className="p-3 border-b font-semibold text-gray-700">Applied</th>
                <th className="p-3 border-b font-semibold text-gray-700">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading statements...</span>
                    </div>
                  </td>
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
                    <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectStatement(s.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-medium text-gray-600">#{s.id}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{s.trans_id || "—"}</td>
                      <td className="p-3 text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : "—"}</td>
                      <td className="p-3 max-w-[400px] truncate text-gray-600" title={s.description || ""}>{s.description || "—"}</td>
                      <td className="p-3 font-bold text-red-600">₹{Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 font-medium text-green-700">
                        {isSelected ? `₹${distribution?.applied?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}` : '—'}
                      </td>
                      <td className="p-3 font-medium text-orange-600">
                        {isSelected ? `₹${distribution?.remaining?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
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
            disabled={saving}
            className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? "Updating..." : "Update Payments"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiPurchaseLinkModal;
