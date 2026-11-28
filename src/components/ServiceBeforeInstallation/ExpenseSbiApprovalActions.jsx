"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { Check, Clock, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

const APPROVER_ROLES = new Set([
  "ACCOUNTANT",
  "ADMIN",
  "SUPERADMIN",
  "HR_MANAGER",
  "DIRECTOR",
]);

function normalizeApprovalStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "approved") return "Approved";
  if (v === "rejected") return "Rejected";
  return "Pending";
}

async function postExpenseApproval(body) {
  const res = await fetch("/api/expenses/approve", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not update approval");
  }
}

export function canManageExpenseApproval(role) {
  return APPROVER_ROLES.has(String(role || "").toUpperCase());
}

export default function ExpenseSbiApprovalActions({
  expenseId,
  totalAmount,
  approvalStatus,
  approverUsername,
  onSuccess,
}) {
  const current = normalizeApprovalStatus(approvalStatus);
  const [loading, setLoading] = useState(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState(
    String(Number(totalAmount || 0).toFixed(2)),
  );
  const [approvalDate, setApprovalDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const runUpdate = useCallback(
    async (kind, payload) => {
      setLoading(kind);
      try {
        await postExpenseApproval({
          expense_id: expenseId,
          ...payload,
        });
        setApproveOpen(false);
        onSuccess?.();
      } catch (err) {
        alert(err.message || "Failed to update approval");
      } finally {
        setLoading(null);
      }
    },
    [expenseId, onSuccess],
  );

  const setPending = () => {
    if (current === "Pending") return;
    runUpdate("pending", {
      approved_amount: 0,
      approval_status: "Pending",
      approval_date: today,
      approved_by: approverUsername || "",
    });
  };

  const setRejected = () => {
    if (
      !window.confirm(
        "Reject this expense? You can change it back to Pending approval later.",
      )
    ) {
      return;
    }
    runUpdate("rejected", {
      approved_amount: 0,
      approval_status: "Rejected",
      approval_date: today,
      approved_by: approverUsername || "",
    });
  };

  const submitApproved = (e) => {
    e.preventDefault();
    const amt = Number(approvedAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      alert("Enter a valid approved amount");
      return;
    }
    runUpdate("approved", {
      approved_amount: amt,
      approval_status: "Approved",
      approval_date: approvalDate,
      approved_by: approverUsername || "",
    });
  };

  const iconBtnBase =
    "inline-flex cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label="Expense approval actions"
      >
        <button
          type="button"
          disabled={loading != null || current === "Pending"}
          onClick={setPending}
          className={`${iconBtnBase} ${
            current === "Pending"
              ? "text-amber-700"
              : "text-amber-600 hover:text-amber-800"
          }`}
          title="Pending approval"
          aria-label="Set pending approval"
        >
          <Clock size={16} aria-hidden />
        </button>
        <button
          type="button"
          disabled={loading != null}
          onClick={() => {
            setApprovedAmount(String(Number(totalAmount || 0).toFixed(2)));
            setApprovalDate(today);
            setApproveOpen(true);
          }}
          className={`${iconBtnBase} ${
            current === "Approved"
              ? "text-green-700"
              : "text-green-600 hover:text-green-800"
          }`}
          title="Approve expense"
          aria-label="Approve expense"
        >
          <Check size={16} aria-hidden />
        </button>
        <button
          type="button"
          disabled={loading != null}
          onClick={setRejected}
          className={`${iconBtnBase} ${
            current === "Rejected"
              ? "text-red-700"
              : "text-red-600 hover:text-red-800"
          }`}
          title="Reject expense"
          aria-label="Reject expense"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {approveOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-approve-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3
              id="expense-approve-title"
              className="text-base font-semibold text-slate-900"
            >
              Approve expense #{expenseId}
            </h3>
            <form onSubmit={submitApproved} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Approved amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Approval date
                </label>
                <TypeableDateFilterInput
                  value={approvalDate}
                  onChange={setApprovalDate}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApproveOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading === "approved"}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading === "approved" ? "Saving…" : "Confirm approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}