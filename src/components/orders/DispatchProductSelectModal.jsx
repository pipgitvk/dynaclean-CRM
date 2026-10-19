"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

export default function DispatchProductSelectModal({
  open,
  orderId,
  nextHref,
  onClose,
  title = "Select products to dispatch",
  confirmLabel = "Continue to dispatch",
  partialHint = "Partial Dispatch",
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState([]);
  const [selected, setSelected] = useState({});
  const [qty, setQty] = useState({});

  const load = useCallback(async () => {
    if (!open || !orderId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/dispatch/order-items?order_id=${encodeURIComponent(orderId)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load products");
      }
      const rows = data.lines || [];
      setLines(rows);
      const sel = {};
      const q = {};
      rows.forEach((l) => {
        sel[l.item_code] = true;
        q[l.item_code] = l.pending_qty;
      });
      setSelected(sel);
      setQty(q);
    } catch (e) {
      setError(e?.message || "Failed to load");
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [open, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (code) => {
    setSelected((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const handleConfirm = async () => {
    const items = lines
      .filter((l) => selected[l.item_code])
      .map((l) => ({
        item_code: l.item_code,
        item_name: l.item_name,
        quantity: Math.min(
          l.pending_qty,
          Math.max(1, Number(qty[l.item_code]) || 1),
        ),
      }));
    if (!items.length) {
      setError("Select at least one product");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dispatch/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to prepare dispatch");
      }
      onClose?.();
      router.push(nextHref);
      router.refresh();
    } catch (e) {
      setError(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const totalPending = lines.reduce((s, l) => s + l.pending_qty, 0);
  const selectedTotal = lines
    .filter((l) => selected[l.item_code])
    .reduce(
      (s, l) =>
        s + Math.min(l.pending_qty, Math.max(1, Number(qty[l.item_code]) || 1)),
      0,
    );
  const willBePartial = selectedTotal < totalPending;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : lines.length === 0 ? (
            <p className="text-sm text-gray-600">
              No pending products to dispatch for this order.
            </p>
          ) : (
            <ul className="space-y-3">
              {lines.map((l) => (
                <li
                  key={l.item_code}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected[l.item_code])}
                    onChange={() => toggle(l.item_code)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{l.item_name || l.item_code}</p>
                    <p className="text-xs text-gray-500">
                      Code: {l.item_code} · Pending: {l.pending_qty}
                      {l.dispatched_qty > 0
                        ? ` (${l.dispatched_qty} already dispatched)`
                        : ""}
                    </p>
                  </div>
                  {selected[l.item_code] && l.pending_qty > 1 && (
                    <label className="flex items-center gap-1 text-sm">
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={l.pending_qty}
                        value={qty[l.item_code] ?? l.pending_qty}
                        onChange={(e) =>
                          setQty((prev) => ({
                            ...prev,
                            [l.item_code]: e.target.value,
                          }))
                        }
                        className="w-16 rounded border px-2 py-1"
                      />
                    </label>
                  )}
                </li>
              ))}
            </ul>
          )}
          {willBePartial && lines.length > 0 && (
            <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Not all products selected — order status will be{" "}
              <strong>{partialHint}</strong>.
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving || loading || lines.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
