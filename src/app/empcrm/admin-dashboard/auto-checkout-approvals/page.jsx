"use client";

import { useState } from "react";
import Link from "next/link";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import AttendanceAutoCheckoutApprovalsCard from "@/components/AttendanceAutoCheckoutApprovalsCard";
import { ArrowLeft } from "lucide-react";

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toYmd(first), to: toYmd(now) };
}

export default function AutoCheckoutApprovalsPage() {
  const initialRange = currentMonthRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);

  return (
    <div className="w-full py-2 sm:py-4 px-2 sm:px-0">
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/empcrm/admin-dashboard"
              className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Automatic check-out approval
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Approve 9:00 PM system check-outs. Until approved, attendance
              records stay marked as{" "}
              <span className="font-semibold text-red-600">Automatic</span>.
            </p>
          </div>
          <Link
            href="/empcrm/admin-dashboard/attendance"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0"
          >
            Open attendance details →
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            From
            <TypeableDateFilterInput
              value={fromDate}
              onChange={setFromDate}
              className="min-w-[160px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            To
            <TypeableDateFilterInput
              value={toDate}
              onChange={setToDate}
              className="min-w-[160px]"
            />
          </label>
        </div>

        <AttendanceAutoCheckoutApprovalsCard
          fromDate={fromDate}
          toDate={toDate}
        />
      </div>
    </div>
  );
}
