"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

const StatementLinkModal = ({ isOpen, closeModal, row, onLinkSuccess }) => {
  const [statements, setStatements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      fetchStatements();
      if (row?.linked_statement_ids) {
        try {
          // If it's a string, parse it. If it's already an array (unlikely from DB but safe), use it.
          const ids = typeof row.linked_statement_ids === "string" 
            ? JSON.parse(row.linked_statement_ids || "[]")
            : (row.linked_statement_ids || []);
          setSelectedIds(ids);
        } catch (e) {
          console.error("Error parsing linked_statement_ids:", e);
          setSelectedIds([]);
        }
      } else {
        setSelectedIds([]);
      }
    }
  }, [isOpen, row]);

  const fetchStatements = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/statements?status=unsettled&current_expense_id=${row.ID}`);
      const data = await response.json();
      if (data.statements) {
        setStatements(data.statements);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Failed to fetch statements");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id) => {
    const statement = statements.find((s) => s.id === id);
    if (!statement) return;

    const isSelected = selectedIds.includes(id);
    const amount = Number(statement.amount || 0);

    const expenseTotal =
      Number(row.TicketCost || 0) +
      Number(row.HotelCost || 0) +
      Number(row.MealsCost || 0) +
      Number(row.OtherExpenses || 0);

    if (!isSelected) {
      // Adding a statement - check total
      const currentSelectedTotal = statements
        .filter((s) => selectedIds.includes(s.id))
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);

      if (currentSelectedTotal + amount > expenseTotal + 0.01) { // 0.01 for floating point buffer
        toast.error(`Total selected amount (₹${(currentSelectedTotal + amount).toFixed(2)}) cannot exceed expense total (₹${expenseTotal.toFixed(2)})`);
        return;
      }
    }

    setSelectedIds((prev) =>
      isSelected ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/expenses/${row.ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linked_statement_ids: selectedIds }),
      });

      if (response.ok) {
        toast.success("Statements linked successfully!");
        if (onLinkSuccess) onLinkSuccess();
        router.refresh();
        closeModal();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to link statements");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("An error occurred while saving");
    }
  };

  if (!isOpen) return null;

  const filteredStatements = statements.filter((s) =>
    (s.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.trans_id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const expenseTotal =
    Number(row.TicketCost || 0) +
    Number(row.HotelCost || 0) +
    Number(row.MealsCost || 0) +
    Number(row.OtherExpenses || 0);

  const selectedTotal = statements
    .filter((s) => selectedIds.includes(s.id))
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Link Statements to Expense #{row?.ID}</h2>
            <p className="text-sm text-gray-500">Expense Total: <span className="font-bold text-gray-700">₹{expenseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></p>
          </div>
          <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by description or trans ID..."
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto border border-gray-200 rounded-md mb-4">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Loading statements...
            </div>
          ) : filteredStatements.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No unsettled statements found.</div>
          ) : (
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-3 text-left font-semibold text-gray-600">Date</th>
                  <th className="p-3 text-left font-semibold text-gray-600">Description</th>
                  <th className="p-3 text-right font-semibold text-gray-600">Amount</th>
                  <th className="p-3 text-center font-semibold text-gray-600 w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredStatements.map((s) => (
                  <tr key={s.id} className={`hover:bg-blue-50 transition-colors ${selectedIds.includes(s.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-3 whitespace-nowrap text-gray-700">
                      {dayjs(s.date).format("DD MMM YYYY")}
                    </td>
                    <td className="p-3 text-gray-700">
                      <div className="font-medium">{s.description}</div>
                      <div className="text-xs text-gray-400 font-mono">{s.trans_id}</div>
                    </td>
                    <td className="p-3 text-right font-semibold text-gray-900">
                      ₹{Number(s.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggle(s.id)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          selectedIds.includes(s.id)
                            ? "bg-red-100 text-red-600 hover:bg-red-200"
                            : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                        }`}
                      >
                        {selectedIds.includes(s.id) ? "Deselect" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-between items-center border-t border-gray-200 pt-4">
          <div className="flex flex-col">
            <div className="text-sm text-gray-600 font-medium">
              {selectedIds.length} statement(s) selected
            </div>
            <div className={`text-xs font-semibold ${selectedTotal > expenseTotal ? 'text-red-600' : 'text-blue-600'}`}>
              Selected Total: ₹{selectedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              onClick={handleSave}
              disabled={loading}
            >
              Save Links
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatementLinkModal;
