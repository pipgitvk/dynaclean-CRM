"use client";

import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";

export default function StatementSearchView() {
  const [expenseId, setExpenseId] = useState("");
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [statements, setStatements] = useState([]);

  const handleSearch = async (e) => {
    e?.preventDefault();
    const id = expenseId.trim();
    if (!id) {
      setError("Please enter an expense ID");
      setExpense(null);
      setStatements([]);
      return;
    }
    setLoading(true);
    setError("");
    setExpense(null);
    setStatements([]);
    try {
      const [expenseRes, statementsRes] = await Promise.all([
        fetch(`/api/client-expenses/${id}`),
        fetch(`/api/statements?expense_id=${id}`),
      ]);
      const expenseData = await expenseRes.json();
      if (!expenseRes.ok) {
        setError(expenseData.error || "Expense not found");
        return;
      }
      setExpense(expenseData);
      const stmtData = await statementsRes.json();
      setStatements(stmtData.statements || []);
    } catch (err) {
      setError("Failed to fetch expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2 w-full sm:max-w-md">
          <input
            type="text"
            placeholder="Search by Expense ID..."
            value={expenseId}
            onChange={(e) => {
              setExpenseId(e.target.value);
              setError("");
            }}
            className="flex-1 px-4 py-2 border rounded-lg"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {expense && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <h2 className="text-xl font-bold text-gray-800 p-4 border-b bg-gray-50">
            Expense Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 text-sm sm:text-base">
            <div className="space-y-2">
              <p><span className="font-medium">ID:</span> {expense.id}</p>
              <p><span className="font-medium">Expense Name:</span> {expense.expense_name}</p>
              <p><span className="font-medium">Client Name:</span> {expense.client_name}</p>
              <p><span className="font-medium">Group Name:</span> {expense.group_name || "-"}</p>
              <p><span className="font-medium">Main Head:</span>{" "}
                <span className={expense.main_head === "Direct" ? "text-blue-600" : "text-amber-600"}>
                  {expense.main_head}
                </span>
              </p>
              <p><span className="font-medium">Head:</span> {expense.head || "-"}</p>
              <p><span className="font-medium">Supply:</span> {expense.supply || "-"}</p>
              {expense.sub_heads && expense.sub_heads.length > 0 && (
                <p><span className="font-medium">Sub-heads:</span> {expense.sub_heads.join(", ")}</p>
              )}
            </div>
            <div className="space-y-2">
              <p><span className="font-medium">Type of Ledger:</span> {expense.type_of_ledger || "-"}</p>
              <p><span className="font-medium">HSN:</span> {expense.hsn || "-"}</p>
              <p><span className="font-medium">Amount:</span> {expense.amount != null ? `₹${Number(expense.amount).toFixed(2)}` : "-"}</p>
              <p><span className="font-medium">Created:</span> {expense.created_at ? dayjs(expense.created_at).format("DD MMM YYYY HH:mm") : "-"}</p>
            </div>
          </div>
          <div className="p-4 border-t bg-gray-50 flex flex-wrap gap-3">
            <Link
              href={`/admin-dashboard/client-expenses/${expense.id}?from=statements`}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm"
            >
              View Full Details
            </Link>
            {statements.length > 0 ? (
              statements.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin-dashboard/statements/${s.id}`}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 text-center text-sm"
                >
                  View Statement{statements.length > 1 ? ` #${s.id}` : ""}
                </Link>
              ))
            ) : (
              <Link
                href={`/admin-dashboard/statements/add?expense_id=${expense.id}&amount=${expense.amount ?? ""}`}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-center text-sm"
              >
                Statement
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
