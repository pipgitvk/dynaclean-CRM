"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

const MultiInvoiceLinkModal = ({ isOpen, closeModal, selectedInvoiceIds, selectedGrandTotal, invoices, onLinkSuccess }) => {
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
      if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
        keys.push(s);
      } else if (/^\d+$/.test(s)) {
        keys.push(`IP${s}`);
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
    // Initialize selected statements with those already linked to our selected invoices
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
        
        // Auto-select statements already linked to selected invoices
        const selectedInvoiceKeys = new Set(Array.from(selectedInvoiceIds).map(id => `IP${id}`));
        rows.forEach(stmt => {
          const linkedKeys = getLinkedKeys(stmt);
          const isLinkedToSelected = linkedKeys.some(key => selectedInvoiceKeys.has(key));
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
  }, [isOpen, selectedInvoiceIds]);

  const eligibleStatements = useMemo(() => {
    const q = search.trim().toLowerCase();
    const isUnsettled = (s) =>
      (String(s.invoice_status || "").trim() === "Unsettled") ||
      (!s.invoice_status && !s.client_expense_id);
    const isCredit = (s) => String(s.type || "").trim() === "Credit";

    // Get invoice keys for selected invoices (IP{id})
    const selectedInvoiceKeys = new Set(Array.from(selectedInvoiceIds).map(id => `IP${id}`));

    let rows = statements.filter((s) => {
      const isCredit = (s) => String(s.type || "").trim() === "Credit";
      
      // ALWAYS show selected statements
      if (selectedStatementIds.has(s.id)) return true;
      
      // Show ONLY Credit type statements that are unsettled
      if (!isCredit(s)) return false;
      if (!isUnsettled(s)) return false;
      
      const linked = getLinkedKeys(s);
      // Check if statement is either:
      // 1. Unsettled and not linked to any invoice
      // 2. Linked to at least one of our selected invoices
      const isLinkedToSelected = linked.some(key => selectedInvoiceKeys.has(key));
      
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

    // Sort: selected statements first
    rows.sort((a, b) => {
      const aSelected = selectedStatementIds.has(a.id) ? 0 : 1;
      const bSelected = selectedStatementIds.has(b.id) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return a.id - b.id;
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
  }, [statements, search, stmtStartDate, stmtEndDate, selectedStatementIds, selectedInvoiceIds]);

  const { totalSelectedAmount, statementDistribution, selectedGroups, remainingAmount } = useMemo(() => {
    const selectedStatementsList = statements.filter(s => selectedStatementIds.has(s.id)).sort((a, b) => a.id - b.id);

    // Now, process selected statements distribution!
    const distribution = {};
    let totalSelectedAmountVal = 0;

    selectedStatementsList.forEach(s => {
      const stmtAmount = Number(s.amount || 0);
      distribution[s.id] = {
        applied: stmtAmount,
        remaining: 0
      };
      totalSelectedAmountVal += stmtAmount;
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

    const remaining = Math.max(0, selectedGrandTotal - totalSelectedAmountVal);

    return {
      totalSelectedAmount: totalSelectedAmountVal,
      statementDistribution: distribution,
      selectedGroups: groups,
      remainingAmount: remaining
    };
  }, [statements, selectedStatementIds, selectedGrandTotal]);

  const handleSelectStatement = (id) => {
    const statement = statements.find((s) => s.id === id);
    if (!statement) return;

    setSelectedStatementIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        // Calculate current total
        let currentTotal = 0;
        prev.forEach(sid => {
          const s = statements.find(ss => ss.id === sid);
          if (s) currentTotal += Number(s.amount || 0);
        });
        
        const statementAmount = Number(statement.amount || 0);
        const newTotal = currentTotal + statementAmount;
        
        // Check if exceeds grand total
        if (newTotal > selectedGrandTotal) {
          toast.error(`Cannot select this statement! Total would be ₹${newTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} which exceeds balance amount of ₹${selectedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
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
      const response = await fetch(`/api/statements/invoices-bulk-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_ids: Array.from(selectedInvoiceIds),
          statement_ids: Array.from(selectedStatementIds),
          initial_linked_statement_ids: Array.from(initialLinkedStatementIds)
        }),
      });

      if (response.ok) {
        toast.success("Payments updated successfully to all selected invoices!");
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
            <h3 className="text-lg font-semibold">Link Payment to Selected Invoices</h3>
            <div className="text-xs text-gray-500 mt-1">
              Select multiple statements (total amount must be ≤ selected balance amount)
            </div>
            {/* Invoice Summary - Prominent Display */}
            <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-md border-2 border-blue-300">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <span className="text-gray-600 block text-xs font-semibold">Balance Amount</span>
                  <span className="text-xl font-bold text-blue-700">₹{selectedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-600 block text-xs font-semibold">Payments Selected</span>
                  <span className="text-xl font-bold text-purple-700">₹{totalSelectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-center border-l-2 border-r-2 border-gray-300">
                  <span className="text-gray-600 block text-xs font-semibold">Remaining to Select</span>
                  <span className={`text-xl font-bold ${remainingAmount > 0 ? 'text-green-700' : 'text-red-600'}`}>₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-600 block text-xs font-semibold">Selected Invoices</span>
                  <span className="text-xl font-bold text-indigo-700">{selectedInvoiceIds.size}</span>
                </div>
              </div>
            </div>
            {/* Selected Invoices Details */}
            <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Selected Invoices ({selectedInvoiceIds.size})</h4>
              <div className="max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {invoices.filter(p => selectedInvoiceIds.has(Number(p.id))).sort((a, b) => a.id - b.id).map((p) => (
                    <div key={p.id} className="text-gray-700 font-medium">
                      Invoice #{p.id} • ₹{Number(p.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  ))}
                </div>
              </div>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading statements...</span>
                    </div>
                  </td>
                </tr>
              ) : eligibleStatements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-500">No matching unsettled statements found</td>
                </tr>
              ) : (
                eligibleStatements.map((s) => {
                  const isSelected = selectedStatementIds.has(s.id);
                  const distribution = statementDistribution[s.id];
                  const linkedKeys = getLinkedKeys(s);
                  
                  // Build reference display
                  const referenceDisplay = (() => {
                    const refs = [];
                    
                    // Add linked purchase IDs
                    linkedKeys.forEach(key => {
                      refs.push(key);
                    });
                    
                    // Add invoice number if exists
                    if (s.invoice_number) {
                      refs.push(`INV${s.invoice_number}`);
                    }
                    
                    // Add DD ID if exists
                    if (s.dd_id) {
                      refs.push(`DD${s.dd_id}`);
                    }
                    
                    // Add expense ID if exists
                    if (s.client_expense_id) {
                      refs.push(`EXP${s.client_expense_id}`);
                    }
                    
                    return refs.length > 0 ? refs.join(', ') : '—';
                  })();
                  
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

export default MultiInvoiceLinkModal;
