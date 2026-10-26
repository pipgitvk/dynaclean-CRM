"use client";

import { useState } from "react";
import toast from "react-hot-toast";

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * After order invoice report upload — link party payment (In) to order or unsettle statements.
 */
export default function PartyPaymentOrderLinkModal({
  open,
  prompt,
  orderId,
  onDone,
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!open || !prompt) return null;

  const submit = async (decision) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/party-payments/order-link-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          party_payment_id: prompt.party_payment_id,
          order_id: orderId,
          decision,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      if (decision === "yes") {
        toast.success(
          `Order payment updated (${formatInr(data.order_payment_amount)}). Party Out: ${formatInr(data.amount_out)}`,
        );
      } else {
        toast.success("Payment unlinked — statements marked unsettled.");
      }
      onDone?.();
    } catch (err) {
      toast.error(err.message || "Could not update payment link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Party payment already linked
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Customer <strong>{prompt.party_name || prompt.customer_id}</strong> ke
          liye party payment (#{prompt.party_payment_id}) statements se pehle se
          link hai ({prompt.statement_count} statement
          {prompt.statement_count === 1 ? "" : "s"}).
        </p>
        <ul className="text-sm text-gray-700 space-y-1 mb-4 bg-gray-50 rounded-lg p-3">
          <li>Statement pool (In): <strong>{formatInr(prompt.amount_in)}</strong></li>
          <li>
            Party balance (In − Out):{" "}
            <strong>{formatInr(prompt.party_balance ?? prompt.amount_in)}</strong>
          </li>
          <li>Order total: <strong>{formatInr(prompt.order_total)}</strong></li>
          <li>
            Is order par apply (min order, balance):{" "}
            <strong>
              {formatInr(
                prompt.apply_amount ??
                  (prompt.order_total > 0
                    ? prompt.order_total
                    : prompt.payment_amount),
              )}
            </strong>
            {prompt.payment_id ? ` · UTR: ${prompt.payment_id}` : ""}
          </li>
        </ul>
        <p className="text-sm text-gray-600 mb-5">
          <strong>Yes</strong> — order par <strong>Payment Amount / UTR / Date</strong> statement
          link jaisa set hoga; party payment <strong>Out</strong> = order total; invoice sync
          bhi chalega.
          <br />
          <strong>No</strong> — statements <strong>unsettled</strong> ho jayengi
          (payment link hata di jayegi).
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit("no")}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            No, unsettle
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit("yes")}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Yes, link to order"}
          </button>
        </div>
      </div>
    </div>
  );
}
