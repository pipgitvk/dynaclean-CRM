"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import ExpenseTable from "@/app/admin-dashboard/expenses/ExpenseTable";

export default function ServiceBeforeInstallationExpenseApprovalClient({
  dashboardBase,
  rows,
  role,
  approverUsername = "",
}) {
  const searchParams = useSearchParams();
  const initialSummaryBucket = searchParams.get("bucket") || undefined;
  const hubHref =
    dashboardBase === "accounts-dashboard"
      ? `/${dashboardBase}`
      : `/${dashboardBase}/service-before-installation`;
  const addExpenseHref = `/${dashboardBase}/service-before-installation/expense-approval-dashboard/add`;

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-violet-50/50 via-white to-slate-50 pb-12 pt-2 sm:pt-3">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-violet-100/40 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 w-full min-w-0 px-1 sm:px-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={hubHref}
            className="inline-flex items-center gap-2 rounded-lg px-1 text-sm font-semibold text-violet-700 hover:text-violet-900"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {dashboardBase === "accounts-dashboard" ? "Back to Dashboard" : "Back to Hub"}
          </Link>
          <Link
            href={addExpenseHref}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add Expense
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-violet-100/90 bg-white/95 p-4 shadow-[0_20px_50px_-20px_rgba(91,33,182,0.22)] backdrop-blur-sm sm:p-6">
          <ExpenseTable
            rows={rows}
            role={role}
            approverUsername={approverUsername}
            clickableSummaryCards
            uiVariant="sbi"
            initialSummaryBucket={initialSummaryBucket}
          />
        </div>
      </div>
    </div>
  );
}