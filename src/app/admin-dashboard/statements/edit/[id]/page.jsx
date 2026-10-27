"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import StatementExpensePicker from "../../StatementExpensePicker";

export default function EditStatementPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statementType, setStatementType] = useState("");
  const [isTypeLocked, setIsTypeLocked] = useState(false);
  const [form, setForm] = useState({
    trans_id: "",
    date: "",
    txn_dated_deb: "",
    txn_posted_date: "",
    cheq_no: "",
    description: "",
    type: "Credit",
    amount: "",
    client_expense_id: "",
    invoice_status: "",
  });
  const [expenses, setExpenses] = useState([]);
  const [expenseAllocation, setExpenseAllocation] = useState(null);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [selectedDebit, setSelectedDebit] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/statements/${id}`);
        const row = await res.json();
        if (!res.ok) {
          if (!cancelled) {
            setError("Statement not found");
            setLoading(false);
          }
          return;
        }

        const linked =
          row.client_expense_id != null && Number(row.client_expense_id) >= 1
            ? Number(row.client_expense_id)
            : null;

        const rRoot = await fetch("/api/client-expenses?root_only=1", {
          credentials: "include",
        });
        const rootData = await rRoot.json();
        let list = rootData?.clientExpenses || [];

        if (
          linked &&
          !list.some((e) => Number(e.id) === linked)
        ) {
          const rOne = await fetch(`/api/client-expenses/${linked}`, {
            credentials: "include",
          });
          const one = await rOne.json();
          if (one?.id && !one.error) {
            const { sub_heads, ...rest } = one;
            list = [
              ...list,
              {
                ...rest,
                sub_heads_joined: Array.isArray(sub_heads)
                  ? sub_heads.map((s) => String(s || "").trim()).filter(Boolean).join(", ")
                  : "",
              },
            ];
          }
        }

        list.sort((a, b) => Number(b.id) - Number(a.id));

        if (cancelled) return;
        setExpenses(list);
        let pa = null;
        try {
          const raw = row.expense_allocation;
          if (raw) {
            pa = typeof raw === "string" ? JSON.parse(raw) : raw;
          }
        } catch {
          pa = null;
        }
        setExpenseAllocation(pa);
        
        // Check if statement is already marked as Failed or Cancelled — lock the type
        let initialType = "";
        if (row.failed_transaction_id != null && String(row.failed_transaction_id).trim() !== "" && String(row.failed_transaction_id) !== "0") {
          initialType = "failed_transaction";
        } else if (row.cancelled_transaction_id != null && String(row.cancelled_transaction_id).trim() !== "" && String(row.cancelled_transaction_id) !== "0") {
          initialType = "cancelled_transaction";
        }
        setStatementType(initialType);
        setIsTypeLocked(initialType === "failed_transaction" || initialType === "cancelled_transaction");
        
        setForm({
          trans_id: row.trans_id || "",
          date: row.date ? dayjs(row.date).format("YYYY-MM-DD") : "",
          txn_dated_deb:
            row.txn_dated_deb && row.txn_dated_deb !== "0000-00-00"
              ? dayjs(row.txn_dated_deb).format("YYYY-MM-DD")
              : "",
          txn_posted_date:
            row.txn_posted_date && row.txn_posted_date !== "0000-00-00"
              ? dayjs(row.txn_posted_date).format("YYYY-MM-DD")
              : "",
          cheq_no: row.cheq_no || "",
          description: row.description || "",
          type: row.type || "Credit",
          amount: row.amount ?? "",
          client_expense_id: linked ? String(linked) : "",
          invoice_status: row.invoice_status || "",
        });
      } catch (e) {
        if (!cancelled) setError("Failed to load statement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/statements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trans_id: form.trans_id,
          date: form.date,
          txn_dated_deb: form.txn_dated_deb || null,
          txn_posted_date: form.txn_posted_date || null,
          cheq_no: form.cheq_no || null,
          description: form.description || null,
          type: form.type,
          amount: form.amount,
          client_expense_id: form.client_expense_id ? Number(form.client_expense_id) : null,
          expense_allocation: expenseAllocation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast.success("Statement updated successfully!");
      router.refresh();
      router.push("/admin-dashboard/statements");
    } catch (e) {
      setError(e.message || "Failed to save");
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const reloadLockState = async () => {
    try {
      const res = await fetch(`/api/statements/${id}`);
      const row = await res.json();
      if (!res.ok) return;
      const isFailed = row.failed_transaction_id != null && String(row.failed_transaction_id).trim() !== "" && String(row.failed_transaction_id) !== "0";
      const isCancelled = row.cancelled_transaction_id != null && String(row.cancelled_transaction_id).trim() !== "" && String(row.cancelled_transaction_id) !== "0";
      setIsTypeLocked(isFailed || isCancelled);
      if (!isFailed && !isCancelled) {
        setStatementType("");
      }
    } catch (_) {}
  };

  // Re-check lock state whenever refreshTrigger changes (e.g. after unselect)
  useEffect(() => {
    if (refreshTrigger === 0) return; // skip initial mount
    reloadLockState();
  }, [refreshTrigger]);

  const handleSaveBothSelections = async () => {
    if (!selectedCredit || !selectedDebit) {
      toast.error("Please select both Credit and Debit transactions");
      return;
    }

    // Check if amounts match
    const creditAmount = parseFloat(selectedCredit.amount).toFixed(2);
    const debitAmount = parseFloat(selectedDebit.amount).toFixed(2);
    
    if (creditAmount !== debitAmount) {
      toast.error(`Amount mismatch: Credit (₹${creditAmount}) != Debit (₹${debitAmount})`);
      return;
    }

    console.log("Saving selections:", {
      creditId: selectedCredit.id,
      creditAmount: selectedCredit.amount,
      debitId: selectedDebit.id,
      debitAmount: selectedDebit.amount,
      currentId: id,
      statementType
    });

    setSaving(true);
    try {
      const columnName = statementType === "failed_transaction" ? "failed_transaction_id" : "cancelled_transaction_id";
      const currentId = Number(id);
      
      // 1. Credit transaction gets Debit's ID (cross-link)
      const creditPayload = {
        trans_ids: [selectedCredit.id],
        [columnName]: selectedDebit.id
      };
      console.log("Credit payload:", creditPayload);

      const creditRes = await fetch(`/api/statements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creditPayload),
        credentials: "include"
      });

      const creditData = await creditRes.json();
      console.log("Credit response:", creditData);
      if (!creditRes.ok) throw new Error(creditData.error || "Failed to save credit transaction");

      // 2. Debit transaction gets Credit's ID (cross-link)
      const debitPayload = {
        trans_ids: [selectedDebit.id],
        [columnName]: selectedCredit.id
      };
      console.log("Debit payload:", debitPayload);

      const debitRes = await fetch(`/api/statements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(debitPayload),
        credentials: "include"
      });

      const debitData = await debitRes.json();
      console.log("Debit response:", debitData);
      if (!debitRes.ok) throw new Error(debitData.error || "Failed to save debit transaction");

      // 3. Mark current statement itself as failed/cancelled (self-link)
      const currentStatusPayload = {
        trans_ids: [currentId],
        [columnName]: currentId
      };
      console.log("Current statement status payload:", currentStatusPayload);

      const currentRes = await fetch(`/api/statements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentStatusPayload),
        credentials: "include"
      });

      const currentData = await currentRes.json();
      console.log("Current status response:", currentData);
      if (!currentRes.ok) throw new Error(currentData.error || "Failed to update current statement status");

      toast.success("Transactions saved successfully! Statement marked as " + (statementType === "failed_transaction" ? "Failed" : "Cancelled"));
      setSelectedCredit(null);
      setSelectedDebit(null);
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => router.refresh(), 500);
    } catch (err) {
      toast.error(err.message || "Error saving transactions");
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error && !form.trans_id) return <div className="p-6 text-red-600">{error}</div>;

  const isSettled =
    String(form.invoice_status || "").trim().toLowerCase() === "settled";
  const isLinkedToDD = ["Linked to DD", "DD Management Linked"].includes(form.invoice_status);

  return (
    <div className="w-full mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Edit Statement #{id}</h1>
      
      {/* Statement Type Dropdown */}
      <div className="mb-6 p-4 bg-gray-50 rounded border">
        <label className="block text-sm font-semibold mb-2">Statement Type *</label>
        <select
          value={statementType}
          onChange={(e) => setStatementType(e.target.value)}
          disabled={isTypeLocked}
          className="w-full sm:w-1/2 border p-2 rounded disabled:bg-gray-200 disabled:cursor-not-allowed"
          required
        >
          <option value="">-- Select --</option>
          <option value="expense">Expense</option>
          <option value="failed_transaction">Failed Transaction</option>
          <option value="cancelled_transaction">Cancelled Transaction</option>
        </select>
        {isTypeLocked && (
          <p className="text-xs text-red-600 mt-2">
            ⚠️ This statement is marked as {statementType === "failed_transaction" ? "Failed" : "Cancelled"}. Cannot change type.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {statementType === "expense" && (
          <>
            <div>
              <label className="block text-sm mb-1">Trans ID *</label>
              <input
                name="trans_id"
                value={form.trans_id}
                onChange={handleChange}
                readOnly
                className="w-full border p-2 rounded bg-gray-50 cursor-not-allowed"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Date *</label>
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                readOnly
                className="w-full border p-2 rounded bg-gray-50 cursor-not-allowed"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Txn Dated Deb</label>
              <input
                name="txn_dated_deb"
                type="date"
                value={form.txn_dated_deb}
                onChange={handleChange}
                readOnly
                className="w-full border p-2 rounded bg-gray-50 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Txn Posted Date</label>
              <input
                name="txn_posted_date"
                type="date"
                value={form.txn_posted_date}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Cheq No</label>
              <input
                name="cheq_no"
                value={form.cheq_no}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Type (Credit/Debit) *</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                disabled
                className="w-full border p-2 rounded bg-gray-50 cursor-not-allowed"
                required
              >
                <option value="Credit">Credit</option>
                <option value="Debit">Debit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Amount *</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                readOnly
                className="w-full border p-2 rounded bg-gray-50 cursor-not-allowed"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <StatementExpensePicker
                expenses={expenses}
                value={form.client_expense_id}
                allocation={expenseAllocation}
                statementTransId={form.trans_id}
                disabled={isSettled || isLinkedToDD || saving}
                onChange={(cid, alloc) => {
                  setForm((p) => ({ ...p, client_expense_id: cid || "" }));
                  setExpenseAllocation(alloc ?? null);
                }}
              />
              {isSettled && (
                <p className="text-xs text-gray-500 mt-1">
                  Expense ID is locked because this statement is Settled.
                </p>
              )}
              {isLinkedToDD && (
                <p className="text-xs text-gray-500 mt-1">
                  Expense ID is locked because this statement is Linked to DD.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                rows={4}
              />
            </div>
          </>
        )}
        
        {statementType === "failed_transaction" && (
          <div className="sm:col-span-2 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SearchAndTableSection 
                type="Credit" 
                statementType="failed_transaction" 
                searchComponent={FailedTransactionSearch}
                onSelectionChange={setSelectedCredit}
                refreshTrigger={refreshTrigger}
              />
              <SearchAndTableSection 
                type="Debit" 
                statementType="failed_transaction" 
                searchComponent={FailedTransactionSearch}
                onSelectionChange={setSelectedDebit}
                refreshTrigger={refreshTrigger}
              />
            </div>
            {selectedCredit && selectedDebit && Number(selectedCredit.amount) === Number(selectedDebit.amount) && (
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleSaveBothSelections}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
            {(!selectedCredit || !selectedDebit || (selectedCredit && selectedDebit && Number(selectedCredit.amount) !== Number(selectedDebit.amount))) && (
              <div className="text-sm text-red-600 p-3 bg-red-50 rounded border border-red-200">
                {!selectedCredit ? "Select a Credit transaction" : !selectedDebit ? "Select a Debit transaction" : "Amounts must match"}
              </div>
            )}
          </div>
        )}
        
        {statementType === "cancelled_transaction" && (
          <div className="sm:col-span-2 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SearchAndTableSection 
                type="Credit" 
                statementType="cancelled_transaction" 
                searchComponent={CancelledTransactionSearch}
                onSelectionChange={setSelectedCredit}
                refreshTrigger={refreshTrigger}
              />
              <SearchAndTableSection 
                type="Debit" 
                statementType="cancelled_transaction" 
                searchComponent={CancelledTransactionSearch}
                onSelectionChange={setSelectedDebit}
                refreshTrigger={refreshTrigger}
              />
            </div>
            {selectedCredit && selectedDebit && Number(selectedCredit.amount) === Number(selectedDebit.amount) && (
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleSaveBothSelections}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
            {(!selectedCredit || !selectedDebit || (selectedCredit && selectedDebit && Number(selectedCredit.amount) !== Number(selectedDebit.amount))) && (
              <div className="text-sm text-red-600 p-3 bg-red-50 rounded border border-red-200">
                {!selectedCredit ? "Select a Credit transaction" : !selectedDebit ? "Select a Debit transaction" : "Amounts must match"}
              </div>
            )}
          </div>
        )}
        
        <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || statementType !== "expense"}
            className="px-4 py-2 bg-yellow-600 text-white rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FailedTransactionSearch({ type = "Credit", onSearch }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allStatements, setAllStatements] = useState([]);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load all statements on mount
  useEffect(() => {
    const loadStatements = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/statements`, {
          credentials: "include"
        });
        const data = await res.json();
        const isAlreadySettled = (stmt) =>
          (stmt.failed_transaction_id != null && String(stmt.failed_transaction_id).trim() !== "") ||
          (stmt.cancelled_transaction_id != null && String(stmt.cancelled_transaction_id).trim() !== "") ||
          (stmt.client_expense_id != null && String(stmt.client_expense_id).trim() !== "") ||
          (stmt.dd_id != null && String(stmt.dd_id).trim() !== "") ||
          String(stmt.invoice_status || "").trim() === "Settled";
        const typeFiltered = (data.statements || []).filter((stmt) => stmt.type === type && !isAlreadySettled(stmt));
        setAllStatements(typeFiltered);
        console.log(`Loaded ${typeFiltered.length} ${type} statements for search`);
      } catch (err) {
        console.error("Failed to load statements:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStatements();
  }, [type]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (allStatements.length === 0 && value.trim().length > 0) {
      console.warn("Statements not loaded yet. Please wait...");
      return;
    }

    if (value.trim().length > 0) {
      const lowerValue = value.toLowerCase();
      const filtered = allStatements.filter((stmt) =>
        String(stmt.trans_id).toLowerCase().includes(lowerValue) ||
        String(stmt.amount).includes(value) ||
        dayjs(stmt.date).format("DD/MM/YYYY").includes(value)
      );
      
      const uniqueSuggestions = [...new Set(
        filtered.slice(0, 8).map((stmt) => stmt.trans_id)
      )];
      
      setSuggestions(uniqueSuggestions);
      setShowSuggestions(uniqueSuggestions.length > 0);
      
      // pass results + searched=true
      onSearch(filtered, true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      // cleared — searched=false, show date filter view
      onSearch([], false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    
    // Filter and pass results based on selected suggestion
    const lowerValue = suggestion.toLowerCase();
    const filtered = allStatements.filter((stmt) =>
      String(stmt.trans_id).toLowerCase().includes(lowerValue) ||
      String(stmt.amount).includes(suggestion) ||
      dayjs(stmt.date).format("DD/MM/YYYY").includes(suggestion)
    );
    onSearch(filtered, true);
  };

  const bgColor = type === "Credit" ? "red" : "blue";
  const bgLight = type === "Credit" ? "red-50" : "blue-50";
  const textColor = type === "Credit" ? "red-800" : "blue-800";

  return (
    <div className={`space-y-4 p-4 bg-${bgLight} border border-${bgColor}-200 rounded`}>
      <h3 className={`text-lg font-semibold text-${textColor}`}>Search Failed {type} Transactions</h3>
      <div className="relative flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by Trans ID, Amount, or Date..."
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="w-full px-4 py-2 border rounded"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-48 overflow-y-auto">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 text-sm"
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedStatement && (
        <div className={`p-4 bg-white border rounded`}>
          <h4 className={`text-lg font-semibold text-${textColor} mb-4`}>Selected Transaction Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Trans ID</label>
              <div className="px-4 py-2 bg-gray-50 rounded border">{selectedStatement.trans_id}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount</label>
              <div className="px-4 py-2 bg-gray-50 rounded border">₹{Number(selectedStatement.amount).toFixed(2)}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <div className="px-4 py-2 bg-gray-50 rounded border">{dayjs(selectedStatement.date).format("DD MMM YYYY")}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
              <div className="px-4 py-2 bg-gray-50 rounded border">{selectedStatement.type}</div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <div className="px-4 py-2 bg-gray-50 rounded border text-sm">{selectedStatement.description || "N/A"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CancelledTransactionSearch({ type = "Credit", onSearch }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allStatements, setAllStatements] = useState([]);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load all statements on mount
  useEffect(() => {
    const loadStatements = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/statements`, {
          credentials: "include"
        });
        const data = await res.json();
        const isAlreadySettled = (stmt) =>
          (stmt.failed_transaction_id != null && String(stmt.failed_transaction_id).trim() !== "") ||
          (stmt.cancelled_transaction_id != null && String(stmt.cancelled_transaction_id).trim() !== "") ||
          (stmt.client_expense_id != null && String(stmt.client_expense_id).trim() !== "") ||
          (stmt.dd_id != null && String(stmt.dd_id).trim() !== "") ||
          String(stmt.invoice_status || "").trim() === "Settled";
        const typeFiltered = (data.statements || []).filter((stmt) => stmt.type === type && !isAlreadySettled(stmt));
        setAllStatements(typeFiltered);
        console.log(`Loaded ${typeFiltered.length} ${type} statements for search`);
      } catch (err) {
        console.error("Failed to load statements:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStatements();
  }, [type]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // If no statements loaded yet, don't filter
    if (allStatements.length === 0 && value.trim().length > 0) {
      console.warn("Statements not loaded yet. Please wait...");
      return;
    }

    if (value.trim().length > 0) {
      const lowerValue = value.toLowerCase();
      const filtered = allStatements.filter((stmt) =>
        String(stmt.trans_id).toLowerCase().includes(lowerValue) ||
        String(stmt.amount).includes(value) ||
        dayjs(stmt.date).format("DD/MM/YYYY").includes(value)
      );
      
      const uniqueSuggestions = [...new Set(
        filtered.slice(0, 8).map((stmt) => stmt.trans_id)
      )];
      
      setSuggestions(uniqueSuggestions);
      setShowSuggestions(uniqueSuggestions.length > 0);
      
      // Auto-update table with search results
      onSearch(filtered, true);
      console.log(`Search found ${filtered.length} results for "${value}"`);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      onSearch([], false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const bgColor = type === "Credit" ? "orange" : "purple";
  const bgLight = type === "Credit" ? "orange-50" : "purple-50";
  const bgHeader = type === "Credit" ? "orange-100" : "purple-100";
  const textColor = type === "Credit" ? "orange-800" : "purple-800";
  const buttonBg = type === "Credit" ? "orange-600" : "purple-600";
  const buttonHover = type === "Credit" ? "hover:bg-orange-700" : "hover:bg-purple-700";

  return (
    <div className={`space-y-4 p-4 bg-${bgLight} border border-${bgColor}-200 rounded`}>
      <h3 className={`text-lg font-semibold text-${textColor}`}>Search Cancelled {type} Transactions</h3>
      <div className="relative flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by Trans ID, Amount, or Date..."
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="w-full px-4 py-2 border rounded"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-48 overflow-y-auto">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 text-sm"
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedStatement && (
        <div className={`p-4 bg-white border rounded`}>
          <h4 className={`text-lg font-semibold text-${textColor} mb-4`}>Selected Transaction Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Trans ID</label>
              <div className="px-4 py-2 bg-gray-50 rounded border">{selectedStatement.trans_id}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount</label>
              <div className="px-4 py-2 bg-gray-50 rounded border">₹{Number(selectedStatement.amount).toFixed(2)}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <div className="px-4 py-2 bg-gray-50 rounded border">{dayjs(selectedStatement.date).format("DD MMM YYYY")}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
              <div className="px-4 py-2 bg-gray-50 rounded border">{selectedStatement.type}</div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <div className="px-4 py-2 bg-gray-50 rounded border text-sm">{selectedStatement.description || "N/A"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchAndTableSection({ type, statementType, searchComponent: SearchComponent, onSelectionChange, refreshTrigger, peerSelectedAmount }) {
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (results, searched) => {
    setSearchResults(results);
    setHasSearched(searched);
  };

  return (
    <div className="space-y-6">
      <SearchComponent type={type} onSearch={handleSearch} />
      <AllStatementsTable 
        type={type} 
        statementType={statementType} 
        searchResults={searchResults}
        hasSearched={hasSearched}
        onSelectionChange={onSelectionChange}
        key={refreshTrigger}
        refreshTrigger={refreshTrigger}
        peerSelectedAmount={peerSelectedAmount}
      />
    </div>
  );
}

function AllStatementsTable({ type = "Credit", statementType = "failed_transaction", searchResults = [], hasSearched = false, onSelectionChange, refreshTrigger, peerSelectedAmount = null }) {
  const { id: currentStatementId } = useParams();
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [filteredStatements, setFilteredStatements] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const isAlreadySettled = (stmt) =>
      (stmt.failed_transaction_id != null && String(stmt.failed_transaction_id).trim() !== "") ||
      (stmt.cancelled_transaction_id != null && String(stmt.cancelled_transaction_id).trim() !== "") ||
      (stmt.client_expense_id != null && String(stmt.client_expense_id).trim() !== "") ||
      (stmt.dd_id != null && String(stmt.dd_id).trim() !== "") ||
      String(stmt.invoice_status || "").trim() === "Settled";

    const loadStatements = async () => {
      try {
        // If user has typed a search (even with 0 results), show those results only
        if (hasSearched) {
          const filtered = searchResults.filter((stmt) => stmt.type === type && !isAlreadySettled(stmt));
          setStatements(filtered);
          setFilteredStatements(filtered);
          
          // Check which ones are already selected
          const columnName = statementType === "failed_transaction" ? "failed_transaction_id" : "cancelled_transaction_id";
          const selected = new Set();
          filtered.forEach((stmt) => {
            if (stmt[columnName] === Number(currentStatementId)) {
              selected.add(stmt.id);
            }
          });
          setSelectedIds(selected);
          
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/statements`, {
          credentials: "include"
        });
        if (!res.ok) {
          console.error("API returned status:", res.status);
          setLoading(false);
          return;
        }
        const data = await res.json();
        // Exclude already settled/failed/cancelled statements
        const allStatements = (data.statements || []).filter((stmt) => stmt.type === type && !isAlreadySettled(stmt));
        setStatements(allStatements);
        
        // Check which ones are already selected
        const columnName = statementType === "failed_transaction" ? "failed_transaction_id" : "cancelled_transaction_id";
        const selected = new Set();
        allStatements.forEach((stmt) => {
          if (stmt[columnName] === Number(currentStatementId)) {
            selected.add(stmt.id);
          }
        });
        setSelectedIds(selected);
        
        // Apply date filter on load only if no search results
        const start = dayjs(startDate);
        const end = dayjs(endDate);
        const filtered = allStatements.filter((stmt) => {
          const stmtDate = dayjs(stmt.date);
          return stmtDate.isAfter(start.subtract(1, 'day')) && stmtDate.isBefore(end.add(1, 'day'));
        });
        setFilteredStatements(filtered);
      } catch (err) {
        console.error("Error loading statements:", err.message);
      } finally {
        setLoading(false);
      }
    };
    loadStatements();
  }, [startDate, endDate, type, searchResults, hasSearched, currentStatementId, statementType, refreshTrigger]);

  const handleDateFilter = () => {
    if (!startDate && !endDate) {
      setFilteredStatements(statements);
      return;
    }

    const filtered = statements.filter((stmt) => {
      const stmtDate = dayjs(stmt.date);
      const start = startDate ? dayjs(startDate) : null;
      const end = endDate ? dayjs(endDate) : null;

      if (start && end) {
        return stmtDate.isAfter(start.subtract(1, 'day')) && stmtDate.isBefore(end.add(1, 'day'));
      } else if (start) {
        return stmtDate.isAfter(start.subtract(1, 'day'));
      } else if (end) {
        return stmtDate.isBefore(end.add(1, 'day'));
      }
      return true;
    });

    setFilteredStatements(filtered);
  };

  const handleSelectStatement = async (stmt, currentlySelected) => {
    setSaving(true);
    try {
      const columnName = statementType === "failed_transaction" ? "failed_transaction_id" : "cancelled_transaction_id";
      const payload = {
        trans_ids: [stmt.id],
        [columnName]: currentlySelected ? null : Number(currentStatementId)
      };

      const res = await fetch(`/api/statements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include"
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        setSaving(false);
        return;
      }

      // Update selected IDs state
      const newSelectedIds = new Set(selectedIds);
      if (currentlySelected) {
        newSelectedIds.delete(stmt.id);
        toast.success("Transaction unselected!");
      } else {
        newSelectedIds.add(stmt.id);
        toast.success("Transaction selected!");
      }
      setSelectedIds(newSelectedIds);
      
      // Notify parent of selection
      const selected = filteredStatements.find(s => newSelectedIds.has(s.id));
      onSelectionChange(selected || null);
    } catch (err) {
      toast.error("Error saving transaction");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const bgColor = type === "Credit" ? "red" : "blue";
  const bgLight = type === "Credit" ? "red-50" : "blue-50";
  const bgHeader = type === "Credit" ? "red-100" : "blue-100";
  const textColor = type === "Credit" ? "red-800" : "blue-800";

  // Show date filter only when user hasn't typed a search
  const showDateFilter = !hasSearched;

  return (
    <div className={`space-y-4 p-4 bg-${bgLight} border border-${bgColor}-200 rounded`}>
      <h3 className={`text-lg font-semibold text-${textColor}`}>All {type} {statementType === "failed_transaction" ? "Failed" : "Cancelled"} Transactions</h3>
      
      {showDateFilter && (
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border rounded"
            />
          </div>
          <button
            onClick={handleDateFilter}
            className={`px-4 py-2 bg-${bgColor}-600 text-white rounded hover:bg-${bgColor}-700`}
          >
            Filter
          </button>
          <button
            onClick={() => {
              const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");
              const monthEnd = dayjs().endOf("month").format("YYYY-MM-DD");
              setStartDate(monthStart);
              setEndDate(monthEnd);
            }}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Reset
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-4 text-center text-gray-600">Loading...</div>
      ) : filteredStatements.length === 0 ? (
        <div className="p-4 text-center text-gray-600">
          {hasSearched ? "No matched statements" : "No statements found"}
        </div>
      ) : (
        <div className="bg-white rounded border overflow-hidden" style={{ maxHeight: type === "Credit" ? '500px' : '400px', overflowY: 'auto' }}>
          <table className="w-full text-sm">
            <thead className={`bg-${bgHeader} sticky top-0`}>
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Trans ID</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStatements.map((stmt) => {
                const isSelected = selectedIds.has(stmt.id);
                return (
                  <tr key={stmt.id} className={`border-t hover:bg-gray-50 ${isSelected ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-2 text-sm text-gray-600">{stmt.id}</td>
                    <td className="px-4 py-2 font-medium">{stmt.trans_id}</td>
                    <td className="px-4 py-2">{dayjs(stmt.date).format("DD MMM YYYY")}</td>
                    <td className="px-4 py-2">₹{Number(stmt.amount).toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        disabled={saving}
                        className={`px-3 py-1 ${isSelected ? 'bg-gray-500 hover:bg-gray-600' : `bg-${bgColor}-600 hover:bg-${bgColor}-700`} text-white rounded text-sm disabled:opacity-50`}
                        onClick={() => handleSelectStatement(stmt, isSelected)}
                      >
                        {saving ? "Saving..." : (isSelected ? "Unselect" : "Select")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-sm text-gray-600">
        Showing {filteredStatements.length} of {statements.length} statements
      </div>
    </div>
  );
}
