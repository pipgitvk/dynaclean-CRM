"use client";

import { formatCrmDateOnly } from "@/lib/crmDateFormat";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

function OrderList({ title, tone, orders, emptyText }) {
  const toneClasses =
    tone === "approved"
      ? "border-green-200 bg-green-50"
      : tone === "rejected"
        ? "border-red-200 bg-red-50"
        : tone === "cancelled"
          ? "border-amber-200 bg-amber-50"
          : "border-gray-200 bg-gray-50";

  const titleClasses =
    tone === "approved"
      ? "text-green-800"
      : tone === "rejected"
        ? "text-red-800"
        : tone === "cancelled"
          ? "text-amber-900"
          : "text-gray-800";

  return (
    <div className={`rounded-lg border p-3 ${toneClasses}`}>
      <h3 className={`mb-2 text-sm font-semibold ${titleClasses}`}>
        {title} ({orders.length})
      </h3>
      {orders.length === 0 ? (
        <p className="text-xs text-gray-500">{emptyText}</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {orders.map((o) => (
            <li
              key={`${tone}-${o.order_id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/80 px-2 py-1.5"
            >
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin-dashboard/order/${encodeURIComponent(o.order_id)}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  #{o.order_id}
                </Link>
                {o.quote_number ? (
                  <span className="text-xs text-gray-500">Q: {o.quote_number}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-600">
                {o.order_date ? (
                  <span>{formatCrmDateOnly(o.order_date)}</span>
                ) : null}
                <span className="font-medium text-gray-800">
                  ₹{Number(o.amount || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TargetChartOrdersModal({
  isOpen,
  onClose,
  employeeLabel,
  targetId,
  username,
  dateFrom,
  dateTo,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!isOpen || (!targetId && !username)) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const params = new URLSearchParams({
          startDate: dateFrom || "",
          endDate: dateTo || "",
          orders: "1",
        });
        if (targetId != null && targetId !== "") {
          params.set("targetId", String(targetId));
        } else if (username) {
          params.set("username", username);
        }
        const res = await fetch(`/api/target-completion?${params.toString()}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Failed to load orders");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, targetId, username, dateFrom, dateTo]);

  if (!isOpen) return null;

  const orders = data?.orders;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Orders — {employeeLabel}
            </h2>
            {data?.order_start && data?.order_end ? (
              <p className="mt-0.5 text-xs text-gray-500">
                {formatCrmDateOnly(data.order_start)} –{" "}
                {formatCrmDateOnly(data.order_end)} · Approved count toward
                target; rejected/cancelled excluded from achievement
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading orders…
            </div>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {!loading && !error && orders ? (
            <div className="space-y-3">
              <OrderList
                title="Approved (counted in target)"
                tone="approved"
                orders={orders.approved || []}
                emptyText="No approved orders in this period."
              />
              <OrderList
                title="Rejected (not counted)"
                tone="rejected"
                orders={orders.rejected || []}
                emptyText="No rejected orders."
              />
              <OrderList
                title="Cancelled (not counted)"
                tone="cancelled"
                orders={orders.cancelled || []}
                emptyText="No cancelled orders."
              />
              {(orders.pending || []).length > 0 ? (
                <OrderList
                  title="Pending / other"
                  tone="pending"
                  orders={orders.pending}
                  emptyText="—"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}