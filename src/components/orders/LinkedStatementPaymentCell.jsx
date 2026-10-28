"use client";

import dayjs from "dayjs";
import {
  getOrderPaymentsLinkedToInvoice,
  orderHasInvoiceNumber,
  orderInvoiceHasPaymentLink,
} from "@/lib/orderLinkedPaymentsDisplay";
import {
  allowNeworderPaymentAmountWithoutInvoiceLink,
  sumAdvanceRequestedForDisplay,
} from "@/lib/orderPaymentHistory";

export default function LinkedStatementPaymentCell({ order }) {
  const inv = String(
    order.invoice_number || order.active_invoice_number || "",
  ).trim();

  const lines =
    orderHasInvoiceNumber(order) && orderInvoiceHasPaymentLink(order)
      ? getOrderPaymentsLinkedToInvoice(order)
      : [];

  const total = lines.reduce((s, p) => {
    const n = Number(p.amount);
    return s + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  const formatAmt = (n) =>
    `₹${Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const bookingPaid =
    !orderInvoiceHasPaymentLink(order) &&
    allowNeworderPaymentAmountWithoutInvoiceLink(order)
      ? sumAdvanceRequestedForDisplay(order)
      : 0;

  const showPaymentDetails = lines.length > 0 || bookingPaid > 0;

  if (!inv && !showPaymentDetails) {
    return <span className="text-gray-400 text-xs">—</span>;
  }

  const hoverSummary = showPaymentDetails
    ? lines.length
      ? lines
          .map((p) => {
            const id = p.trans_id || "—";
            const d = p.date ? dayjs(p.date).format("DD-MM-YYYY") : "—";
            const amt =
              p.amount != null && Number(p.amount) > 0
                ? formatAmt(p.amount)
                : "—";
            return `ID: ${id} | Date: ${d} | Received: ${amt}`;
          })
          .join("\n")
      : `Order payment_amount: ${formatAmt(bookingPaid)}`
    : "";

  return (
    <div className="text-left text-xs min-w-[5rem]">
      <div className="relative inline-block group align-top">
        <span
          className={`text-gray-900 font-medium ${
            showPaymentDetails
              ? "border-b border-dotted border-gray-400 cursor-help"
              : ""
          }`}
          title={hoverSummary || undefined}
        >
          {inv ? (
            <>
              <span className="font-semibold text-gray-600">Inv No: </span>
              {inv}
            </>
          ) : bookingPaid > 0 ? (
            <span className="text-blue-800">Order payment</span>
          ) : showPaymentDetails ? (
            <span className="text-blue-800">Payment linked</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </span>

        {showPaymentDetails ? (
          <div
            className="pointer-events-none absolute left-0 bottom-full mb-1 z-[60] w-max max-w-[18rem] rounded-md border border-gray-200 bg-white px-3 py-2 shadow-lg text-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150"
            role="tooltip"
          >
            <div className="space-y-2">
              {lines.length ? (
                lines.map((p, idx) => (
                  <div
                    key={`${p.trans_id || idx}-${idx}`}
                    className={idx > 0 ? "pt-2 border-t border-gray-100" : ""}
                  >
                    <div className="truncate max-w-[16rem]" title={p.trans_id}>
                      <span className="font-semibold text-gray-600">ID:</span>{" "}
                      {p.trans_id || "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Date:</span>{" "}
                      {p.date ? dayjs(p.date).format("DD-MM-YYYY") : "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Received:</span>{" "}
                      {p.amount != null && Number(p.amount) > 0
                        ? formatAmt(p.amount)
                        : "—"}
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <span className="font-semibold text-gray-600">Amount:</span>{" "}
                  {formatAmt(bookingPaid)}
                </div>
              )}
              {lines.length > 1 && total > 0 ? (
                <div className="pt-1 border-t border-gray-200 font-semibold text-emerald-700">
                  Total: {formatAmt(total)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
