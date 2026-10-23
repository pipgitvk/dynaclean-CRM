"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import OrderDetails from "@/app/admin-dashboard/order/view/[order_id]/OrderDetails";

export default function PaymentPendingOrderDetailsModal({
  open,
  orderId,
  userRole,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;

    async function load() {
      try {
        setError("");
        setLoading(true);
        setData(null);
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}/view-data`,
        );
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Failed to load order");
        }
        if (!cancelled) setData(json.data);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to load order");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <div className="text-lg font-bold text-gray-900">
            Order Details{orderId ? ` — ${orderId}` : ""}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-700">
              <Loader2 size={20} className="animate-spin" />
              Loading order details...
            </div>
          ) : error ? (
            <div className="m-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : data ? (
            <OrderDetails data={data} userRole={userRole} />
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
