"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { CreditCard } from "lucide-react";
import {
  allowNeworderPaymentAmountWithoutInvoiceLink,
  buildOrderOnlyPaymentLinesForDisplay,
  buildOrderPaymentHistoryRows,
  getOrderPaidAmountForDisplay,
  sumOrderPaymentHistoryAmount,
} from "@/lib/orderPaymentHistory";
import {
  getOrderPaymentsLinkedToInvoice,
  orderInvoiceHasPaymentLink,
} from "@/lib/orderLinkedPaymentsDisplay";
import {
  deriveOrderListPaymentStatus,
  getOrderTotalForPayment,
} from "@/lib/paymentOrderStatus";

function formatPrevDate(d) {
  if (!d) return "-";
  const v = dayjs(d);
  return v.isValid() ? v.format("DD-MM-YYYY") : d;
}

function formatInr(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Read-only payment details for order actions menu. */
export default function ViewPaymentButton({ order, className }) {
  const [open, setOpen] = useState(false);
  const total = getOrderTotalForPayment(order);
  const historySum = sumOrderPaymentHistoryAmount(order);
  const totalPaid =
    historySum > 0 ? historySum : getOrderPaidAmountForDisplay(order);
  const balance = Math.max(0, total - totalPaid);
  const invoiceLinked = orderInvoiceHasPaymentLink(order);
  const csvLines = buildOrderOnlyPaymentLinesForDisplay(order);
  const linkedLines = invoiceLinked
    ? getOrderPaymentsLinkedToInvoice(order)
    : [];
  const historyRows = buildOrderPaymentHistoryRows(order);
  const displayLines =
    order?.statement_payments_by_trans_id && historyRows.length
      ? historyRows.map((r) => ({
          ref: r.id || "",
          date: r.date,
          amount: Number(r.amount) || 0,
        }))
      : invoiceLinked
        ? linkedLines.map((p) => ({
            ref: p.trans_id || "",
            date: p.date,
            amount: p.amount,
          }))
        : csvLines;

  const buttonClass =
    className ||
    "flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 text-left";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={buttonClass}
        title="View Payment"
      >
        <CreditCard size={16} />
        <span>View Payment</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-1">View Payment</h3>
            <p className="text-sm text-gray-600 mb-3">Order {order.order_id}</p>
            <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded border bg-gray-50 px-2 py-1.5">
                <div className="text-xs text-gray-500">Total</div>
                <div className="font-semibold">₹{formatInr(total)}</div>
              </div>
              <div className="rounded border bg-green-50 px-2 py-1.5">
                <div className="text-xs text-gray-500">Paid</div>
                <div className="font-semibold text-green-800">
                  ₹{formatInr(totalPaid)}
                </div>
              </div>
              <div className="rounded border bg-amber-50 px-2 py-1.5">
                <div className="text-xs text-gray-500">Balance</div>
                <div className="font-semibold text-amber-800">
                  ₹{formatInr(balance)}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-xs text-gray-700">
                <div className="font-medium mb-1">
                  {invoiceLinked
                    ? "Invoice linked payments"
                    : allowNeworderPaymentAmountWithoutInvoiceLink(order)
                      ? "Order payments (before 08-Apr-2026)"
                      : "Order payments"}
                </div>
                {!invoiceLinked &&
                !allowNeworderPaymentAmountWithoutInvoiceLink(order) ? (
                  <p className="text-gray-500 py-2">
                    Without invoice link, booking payment on neworder is shown
                    only for orders before 08-Apr-2026.
                  </p>
                ) : null}
                {displayLines.length ? (
                  <div className="border rounded">
                    <div className="grid grid-cols-3 text-gray-600 bg-gray-50 px-2 py-1">
                      <div>ID</div>
                      <div>Date</div>
                      <div className="text-right">Amount</div>
                    </div>
                    <div className="max-h-40 overflow-auto">
                      {displayLines.map((r, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-3 px-2 py-1 border-t"
                        >
                          <div className="truncate" title={r.ref}>
                            {r.ref || "-"}
                          </div>
                          <div>{formatPrevDate(r.date)}</div>
                          <div className="text-right">
                            {r.amount != null && r.amount !== ""
                              ? formatInr(r.amount)
                              : "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 px-2 py-1 border-t bg-gray-50">
                      <div className="col-span-2 font-medium">Total paid</div>
                      <div className="text-right font-semibold">
                        ₹{formatInr(totalPaid)}
                      </div>
                    </div>
                  </div>
                ) : !invoiceLinked &&
                  !allowNeworderPaymentAmountWithoutInvoiceLink(order) ? null : (
                  <div className="text-gray-500 py-2">No payments recorded</div>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Status:{" "}
                <span className="font-medium capitalize">
                  {deriveOrderListPaymentStatus(order) ||
                    order.payment_status ||
                    "—"}
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function orderHasViewablePayment(order) {
  if (!order) return false;
  if (getOrderPaidAmountForDisplay(order) > 0) return true;
  if (orderInvoiceHasPaymentLink(order)) return true;
  if (
    allowNeworderPaymentAmountWithoutInvoiceLink(order) &&
    (Number(order.advance_requested) > 0 ||
      String(order.payment_amount || "").trim())
  ) {
    return true;
  }
  if (order.amount_received != null && order.amount_received !== "") return true;
  if (String(order.payment_id || "").trim()) return true;
  if (order.linked_payments_json) return true;
  return false;
}
