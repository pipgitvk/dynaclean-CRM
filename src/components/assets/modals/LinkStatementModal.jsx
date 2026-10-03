"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Loader, CheckCircle, Unlink, Search } from "lucide-react";
import { toast } from "react-hot-toast";

export default function LinkStatementModal({ isOpen, onClose, asset, onLinked }) {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState(null);
  const [selectedStatementIds, setSelectedStatementIds] = useState(new Set());

  useEffect(() => {
    if (!isOpen) return;

    setStatements([]);
    setSearch("");
    setSelectedStatementIds(new Set());
    setLoading(true);

    const fetchStatements = async () => {
      try {
        const res = await fetch("/api/statements", { credentials: "include" });
        const data = await res.json();

        if (!res.ok) {
          toast.error("Failed to load statements");
          return;
        }

        const rows = Array.isArray(data?.statements) ? data.statements : [];

        // Filter statements by price range (with 10% tolerance) and unsettled status
        const assetPrice = Number(asset?.purchase_price || 0);
        const tolerance = assetPrice * 0.1;
        const minPrice = assetPrice - tolerance;
        const maxPrice = assetPrice + tolerance;

        const filtered = rows.filter(
          (s) => {
            // Check if already linked to this asset via junction table
            const isLinkedToThisAsset = s.linked_module_type === 'Assets' && 
              s.linked_asset_ids && 
              s.linked_asset_ids.split(',').map(id => id.trim()).includes(String(asset?.asset_id));
            
            // Allow if already linked to this asset
            if (isLinkedToThisAsset) {
              return true;
            }
            
            // Otherwise, only show unsettled unlinked statements in price range
            return (
              String(s.status || "").toLowerCase() !== "settled" &&
              String(s.invoice_status || "").toLowerCase() !== "settled" &&
              !s.client_expense_id &&
              !s.dd_id &&
              (!s.linked_module_type || s.linked_module_type === 'Assets') &&
              String(s.type || "").trim() === "Debit" &&
              Number(s.amount || 0) >= minPrice &&
              Number(s.amount || 0) <= maxPrice
            );
          }
        );

        setStatements(filtered);

        // Check for already linked statements
        const linked = filtered.filter((s) => {
          return s.linked_module_type === 'Assets' && 
            s.linked_asset_ids && 
            s.linked_asset_ids.split(',').map(id => id.trim()).includes(String(asset?.asset_id));
        });

        setSelectedStatementIds(new Set(linked.map((s) => s.id)));
      } catch (error) {
        console.error("Error fetching statements:", error);
        toast.error("Failed to load statements");
      } finally {
        setLoading(false);
      }
    };

    fetchStatements();
  }, [isOpen, asset]);

  // Filter statements based on search
  const filteredStatements = statements.filter((s) => {
    const query = search.toLowerCase();
    return (
      String(s.trans_id || "").toLowerCase().includes(query) ||
      String(s.remark || "").toLowerCase().includes(query) ||
      String(s.particulars || "").toLowerCase().includes(query) ||
      String(s.amount || "").includes(query)
    );
  });

  // Calculate totals
  const { totalLinked, remaining } = useMemo(() => {
    const total = Array.from(selectedStatementIds).reduce((sum, id) => {
      const stmt = statements.find((s) => s.id === id);
      return sum + Number(stmt?.amount || 0);
    }, 0);

    const assetPrice = Number(asset?.purchase_price || 0);
    return {
      totalLinked: total,
      remaining: Math.max(0, assetPrice - total),
    };
  }, [selectedStatementIds, statements, asset]);

  const linkStatement = async (stmtId, isCurrentlyLinked) => {
    try {
      setLinkingId(stmtId);
      const assetId = Number(asset?.asset_id);

      // Get the statement
      const stmt = statements.find((s) => s.id === stmtId);
      if (!stmt) throw new Error("Statement not found");

      if (isCurrentlyLinked) {
        // Remove link from junction table
        const res = await fetch(`/api/statements/${stmtId}/unlink-asset`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ assetId }),
        });

        if (!res.ok) throw new Error("Failed to unlink statement");
        
        setSelectedStatementIds((prev) => {
          const next = new Set(prev);
          next.delete(stmtId);
          return next;
        });

        toast.success("Statement unlinked from asset!");
      } else {
        // Check if total would exceed asset price
        const newTotal = totalLinked + Number(stmt.amount || 0);
        if (newTotal > Number(asset?.purchase_price || 0)) {
          toast.error(
            `Cannot link: Total (₹${newTotal.toLocaleString()}) would exceed Asset Price (₹${Number(asset?.purchase_price || 0).toLocaleString()})`
          );
          setLinkingId(null);
          return;
        }

        // Add link to junction table
        const res = await fetch(`/api/statements/${stmtId}/link-asset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ assetId }),
        });

        if (!res.ok) throw new Error("Failed to link statement");
        
        setSelectedStatementIds((prev) => new Set([...prev, stmtId]));
        toast.success("Statement linked to asset!");
      }

      // Call parent callback to refresh data
      onLinked?.();
    } catch (error) {
      console.error("Error updating statement:", error);
      toast.error(error.message || "Failed to update statement");
    } finally {
      setLinkingId(null);
    }
  };

  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header with Stats */}
        <div className="flex justify-between items-start p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Link Statements to Asset
            </h2>
            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <p>Asset #{asset?.asset_id} • Multiple selection enabled</p>
              <p>
                <span className="text-gray-600">Asset Price:</span>{" "}
                <span className="font-bold text-blue-700">
                  ₹{Number(asset?.purchase_price || 0).toLocaleString()}
                </span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-gray-600">Total Linked:</span>{" "}
                <span
                  className={`font-bold ${
                    totalLinked > Number(asset?.purchase_price || 0)
                      ? "text-red-600"
                      : "text-emerald-700"
                  }`}
                >
                  ₹{totalLinked.toLocaleString()}
                </span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-gray-600">Remaining:</span>{" "}
                <span className="font-bold text-gray-800">
                  ₹{remaining.toLocaleString()}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
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
          <div className="text-sm text-gray-600 font-medium whitespace-nowrap">
            {loading ? "Loading..." : `${filteredStatements.length} statement(s)`}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader size={32} className="animate-spin text-blue-600 mb-2" />
              <p className="text-gray-500">Loading statements...</p>
            </div>
          ) : filteredStatements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-lg">
                {search
                  ? "No matching statements found"
                  : "No unsettled statements available in this price range"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700">ID</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Trans ID</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Particulars</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Remark</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Amount</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStatements.map((stmt) => {
                    const isLinked = selectedStatementIds.has(stmt.id);
                    const isProcessing = linkingId === stmt.id;

                    return (
                      <tr
                        key={stmt.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          isLinked ? "bg-emerald-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-600">
                          #{stmt.id}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {stmt.trans_id || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {stmt.date
                            ? new Date(stmt.date).toLocaleDateString("en-IN")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                          {stmt.particulars || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-sm max-w-xs truncate">
                          {stmt.remark || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">
                          ₹{Number(stmt.amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => linkStatement(stmt.id, isLinked)}
                            disabled={isProcessing}
                            className={`inline-flex items-center gap-1 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                              isProcessing
                                ? "bg-gray-200 text-gray-500 cursor-wait"
                                : isLinked
                                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                            }`}
                          >
                            {isProcessing ? (
                              <>
                                <Loader size={14} className="animate-spin" />
                                Processing...
                              </>
                            ) : isLinked ? (
                              <>
                                <Unlink size={14} />
                                Deselect
                              </>
                            ) : (
                              <>
                                <CheckCircle size={14} />
                                Select
                              </>
                            )}
                          </button>
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
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <p className="text-sm text-gray-600 font-medium">
            {selectedStatementIds.size > 0
              ? `Selected: ${selectedStatementIds.size} statement(s)`
              : "No statements selected"}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-semibold shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
