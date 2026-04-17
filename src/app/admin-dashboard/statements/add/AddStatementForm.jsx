"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import StatementExpensePicker from "../StatementExpensePicker";

export default function AddStatementForm({ expenseId, defaultAmount }) {
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [expenseAllocation, setExpenseAllocation] = useState(null);
  const [lastBalance, setLastBalance] = useState(0);
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      type: "Credit",
      client_expense_id: expenseId || "",
      amount: defaultAmount ?? "",
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rRoot = await fetch("/api/client-expenses?root_only=1", {
          credentials: "include",
        });
        const rootData = await rRoot.json();
        let list = rootData?.clientExpenses || [];
        const n = expenseId ? Number(expenseId) : null;
        if (n && Number.isFinite(n) && n >= 1 && !list.some((e) => Number(e.id) === n)) {
          const rOne = await fetch(`/api/client-expenses/${n}`, {
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
        if (!cancelled) setExpenses(list);
      } catch {
        if (!cancelled) setExpenses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expenseId]);

  useEffect(() => {
    fetch("/api/statements/last-balance", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setLastBalance(Number(data?.lastBalance ?? 0)))
      .catch(() => {});
  }, []);

  const type = watch("type", "Credit");
  const amount = Number(watch("amount", 0)) || 0;
  // Credit = add, Debit = subtract. If dropdown sends swapped values, invert: treat "Credit" as subtract, "Debit" as add for display.
  const newBalance = String(type).toLowerCase() === "credit" ? lastBalance - amount : lastBalance + amount;

  const onSubmit = async (data) => {
    setSubmitting(true);

    try {
      const res = await fetch("/api/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trans_id: data.trans_id,
          date: data.date,
          txn_dated_deb: data.txn_dated_deb || null,
          txn_posted_date: data.txn_posted_date || null,
          cheq_no: data.cheq_no || null,
          description: data.description || null,
          type: data.type,
          amount: data.amount,
          client_expense_id: data.client_expense_id ? Number(data.client_expense_id) : null,
          expense_allocation: expenseAllocation,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Statement added successfully!");
        router.push("/admin-dashboard/statements");
      } else {
        toast.error(result.error || "Failed to add statement");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    reset();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-7xl mx-auto p-6 space-y-6 bg-white rounded-xl shadow"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Add Statement</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">Trans ID *</label>
          <input
            {...register("trans_id", { required: true })}
            className="w-full border p-2 rounded-md"
            placeholder="Transaction ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date *</label>
          <input
            type="date"
            {...register("date", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Txn Dated Deb</label>
          <input
            type="date"
            {...register("txn_dated_deb")}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Txn Posted Date</label>
          <input
            type="date"
            {...register("txn_posted_date")}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cheq No</label>
          <input
            {...register("cheq_no")}
            className="w-full border p-2 rounded-md"
            placeholder="Cheque number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type (Credit/Debit) *</label>
          <select
            {...register("type", { required: true })}
            className="w-full border p-2 rounded-md"
          >
            <option value="Credit">Credit</option>
            <option value="Debit">Debit</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount *</label>
          <input
            type="number"
            step="0.01"
            {...register("amount", { required: true })}
            className="w-full border p-2 rounded-md"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Last Balance</label>
          <div className="w-full border p-2 rounded-md bg-gray-50">
            ₹{Math.abs(lastBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New Balance (after this tx)</label>
          <div className="w-full border p-2 rounded-md bg-blue-50 font-medium">
            ₹{Math.abs(newBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {String(type).toLowerCase() === "credit" ? "Last balance − amount" : "Last balance + amount"}
          </p>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <StatementExpensePicker
            expenses={expenses}
            value={watch("client_expense_id") || ""}
            allocation={expenseAllocation}
            onChange={(id, alloc) => {
              setValue("client_expense_id", id);
              setExpenseAllocation(alloc ?? null);
            }}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          {...register("description")}
          className="w-full border p-3 rounded-md"
          rows={4}
          placeholder="Transaction description"
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <button
          type="button"
          onClick={handleReset}
          className="w-full sm:w-auto px-6 py-3 bg-gray-500 text-gray-100 rounded-lg hover:bg-gray-600 cursor-pointer"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Submitting..." : "Add Statement"}
        </button>
      </div>
    </form>
  );
}
