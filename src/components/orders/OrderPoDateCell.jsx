"use client";

import { useState } from "react";
import dayjs from "dayjs";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { canEditOrderPoDate } from "@/lib/orderPoDatePermissions";

export default function OrderPoDateCell({
  order,
  userRole,
  onUpdated,
  className = "",
}) {
  const canEdit = canEditOrderPoDate(userRole);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() =>
    order?.created_at ? dayjs(order.created_at).format("YYYY-MM-DD") : "",
  );
  const [saving, setSaving] = useState(false);

  const display = order?.created_at
    ? dayjs(order.created_at).format("DD-MM-YYYY")
    : "—";

  async function save() {
    if (!value.trim()) {
      alert("Order Date / PO Date is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.order_id}/po-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_date: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update order date");
        return;
      }
      setEditing(false);
      onUpdated?.(data.order_date);
    } catch {
      alert("Failed to update order date");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return <span className={className}>{display}</span>;
  }

  if (editing) {
    return (
      <div className={`flex flex-col gap-1 items-start ${className}`}>
        <TypeableDateFilterInput
          value={value}
          onChange={setValue}
          className="w-full min-w-[8rem] border border-gray-300 rounded px-2 py-1 text-sm"
        />
        <div className="flex gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setValue(
                order?.created_at
                  ? dayjs(order.created_at).format("YYYY-MM-DD")
                  : "",
              );
            }}
            className="text-xs px-2 py-0.5 border rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`text-left text-blue-700 hover:underline ${className}`}
      title="Edit Order Date / PO Date"
    >
      {display}
    </button>
  );
}

export function formatOrderPunchDate(order) {
  const raw = order?.punch_date || order?.created_at;
  if (!raw) return "—";
  return dayjs(raw).format("DD-MM-YYYY HH:mm");
}
