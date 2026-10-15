"use client";

import { Trash2 } from "lucide-react";
import {
  formatPaymentPendingInr,
  summarizePaymentPendingOrders,
} from "@/lib/filterPaymentPendingOrders";

export default function PaymentPendingStatsBar({
  orders,
  onOrdersClick,
  totalOrdersCardClicks = 0,
  showDeleteAll = false,
  deletingAll = false,
  onDeleteAll,
}) {
  const summary = summarizePaymentPendingOrders(orders);

  const cells = [
    {
      label: "Total Orders",
      value: summary.count,
      valueClass: "text-gray-800",
      labelClass: "text-teal-600",
      onClick: onOrdersClick,
      clickable: Boolean(onOrdersClick),
    },
    {
      label: "Pending (Remaining)",
      value: formatPaymentPendingInr(summary.totalRemaining),
      valueClass: "text-red-600 text-sm sm:text-base",
      labelClass: "text-red-600",
    },
    {
      label: "Order Value",
      value: formatPaymentPendingInr(summary.totalOrderValue),
      valueClass: "text-gray-800 text-sm sm:text-base",
      labelClass: "text-blue-600",
    },
    {
      label: "Received",
      value: formatPaymentPendingInr(summary.totalPaid),
      valueClass: "text-green-700 text-sm sm:text-base",
      labelClass: "text-green-700",
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={`min-w-0 rounded-md bg-white/70 px-2 py-2 sm:bg-transparent sm:px-3 ${
              cell.clickable
                ? "cursor-pointer hover:bg-white/90 sm:hover:bg-white/60 transition-colors"
                : ""
            }`}
            onClick={cell.clickable ? cell.onClick : undefined}
            onKeyDown={
              cell.clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") cell.onClick?.();
                  }
                : undefined
            }
            role={cell.clickable ? "button" : undefined}
            tabIndex={cell.clickable ? 0 : undefined}
          >
            <p className={`text-[11px] font-semibold leading-tight sm:text-xs ${cell.labelClass}`}>
              {cell.label}
            </p>
            <p
              className={`mt-1 text-base font-bold tabular-nums leading-none whitespace-nowrap sm:text-lg ${cell.valueClass}`}
            >
              {cell.value}
            </p>
          </div>
        ))}
      </div>

      {showDeleteAll && totalOrdersCardClicks >= 8 && (
        <button
          type="button"
          onClick={onDeleteAll}
          disabled={deletingAll}
          className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={10} />
          {deletingAll ? "Deleting..." : "Delete All"}
        </button>
      )}
    </div>
  );
}
