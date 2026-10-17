"use client";

import dayjs from "dayjs";
import { parseOrderLinkedPayments } from "@/lib/orderLinkedPaymentsDisplay";

export default function LinkedStatementPaymentCell({ order }) {
  const inv = String(order.invoice_number || "").trim();
  const lines = parseOrderLinkedPayments(order);
  const received = Number(order.amount_received);
  const totalFromLines = lines.reduce((s, p) => s + Number(p.amount || 0), 0);
  const total =
    Number.isFinite(received) && received > 0 ? received : totalFromLines;

  if (!inv && !lines.length && !(total > 0)) {
    return <span className="text-gray-400 text-xs">—</span>;
  }

  const formatAmt = (n) =>
    `₹${Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="text-left text-xs space-y-1 min-w-[8.5rem]">
      <div>
        <span className="font-semibold text-gray-600">Inv No:</span>{" "}
        <span className="text-gray-900">{inv || "—"}</span>
      </div>
      {lines.length > 0 ? (
        <div className="space-y-1 border-l-2 border-emerald-200 pl-2">
          {lines.map((p, idx) => (
            <div
              key={`${p.statement_id || p.trans_id || idx}-${idx}`}
              className="space-y-0.5"
            >
              {p.trans_id ? (
                <div
                  className="text-gray-500 truncate max-w-[10rem]"
                  title={p.trans_id}
                >
                  ID: {p.trans_id}
                </div>
              ) : null}
              <div>
                <span className="font-semibold text-gray-600">Date:</span>{" "}
                {p.date ? dayjs(p.date).format("DD-MM-YYYY") : "—"}
              </div>
              <div>
                <span className="font-semibold text-gray-600">Received:</span>{" "}
                {formatAmt(p.amount)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <span className="font-semibold text-gray-600">Received:</span>{" "}
          {total > 0 ? formatAmt(total) : "—"}
        </div>
      )}
      {lines.length > 1 && total > 0 ? (
        <div className="pt-0.5 border-t border-gray-200 font-semibold text-emerald-700">
          Total: {formatAmt(total)}
        </div>
      ) : null}
    </div>
  );
}
