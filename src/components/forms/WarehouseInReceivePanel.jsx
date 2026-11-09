"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import WarehouseInRequestDetailsBlock from "@/components/forms/WarehouseInRequestDetailsBlock";
import WarehouseInReceiveItemRow from "@/components/forms/WarehouseInReceiveItemRow";
import {
  appendLineReceiptFields,
  appendSharedReceiptFields,
  itemLineKey,
} from "@/components/forms/warehouseInUi";
import {
  defaultReceiveQtyString,
  warehouseInQtyFields,
} from "@/lib/warehouseInQuantities";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";

function emptyLine(item) {
  return {
    receivedQty: defaultReceiveQtyString(item),
    location: "",
    receivedImage: null,
  };
}

export default function WarehouseInReceivePanel({
  group,
  onSuccess,
  onCancel,
  showHeader = true,
  initialItemKey = null,
  lockItemSelection = false,
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [lineFields, setLineFields] = useState({});
  const [formData, setFormData] = useState({
    received_date: new Date().toISOString().split("T")[0],
    warehouse_name: "",
    remarks: "",
  });
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = group?.items ?? [];

  const activeItems = useMemo(() => {
    if (lockItemSelection && initialItemKey) {
      const one = items.find((i) => itemLineKey(i) === initialItemKey);
      return one ? [one] : [];
    }
    if (selectedKey) {
      const one = items.find((i) => itemLineKey(i) === selectedKey);
      return one ? [one] : [];
    }
    return [];
  }, [items, selectedKey, initialItemKey, lockItemSelection]);

  const headerItem = activeItems[0] ?? null;

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setReceivedBy(data.username))
      .catch(() => setReceivedBy(""));
  }, []);

  useEffect(() => {
    if (!group || items.length === 0) {
      setSelectedKey("");
      return;
    }
    if (
      initialItemKey &&
      items.some((i) => itemLineKey(i) === initialItemKey)
    ) {
      setSelectedKey(initialItemKey);
      return;
    }
    if (items.length === 1) {
      setSelectedKey(itemLineKey(items[0]));
      return;
    }
    if (!lockItemSelection) {
      setSelectedKey("");
    }
  }, [
    group?.groupKey,
    items
      .map((i) => `${i.id}:${i.received_quantity ?? 0}:${i.quantity}`)
      .join(","),
    initialItemKey,
    lockItemSelection,
  ]);

  useEffect(() => {
    if (activeItems.length === 0) return;
    setLineFields((prev) => {
      const next = { ...prev };
      for (const item of activeItems) {
        const key = itemLineKey(item);
        if (!next[key]) {
          next[key] = emptyLine(item);
        }
      }
      return next;
    });
  }, [activeItems.map((i) => itemLineKey(i)).join(",")]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const updateLine = (item, patch) => {
    const key = itemLineKey(item);
    setLineFields((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || emptyLine(item)), ...patch },
    }));
  };

  const handleSupportingDocsChange = (e) => {
    const list = Array.from(e.target.files || []);
    const valid = [];
    for (const file of list) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: max 5MB`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length) {
      setSupportingDocs((prev) => [...prev, ...valid]);
    }
    e.target.value = "";
  };

  const removeSupportingDoc = (index) => {
    setSupportingDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || activeItems.length === 0) {
      if (activeItems.length === 0) {
        toast.error("Please select a product / item");
      }
      return;
    }

    const item = activeItems[0];
    const key = itemLineKey(item);
    const line = lineFields[key] || emptyLine(item);

    if (!line.receivedImage) {
      toast.error("Received image is mandatory for this item");
      return;
    }
    if (!String(line.location || "").trim()) {
      toast.error("Location is required for this item");
      return;
    }

    const qty = Number(line.receivedQty);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Enter valid received quantity");
      return;
    }
    const { remaining } = warehouseInQtyFields(item);
    if (qty > remaining) {
      toast.error(`You can receive at most ${remaining} (remaining quantity)`);
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = new FormData();
      appendSharedReceiptFields(submitData, formData, supportingDocs);
      appendLineReceiptFields(submitData, {
        location: line.location.trim(),
        receivedImage: line.receivedImage,
      });

      let res;
      if (item.__source === "product") {
        submitData.append(
          "bulk_items",
          JSON.stringify([{ request_id: item.id, received_quantity: qty }]),
        );
        res = await fetch("/api/warehouse-in", {
          method: "POST",
          body: submitData,
        });
      } else {
        submitData.append("request_id", String(item.id));
        submitData.append("received_quantity", String(qty));
        res = await fetch("/api/spare/warehouse-in", {
          method: "POST",
          body: submitData,
        });
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Failed to process receipt");
        return;
      }

      toast.success(
        json.message ||
          (json.stock_added
            ? `${json.stock_added} qty added to spare/stock`
            : "Stock received successfully!"),
      );
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!group) return null;

  const title =
    group.kind === "invoice"
      ? `Invoice ${group.invoice_number}`
      : group.label;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-warehouse-in-receive
    >
      {showHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Warehouse In - Receive Stock
            </h3>
            <p className="text-sm text-gray-600">{title}</p>
          </div>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded hover:bg-gray-100 shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {items.length > 1 && !lockItemSelection ? (
        <div>
          <label className="block mb-1 font-medium">
            Select product / item *
          </label>
          <select
            className="w-full border p-2 rounded bg-white"
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            required
          >
            <option value="">— Choose product —</option>
            {items.map((item) => {
              const q = warehouseInQtyFields(item);
              return (
                <option key={itemLineKey(item)} value={itemLineKey(item)}>
                  Req #{item.id} · {item.product_name} ({item.product_code}) ·
                  Rem {q.remaining}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}

      {headerItem ? (
        <WarehouseInRequestDetailsBlock
          item={headerItem}
          hideLineItemFields
          showReceivedQuantity={false}
        />
      ) : (
        <p className="text-sm text-gray-500">Select an item to continue.</p>
      )}

      {headerItem ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Received By</label>
              <input
                value={receivedBy}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Received Date *</label>
              <TypeableDateFilterInput
                value={formData.received_date}
                onChange={(v) =>
                  handleChange({ target: { name: "received_date", value: v } })
                }
                max={new Date().toISOString().split("T")[0]}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Warehouse/Godown *</label>
              <select
                name="warehouse_name"
                value={formData.warehouse_name}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              >
                <option value="">Select Warehouse</option>
                <option value="Delhi - Mundka">Delhi - Mundka</option>
                <option value="Tamil_Nadu - Coimbatore">
                  Tamil_Nadu - Coimbatore
                </option>
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium">
                Supporting documents
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={handleSupportingDocsChange}
                className="w-full border p-2 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: invoice, delivery note, etc. (multiple files allowed)
              </p>
              {supportingDocs.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-gray-700">
                  {supportingDocs.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 bg-gray-50 px-2 py-1 rounded"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeSupportingDoc(i)}
                        className="text-red-600 shrink-0"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <label className="block mb-1 font-medium">Remarks/Notes</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              rows={3}
              placeholder="Any additional notes about the received stock..."
            />
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">
              Item receive details
            </h4>

            <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-left text-gray-600">
                  <tr>
                    <th className="p-3 font-semibold">Name</th>
                    <th className="p-3 font-semibold w-20 text-center">Req</th>
                    <th className="p-3 font-semibold w-20 text-center">Recv</th>
                    <th className="p-3 font-semibold w-20 text-center">Rem</th>
                    <th className="p-3 font-semibold w-32">This receive *</th>
                    <th className="p-3 font-semibold">Location *</th>
                    <th className="p-3 font-semibold">Received image *</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map((item) => {
                    const key = itemLineKey(item);
                    return (
                      <WarehouseInReceiveItemRow
                        key={key}
                        variant="table-row"
                        item={item}
                        line={lineFields[key] || emptyLine(item)}
                        onLineChange={(patch) => updateLine(item, patch)}
                        inputIdPrefix={`wi-${key}`}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {activeItems.map((item) => {
                const key = itemLineKey(item);
                return (
                  <WarehouseInReceiveItemRow
                    key={key}
                    variant="card"
                    item={item}
                    line={lineFields[key] || emptyLine(item)}
                    onLineChange={(patch) => updateLine(item, patch)}
                    inputIdPrefix={`wi-${key}`}
                  />
                );
              })}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> After submitting, this request will be
              marked as fulfilled and stock quantities will be updated in the
              system.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded border text-sm"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-60 text-sm"
            >
              {isSubmitting ? "Submitting…" : "Confirm receipt & update stock"}
            </button>
          </div>
        </>
      ) : null}
    </form>
  );
}
