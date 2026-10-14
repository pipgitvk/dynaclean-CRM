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
    <div className="rounded border bg-gradient-to-r from-gray-50 to-blue-50 p-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-0 lg:divide-x lg:divide-gray-300">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={`text-center px-2 py-1 ${
              cell.clickable
                ? "cursor-pointer rounded hover:bg-white/60 transition-colors"
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
            <p className={`text-[11px] font-semibold leading-tight ${cell.labelClass}`}>
              {cell.label}
            </p>
            <p className={`font-bold leading-snug mt-0.5 break-all ${cell.valueClass}`}>
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
