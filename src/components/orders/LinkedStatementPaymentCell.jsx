"use client";

import dayjs from "dayjs";
import {
  getOrderPaymentsForDisplay,
  orderHasInvoiceNumber,
  orderInvoiceHasPaymentLink,
} from "@/lib/orderLinkedPaymentsDisplay";

export default function LinkedStatementPaymentCell({ order }) {
  const inv = String(
    order.invoice_number || order.active_invoice_number || "",
  ).trim();
  const lines = getOrderPaymentsForDisplay(order);
  const totalFromLines = lines.reduce((s, p) => s + Number(p.amount || 0), 0);
  const received = Number(order.amount_received);
  const hasInvoice = orderHasInvoiceNumber(order);
  const hasPaymentLink = orderInvoiceHasPaymentLink(order);
  const total = hasInvoice
    ? totalFromLines
    : Number.isFinite(received) && received > 0
      ? received
      : totalFromLines;

  if (!inv && !lines.length && !(total > 0)) {
    return <span className="text-gray-400 text-xs">—</span>;
  }

  const formatAmt = (n) =>
    `₹${Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Invoice without Link Payment → show inv no only, hide Received amounts
  const showPaymentDetails =
    (!hasInvoice && (lines.length > 0 || total > 0)) ||
    (hasInvoice && hasPaymentLink && lines.length > 0);

  const hoverSummary = lines.length
    ? lines
        .map((p) => {
          const id = p.trans_id || "—";
          const d = p.date ? dayjs(p.date).format("DD-MM-YYYY") : "—";
          return `ID: ${id} | Date: ${d} | Received: ${formatAmt(p.amount || 0)}`;
        })
        .join("\n")
    : !inv && total > 0
      ? `Received: ${formatAmt(total)}`
      : "";

  const label = inv || "Payment linked";

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
          ) : (
            <span className="text-blue-800">{label}</span>
          )}
        </span>

        {showPaymentDetails ? (
          <div
            className="pointer-events-none absolute left-0 bottom-full mb-1 z-[60] w-max max-w-[18rem] rounded-md border border-gray-200 bg-white px-3 py-2 shadow-lg text-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150"
            role="tooltip"
          >
            {lines.length > 0 ? (
              <div className="space-y-2">
                {lines.map((p, idx) => (
                  <div
                    key={`${p.statement_id || p.trans_id || idx}-${idx}`}
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
                      <span className="font-semibold text-gray-600">
                        Received:
                      </span>{" "}
                      {formatAmt(p.amount || 0)}
                    </div>
                  </div>
                ))}
                {lines.length > 1 && total > 0 ? (
                  <div className="pt-1 border-t border-gray-200 font-semibold text-emerald-700">
                    Total: {formatAmt(total)}
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <span className="font-semibold text-gray-600">Received:</span>{" "}
                {total > 0 ? formatAmt(total) : "—"}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
