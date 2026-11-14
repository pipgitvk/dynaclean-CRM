"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import PaymentLinkModal from "@/app/user-dashboard/invoices/new/PaymentLinkModal";

/**
 * Payment-pending report: link bank credit statements to order (invoice flow when present).
 */
export default function PaymentPendingOrderLinkModal({
  open,
  onClose,
  order,
  onLinked,
}) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);

  useEffect(() => {
    if (!open || !order?.order_id) {
      setInvoiceNumber("");
      return;
    }
    let cancelled = false;
    setLoadingMeta(true);
    fetch(
      `/api/orders/active-invoice?order_id=${encodeURIComponent(order.order_id)}`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.found && data.invoice_number) {
          setInvoiceNumber(String(data.invoice_number).trim());
        } else {
          setInvoiceNumber("");
        }
      })
      .catch(() => {
        if (!cancelled) setInvoiceNumber("");
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, order?.order_id]);

  const lockedTransIds = useMemo(() => {
    const ids = new Set();
    for (const line of order?.payment_lines || []) {
      const ref = String(line?.ref || "").trim();
      if (ref) ids.add(ref);
    }
    return [...ids];
  }, [order]);

  const pendingAmount = Math.max(0, Number(order?.remaining_amount) || 0);
  const orderTotal = Number(order?.total_amount) || 0;

  const handleApply = async (transIds, _paymentStatus, _amountPaid) => {
    if (!order?.order_id) return;
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(order.order_id)}/statement-payment-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ trans_ids: transIds }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Link failed");

      const added = Number(data.added) || 0;
      if (added === 0) {
        toast(data.message || "No new payments to add");
      } else {
        toast.success(
          `${added} payment${added === 1 ? "" : "s"} linked to order ${order.order_id}`,
        );
      }
      onLinked?.(data);
    } catch (err) {
      toast.error(err.message || "Could not link payment");
      throw err;
    }
  };

  if (!open || !order) return null;

  if (loadingMeta) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-lg bg-white px-6 py-4 text-sm text-gray-700 shadow-xl">
          Loading invoice details…
        </div>
      </div>
    );
  }

  if (!order.customer_id) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-w-md w-full rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Link</h3>
          <p className="text-sm text-gray-600 mb-4">
            No customer ID was found for order{" "}
            <strong>{order.order_id}</strong>. Match the contact phone in
            Customer master and ensure a customer ID is assigned.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pendingAmount <= 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-w-md w-full rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Link</h3>
          <p className="text-sm text-gray-600 mb-4">
            Order <strong>{order.order_id}</strong> has no pending balance left
            to link.
            {orderTotal > 0 ? (
              <>
                {" "}
                Order total: ₹{orderTotal.toLocaleString("en-IN")}.
              </>
            ) : null}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PaymentLinkModal
      open={open}
      onClose={onClose}
      defaultCustomerId={String(order.customer_id)}
      defaultAmount={pendingAmount}
      amountFieldLabel="Pending balance (₹)"
      maxSelectHint="Select credit statements up to the pending balance only."
      lockedTransIds={lockedTransIds}
      currentInvoiceNumber={invoiceNumber}
      applyButtonLabel="Save to Order"
      suppressApplySuccessToast
      onApply={handleApply}
    />
  );
}