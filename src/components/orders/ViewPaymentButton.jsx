"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { CreditCard } from "lucide-react";
import {
  buildOrderPaymentRows,
  sumOrderPaymentAmounts,
} from "@/lib/orderPaymentHistory";

/** Read-only payment details for order actions menu. */
export default function ViewPaymentButton({ order, className }) {
  const [open, setOpen] = useState(false);
  const totalamt = order.totalamt || 0;
  const rows = buildOrderPaymentRows(order);

  const formatPrevDate = (d) => {
    if (!d) return "-";
    const v = dayjs(d);
    return v.isValid() ? v.format("DD-MM-YYYY") : d;
  };

  const totalPaid = sumOrderPaymentAmounts(order);

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-3">View Payment</h3>
            <p>Total Amount : {totalamt}</p>
            <div className="space-y-3">
              <div className="text-xs text-gray-700">
                <div className="font-medium mb-1">Payments</div>
                {rows.length ? (
                  <div className="border rounded">
                    <div className="grid grid-cols-3 text-gray-600 bg-gray-50 px-2 py-1">
                      <div>ID</div>
                      <div>Date</div>
                      <div className="text-right">Amount</div>
                    </div>
                    <div className="max-h-40 overflow-auto">
                      {rows.map((r, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-3 px-2 py-1 border-t"
                        >
                          <div className="truncate" title={r.id}>
                            {r.id || "-"}
                          </div>
                          <div>{formatPrevDate(r.date)}</div>
                          <div className="text-right">{r.amount || "-"}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 px-2 py-1 border-t bg-gray-50">
                      <div className="col-span-2 font-medium">Total Paid</div>
                      <div className="text-right font-semibold">
                        {totalPaid}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No payments recorded</div>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Status:{" "}
                <span className="font-medium">
                  {order.payment_status || "-"}
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
  if (order.report_file) return true;
  if (order.amount_received != null && order.amount_received !== "") return true;
  if (String(order.payment_id || "").trim()) return true;
  if (String(order.payment_amount || "").trim()) return true;
  if (order.linked_payments_json) return true;
  return false;
}
