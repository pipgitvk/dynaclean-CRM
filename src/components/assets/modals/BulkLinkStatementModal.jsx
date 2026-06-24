"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Search, X, Loader } from "lucide-react";
import { toast } from "react-hot-toast";

export default function BulkLinkStatementModal({
  isOpen,
  onClose,
  selectedAssets,
  selectedAssetIds,
  totalSelectedPrice,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStatementIds, setSelectedStatementIds] = useState(new Set());
  const [initialLinkedStatementIds, setInitialLinkedStatementIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setStatements([]);
    setSearch("");
    setSelectedStatementIds(new Set());
    setInitialLinkedStatementIds(new Set());
    setLoading(true);

    let cancelled = false;

    fetch("/api/statements", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.statements) ? data.statements : [];
        setStatements(rows);

        // Auto-select statements already linked to selected assets
        const initialSelected = new Set();
        const initialLinked = new Set();
        
        selectedAssets.forEach((asset) => {
          rows.forEach((stmt) => {
            const linkedAssetIds = stmt.linked_asset_ids 
              ? String(stmt.linked_asset_ids).split(',').map(id => id.trim()).filter(Boolean)
              : [];
            
            if (linkedAssetIds.includes(String(asset.asset_id))) {
              initialSelected.add(stmt.id);
              initialLinked.add(stmt.id);
            }
          });
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
  }, [isOpen, selectedAssets]);

  // Filter statements based on search
  const eligibleStatements = useMemo(() => {
    const q = search.trim().toLowerCase();

    const isUnsettled = (s) =>
      String(s.status || "").toLowerCase() !== "settled" &&
      String(s.invoice_status || "").toLowerCase() !== "settled";
    const isDebit = (s) => String(s.type || "").trim() === "Debit";

    let rows = statements.filter((s) => {
      if (!isDebit(s)) return false;
      
      // Check if linked to selected assets via junction table
      const linkedAssetIds = s.linked_asset_ids 
        ? String(s.linked_asset_ids).split(',').map(id => id.trim()).filter(Boolean)
        : [];
      
      const linkedToSelectedAsset = selectedAssets.some(
        (asset) => linkedAssetIds.includes(String(asset.asset_id))
      );

      // Check if unlinked and unsettled
      const isUnlinked = linkedAssetIds.length === 0;
      
      // Show if: (unsettled and unlinked) OR (linked to selected asset)
      return (isUnlinked && isUnsettled(s)) || linkedToSelectedAsset;
    });

    if (q) {
      rows = rows.filter((s) => {
        const id = String(s.id ?? "").toLowerCase();
        const transId = String(s.trans_id ?? "").toLowerCase();
        const particulars = String(s.particulars ?? "").toLowerCase();
        const amount = String(s.amount ?? "").toLowerCase();
        return id.includes(q) || transId.includes(q) || particulars.includes(q) || amount.includes(q);
      });
    }

    return rows;
  }, [statements, search, selectedAssets]);

  // Calculate totals and distribution
  const { totalSelectedAmount, remainingAmount, assetDistribution, selectedGroups } = useMemo(() => {
    const selectedStatementsList = statements
      .filter((s) => selectedStatementIds.has(s.id))
      .sort((a, b) => a.id - b.id);

    const sortedAssets = selectedAssets.sort((a, b) => Number(a.asset_id) - Number(b.asset_id));

    // Calculate total payment available from selected statements
    let totalPayment = 0;
    selectedStatementsList.forEach((s) => {
      totalPayment += Number(s.amount || 0);
    });

    // Calculate total asset price
    let totalAssetPrice = 0;
    sortedAssets.forEach((asset) => {
      totalAssetPrice += Number(asset.purchase_price || 0);
    });

    // Remaining is total asset price minus selected payments
    const remaining = Math.max(0, totalAssetPrice - totalPayment);

    // Distribute to assets (for display purposes)
    const distribution = {};
    let remainingToDistribute = totalPayment;

    sortedAssets.forEach((asset) => {
      const assetPrice = Number(asset.purchase_price || 0);
      const applied = Math.min(assetPrice, remainingToDistribute);
      distribution[asset.asset_id] = {
        price: assetPrice,
        applied: applied,
        remaining: Math.max(0, assetPrice - applied),
      };
      remainingToDistribute -= applied;
    });

    // Group selected statements by trans_id
    const groups = {};
    selectedStatementsList.forEach((s) => {
      const key = s.trans_id || `_id_${s.id}`;
      if (!groups[key]) {
        groups[key] = {
          trans_id: s.trans_id,
          totalAmount: 0,
        };
      }
      groups[key].totalAmount += Number(s.amount || 0);
    });

    return {
      totalSelectedAmount: totalPayment,
      remainingAmount: remaining,
      assetDistribution: distribution,
      selectedGroups: groups,
    };
  }, [statements, selectedStatementIds, selectedAssets]);

  const handleToggle = (stmtId) => {
    const statement = statements.find((s) => s.id === stmtId);
    if (!statement) return;

    setSelectedStatementIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stmtId)) {
        newSet.delete(stmtId);
      } else {
        // Check if adding this would exceed total price
        const testSet = new Set(prev);
        testSet.add(stmtId);

        // Calculate new total
        let newTotal = 0;
        statements.forEach((s) => {
          if (testSet.has(s.id)) {
            newTotal += Number(s.amount || 0);
          }
        });

        if (newTotal > totalSelectedPrice) {
          toast.error(
            `Cannot select this statement! Total would be ₹${newTotal.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })} which exceeds ₹${totalSelectedPrice.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}`
          );
          return prev;
        }

        newSet.add(stmtId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (selectedStatementIds.size === 0) {
      toast.error("Please select at least one statement to link");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/assets/bulk-link-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          statementIds: Array.from(selectedStatementIds),
          assetIds: Array.from(selectedAssetIds),
          initialLinkedStatementIds: Array.from(initialLinkedStatementIds),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to link statements");

      toast.success("Statements linked successfully!");
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">
              Link Payment to Selected Assets
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Select multiple statements (total amount must be ≤ selected total)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Selected Assets Summary */}
        <div className="p-6 bg-blue-50 border-b border-blue-200">
          <h4 className="font-semibold text-sm text-gray-700 mb-3">
            Selected Assets ({selectedAssets.length})
          </h4>
          <div className="max-h-48 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-700 mb-2 pb-2 border-b border-blue-200">
              <div>Asset ID</div>
              <div>Asset Name</div>
              <div>Price</div>
              <div>Remaining</div>
            </div>
            {selectedAssets
              .sort((a, b) => Number(a.asset_id) - Number(b.asset_id))
              .map((asset) => {
                const dist = assetDistribution[asset.asset_id];
                return (
                  <div key={asset.asset_id} className="grid grid-cols-4 gap-2 text-sm mb-1">
                    <div className="text-gray-700 font-medium">#{asset.asset_id}</div>
                    <div className="text-gray-700 truncate">{asset.asset_name}</div>
                    <div className="text-gray-800">
                      ₹
                      {Number(asset.purchase_price).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-orange-700 font-medium">
                      {dist
                        ? `₹${dist.remaining.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}`
                        : "—"}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="mt-3 pt-3 border-t border-blue-300 flex flex-wrap gap-4 justify-between">
            <div>
              <span className="font-semibold text-gray-800">Total Assets:</span>
              <span className="font-bold text-blue-700 ml-2">{selectedAssets.length}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-800">Total Price:</span>
              <span className="font-bold text-blue-700 ml-2">
                ₹{totalSelectedPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-800">Selected Payments:</span>
              <span className="font-bold text-purple-700 ml-2">
                ₹{totalSelectedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-800">Remaining:</span>
              <span className="font-bold text-green-700 ml-2">
                ₹{remainingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {Object.keys(selectedGroups).length > 0 && (
            <div className="mt-3 p-3 bg-white rounded border border-blue-300">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Payment Details:</h4>
              {Object.values(selectedGroups).map((group, index) => (
                <div key={index} className="text-xs flex items-center gap-3 mb-1">
                  <span className="text-gray-600">
                    {group.trans_id ? `Trans ID: ${group.trans_id}` : `Statement ${index + 1}`}
                  </span>
                  <span className="text-red-600">
                    Amount: ₹
                    {group.totalAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search statement..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-xs text-gray-600 font-medium whitespace-nowrap">
            {loading ? "Loading..." : `${eligibleStatements.length} statement(s)`}
          </div>
        </div>

        {/* Statements Table */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader size={32} className="animate-spin text-blue-600 mb-2" />
              <p className="text-gray-500">Loading statements...</p>
            </div>
          ) : eligibleStatements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-lg">
                {search
                  ? "No matching statements found"
                  : "No unsettled statements available"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left border-b sticky top-0">
                  <tr>
                    <th className="p-3 font-semibold text-gray-700">Select</th>
                    <th className="p-3 font-semibold text-gray-700">ID</th>
                    <th className="p-3 font-semibold text-gray-700">Trans ID</th>
                    <th className="p-3 font-semibold text-gray-700">Date</th>
                    <th className="p-3 font-semibold text-gray-700">Particulars</th>
                    <th className="p-3 font-semibold text-gray-700 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {eligibleStatements.map((s) => {
                    const isSelected = selectedStatementIds.has(s.id);
                    const isAlreadyLinked = initialLinkedStatementIds.has(s.id);
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          isSelected ? "bg-emerald-50" : ""
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggle(s.id)}
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-medium text-gray-600">#{s.id}</td>
                        <td className="p-3 font-mono text-xs text-gray-500">
                          {s.trans_id || "—"}
                        </td>
                        <td className="p-3 text-gray-700 whitespace-nowrap">
                          {s.date ? new Date(s.date).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="p-3 text-gray-700 truncate max-w-xs">
                          {s.particulars || "—"}
                        </td>
                        <td className="p-3 text-right font-bold text-red-600">
                          ₹{Number(s.amount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center flex-shrink-0">
          <p className="text-sm text-gray-600 font-medium">
            {selectedStatementIds.size > 0
              ? `Selected: ${selectedStatementIds.size} statement(s)`
              : "No statements selected"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedStatementIds.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedStatementIds.size === 0 ? "Please select at least one statement" : ""}
            >
              {saving ? "Linking..." : "Link Statements"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
