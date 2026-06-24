"use client";

import { useState, useEffect } from "react";
import { X, Loader, CheckCircle, Link as LinkIcon } from "lucide-react";
import { toast } from "react-hot-toast";

export default function UnsettledStatementsModal({ isOpen, onClose }) {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [linkedStatement, setLinkedStatement] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    setStatements([]);
    setSearch("");
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

        // Filter only unsettled statements (where status !== 'Settled')
        const unsettled = rows.filter(
          (s) =>
            String(s.status || "").toLowerCase() !== "settled" &&
            String(s.type || "").trim() === "Debit"
        );

        setStatements(unsettled);
      } catch (error) {
        console.error("Error fetching statements:", error);
        toast.error("Failed to load statements");
      } finally {
        setLoading(false);
      }
    };

    fetchStatements();
  }, [isOpen]);

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

  const markAsSettled = async (statementId) => {
    try {
      setUpdatingId(statementId);
      const res = await fetch(`/api/statements/${statementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "Settled" }),
      });

      if (!res.ok) {
        throw new Error("Failed to update statement");
      }

      // Update local state
      setStatements((prev) =>
        prev.map((s) =>
          s.id === statementId ? { ...s, status: "Settled" } : s
        )
      );

      toast.success("Statement marked as settled!");
    } catch (error) {
      console.error("Error updating statement:", error);
      toast.error(error.message || "Failed to update statement");
    } finally {
      setUpdatingId(null);
    }
  };

  const linkStatement = (stmt) => {
    setLinkedStatement({
      id: stmt.id,
      amount: stmt.amount,
      trans_id: stmt.trans_id,
      particulars: stmt.particulars,
    });
    toast.success("Statement linked!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            Unsettled Statements
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Linked Statement Info */}
        {linkedStatement && (
          <div className="px-6 py-4 bg-green-50 border-b-2 border-green-300 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Linked Statement:</p>
              <p className="text-lg font-bold text-green-700">
                ID: {linkedStatement.id} | Amount: ₹{Number(linkedStatement.amount || 0).toLocaleString("en-IN")}
              </p>
              <p className="text-sm text-gray-600 mt-1">{linkedStatement.particulars}</p>
            </div>
            <button
              onClick={() => setLinkedStatement(null)}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition"
            >
              Clear
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <input
            type="text"
            placeholder="Search by Transaction ID, Remark, Particulars or Amount..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
                  ? "No matching unsettled statements found"
                  : "No unsettled statements available"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                      Trans ID
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                      Particulars
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                      Remark
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStatements.map((stmt) => (
                    <tr
                      key={stmt.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                        {stmt.trans_id || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {stmt.date
                          ? new Date(stmt.date).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {stmt.particulars || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {stmt.remark || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                        ₹{Number(stmt.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                          {stmt.status || "Unsettled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => linkStatement(stmt)}
                            disabled={updatingId === stmt.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 transition font-semibold"
                          >
                            <LinkIcon size={14} />
                            Link
                          </button>
                          <button
                            onClick={() => markAsSettled(stmt.id)}
                            disabled={updatingId === stmt.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400 transition font-semibold"
                          >
                            {updatingId === stmt.id ? (
                              <>
                                <Loader size={14} className="animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={14} />
                                Settled
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {filteredStatements.length} of {statements.length} statements
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
