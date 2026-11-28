"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const APPROVER_ROLES = new Set([
  "ACCOUNTANT",
  "ADMIN",
  "SUPERADMIN",
  "HR_MANAGER",
  "DIRECTOR",
]);

const PENDING_APPROVAL_LABEL = "Pending approval";

function normalizeApprovalStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "approved") return "Approved";
  if (v === "rejected") return "Rejected";
  if (v === "pending" || v === "pending approval" || !v) {
    return PENDING_APPROVAL_LABEL;
  }
  return raw;
}

function ExpenseApprovalModal({ open, titleId, onClose, children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
  <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        {children}
      </div>
    </div>,
    document.body,
  );
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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionRemark, setRejectionRemark] = useState("");
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
        setRejectOpen(false);
        setRejectionRemark("");
        onSuccess?.();
      } catch (err) {
        window.alert(err.message || "Failed to update approval");
      } finally {
        setLoading(null);
      }
    },
    [expenseId, onSuccess],
  );

  const openRejectModal = () => {
    setRejectionRemark("");
    setRejectOpen(true);
  };

  const submitRejected = (e) => {
    e.preventDefault();
    const remark = rejectionRemark.trim();
    if (!remark) {
      alert("Please enter a rejection remark.");
      return;
    }
    runUpdate("rejected", {
      approved_amount: 0,
      approval_status: "Rejected",
      approval_date: today,
      approved_by: approverUsername || "",
      rejection_remark: remark,
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

  const btnBase =
    "w-full rounded-lg px-1.5 py-1.5 text-[9px] font-bold leading-tight shadow-sm transition disabled:opacity-50 sm:text-[10px] sm:leading-snug";

  const isApproved = current === "Approved";
  const isRejected = current === "Rejected";
  const showApprove = !isApproved;
  const showReject = !isRejected;

  if (!showApprove && !showReject) {
    return null;
  }

  return (
    <>
      <div
        className={`grid w-[9.25rem] gap-2 ${
          showApprove && showReject ? "grid-cols-2" : "grid-cols-1"
        }`}
        role="group"
        aria-label="Expense approval actions"
      >
        {showApprove ? (
          <button
            type="button"
            disabled={loading != null}
            onClick={() => {
              setApprovedAmount(String(Number(totalAmount || 0).toFixed(2)));
              setApprovalDate(today);
              setApproveOpen(true);
            }}
            className={`${btnBase} bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/90 hover:bg-emerald-200`}
          >
            Approved
          </button>
        ) : null}
        {showReject ? (
          <button
            type="button"
            disabled={loading != null}
            onClick={openRejectModal}
            className={`${btnBase} bg-rose-100 text-rose-900 ring-1 ring-rose-300/90 hover:bg-rose-200`}
          >
            Reject
          </button>
        ) : null}
      </div>
      <ExpenseApprovalModal
        open={rejectOpen}
        titleId="expense-reject-title"
        onClose={() => {
          setRejectOpen(false);
          setRejectionRemark("");
        }}
      >
        <h3
          id="expense-reject-title"
          className="text-base font-semibold text-slate-900"
        >
          Reject expense #{expenseId}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Add a remark for the engineer. You can set this back to Pending approval later.
        </p>
        <form onSubmit={submitRejected} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Rejection remark *
            </label>
            <textarea
              value={rejectionRemark}
              onChange={(e) => setRejectionRemark(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              rows={4}
              required
              autoFocus
              placeholder="Enter reason for rejection…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setRejectOpen(false);
                setRejectionRemark("");
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading === "rejected"}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {loading === "rejected" ? "Saving…" : "Confirm reject"}
            </button>
          </div>
        </form>
      </ExpenseApprovalModal>
      <ExpenseApprovalModal
        open={approveOpen}
        titleId="expense-approve-title"
        onClose={() => setApproveOpen(false)}
      >
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
      </ExpenseApprovalModal>
    </>
  );
}