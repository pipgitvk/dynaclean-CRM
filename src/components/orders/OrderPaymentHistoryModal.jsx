"use client";

import { useState } from "react";
import dayjs from "dayjs";
import {
  buildOrderPaymentHistoryRows,
  getOrderPaidAmountForDisplay,
  sumOrderPaymentHistoryAmount,
} from "@/lib/orderPaymentHistory";
import { orderHasViewablePayment } from "@/components/orders/ViewPaymentButton";

function formatPaymentDate(d) {
  if (!d) return "-";
  const v = dayjs(d);
  return v.isValid() ? v.format("DD-MM-YYYY") : d;
}

export function orderShowsPaymentHistory(order, paymentStatusRaw) {
  if (!order) return false;
  const compact = (paymentStatusRaw || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (compact === "paid" || compact === "partiallypaid") return true;
  if (getOrderPaidAmountForDisplay(order) > 0) return true;
  return orderHasViewablePayment(order);
}

export default function OrderPaymentHistoryModal({
  open,
  onClose,
  order,
  totalAmount,
}) {
  if (!open || !order) return null;

  const rows = buildOrderPaymentHistoryRows(order);
  const historySum = sumOrderPaymentHistoryAmount(order);
  const totalPaidValue =
    historySum > 0 ? historySum : getOrderPaidAmountForDisplay(order);
  const totalPaid = Number(totalPaidValue).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const total =
    totalAmount != null && totalAmount !== ""
      ? Number(totalAmount)
      : Number(order.totalamt) || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="order-payment-history-title"
      >
        <h3
          id="order-payment-history-title"
          className="mb-1 text-base font-semibold text-gray-900"
        >
          Payment history
        </h3>
        <p className="mb-3 text-sm text-gray-600">
          Order {order.order_id}
          {total > 0 ? (
            <>
              {" "}
              · Total ₹
              {total.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </>
          ) : null}
        </p>
        <div className="text-xs text-gray-700">
          {rows.length ? (
            <div className="overflow-hidden rounded border">
              <div className="grid grid-cols-3 bg-gray-50 px-2 py-1.5 text-gray-600">
                <div>ID</div>
                <div>Date</div>
                <div className="text-right">Amount</div>
              </div>
              <div className="max-h-48 overflow-auto">
                {rows.map((r, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-3 border-t px-2 py-1.5"
                  >
                    <div className="truncate" title={r.id}>
                      {r.id || "-"}
                    </div>
                    <div>{formatPaymentDate(r.date)}</div>
                    <div className="text-right">{r.amount || "-"}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 border-t bg-gray-50 px-2 py-1.5 font-semibold">
                <div className="col-span-2">Total paid</div>
                <div className="text-right text-green-700">{totalPaid}</div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-gray-500">
              No payments recorded
            </p>
          )}
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Status:{" "}
          <span className="font-medium">{order.payment_status || "—"}</span>
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Clickable trigger that opens payment history for an order. */
export function OrderPaymentHistoryTrigger({
  order,
  paymentStatusRaw,
  totalAmount,
  className,
  title = "View payment history",
  children,
}) {
  const [open, setOpen] = useState(false);
  const clickable = orderShowsPaymentHistory(order, paymentStatusRaw);

  if (!clickable) {
    return <span className={className}>{children}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
        title={title}
      >
        {children}
      </button>
      <OrderPaymentHistoryModal
        open={open}
        onClose={() => setOpen(false)}
        order={order}
        totalAmount={totalAmount}
      />
    </>
  );
}
