"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { formatPaymentPendingInr } from "@/lib/filterPaymentPendingOrders";

export const PAYMENT_AMOUNT_SORT_KEYS = [
  "total_amount",
  "paid_amount",
  "remaining_amount",
];

export const PAYMENT_AMOUNT_SORT_LABELS = {
  total_amount: "Total",
  paid_amount: "Paid",
  remaining_amount: "Pending",
};

export function nextPaymentAmountSortConfig(prev) {
  if (!PAYMENT_AMOUNT_SORT_KEYS.includes(prev.key)) {
    return { key: "remaining_amount", direction: "asc" };
  }
  if (prev.direction === "asc") {
    return { ...prev, direction: "desc" };
  }
  const idx = PAYMENT_AMOUNT_SORT_KEYS.indexOf(prev.key);
  const nextKey =
    PAYMENT_AMOUNT_SORT_KEYS[(idx + 1) % PAYMENT_AMOUNT_SORT_KEYS.length];
  return { key: nextKey, direction: "asc" };
}

function formatPaymentLineDate(value) {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD-MM-YYYY") : value;
}

function PaidAmountWithPaymentsInfo({ order }) {
  const [open, setOpen] = useState(false);
  const lines = order.payment_lines || [];
  const hasPaid = Number(order.paid_amount) > 0;

  if (!hasPaid && !lines.length) {
    return <span>{formatPaymentPendingInr(order.paid_amount)}</span>;
  }

  return (
    <div className="relative inline-flex items-center justify-end gap-1.5">
      <span>{formatPaymentPendingInr(order.paid_amount)}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
        title="Payment details"
        aria-label="Payment details"
      >
        <Info size={12} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close payment details"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full z-50 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-2 text-left text-xs shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 border-b border-gray-100 pb-1 font-semibold text-gray-800">
              Payments
            </div>
            {lines.length ? (
              <div className="max-h-48 overflow-y-auto">
                <div className="grid grid-cols-[1fr_1fr_1.1fr] gap-1 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <span>Date</span>
                  <span className="text-right">Amount</span>
                  <span>Ref</span>
                </div>
                {lines.map((line, idx) => (
                  <div
                    key={`${line.ref}-${line.date}-${idx}`}
                    className="grid grid-cols-[1fr_1fr_1.1fr] gap-1 border-t border-gray-100 px-1 py-1.5 text-gray-800"
                  >
                    <span>{formatPaymentLineDate(line.date)}</span>
                    <span className="text-right font-medium text-green-700">
                      {formatPaymentPendingInr(line.amount)}
                    </span>
                    <span
                      className="truncate font-mono text-[11px]"
                      title={line.ref || ""}
                    >
                      {line.ref || "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-1 py-2 text-gray-500">No payment lines recorded</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PaymentAmountSummaryCell({ order }) {
  return (
    <div className="space-y-1 text-right text-xs">
      <div className="flex items-center justify-end gap-1.5 text-gray-800">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Total
        </span>
        <span className="font-medium whitespace-nowrap">
          {formatPaymentPendingInr(order.total_amount)}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-green-600">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Paid
        </span>
        <PaidAmountWithPaymentsInfo order={order} />
      </div>
      <div className="flex items-center justify-end gap-1.5 text-red-600 font-semibold">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 font-normal">
          Pending
        </span>
        <span className="whitespace-nowrap">
          {formatPaymentPendingInr(order.remaining_amount)}
        </span>
      </div>
      {Number(order.deduction_amount || 0) > 0 && (
        <div className="text-[11px] font-medium text-orange-600">
          Deducted {formatPaymentPendingInr(order.deduction_amount)}
        </div>
      )}
    </div>
  );
}

export function PaymentAmountColumnHeader({ sortConfig, onSort }) {
  return (
    <th
      className="px-4 py-3 text-right font-semibold cursor-pointer hover:bg-gray-700 transition-colors min-w-[9rem]"
      onClick={onSort}
      title="Click to sort: Pending → Total → Paid"
    >
      <span className="block text-xs font-semibold leading-tight">
        Total / Paid / Pending
      </span>
      {PAYMENT_AMOUNT_SORT_KEYS.includes(sortConfig.key) ? (
        <span className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] font-normal text-gray-300">
          Sort: {PAYMENT_AMOUNT_SORT_LABELS[sortConfig.key]}
          {sortConfig.direction === "asc" ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )}
        </span>
      ) : null}
    </th>
  );
}