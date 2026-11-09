"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import WarehouseInRequestDetailsBlock from "@/components/forms/WarehouseInRequestDetailsBlock";
import WarehouseInReceiveItemRow from "@/components/forms/WarehouseInReceiveItemRow";
import {
  appendLineReceiptFields,
  appendSharedReceiptFields,
  CategoryBadge,
  itemLineKey,
} from "@/components/forms/warehouseInUi";
import {
  defaultReceiveQtyString,
  warehouseInQtyFields,
} from "@/lib/warehouseInQuantities";
import { ChevronDown, ExternalLink, Eye, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

function emptyLine(item) {
  return {
    receivedQty: defaultReceiveQtyString(item),
    location: "",
    receivedImage: null,
  };
}

function SupportingDocumentsField({
  supportingDocs,
  onAddFiles,
  onRemove,
  inputClass = "w-full border p-3 rounded bg-white text-base min-h-[44px]",
  layout = "inline",
}) {
  const isHeader = layout === "header";
  return (
    <div
      className={
        isHeader ? "" : "mt-3 pt-3 border-t border-gray-200/80"
      }
    >
      <label
        className={`block font-medium mb-1 ${
          isHeader ? "text-xs" : "text-sm"
        }`}
      >
        Supporting documents
      </label>
      <input
        type="file"
        accept=".pdf,image/*"
        multiple
        onChange={onAddFiles}
        className={inputClass}
      />
      <p className="text-xs text-gray-500 mt-1">
        Optional — invoice, delivery note, etc. (multiple files)
      </p>
      {supportingDocs.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-gray-700">
          {supportingDocs.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-2 bg-gray-50 px-2 py-2 rounded"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-red-600 shrink-0 text-sm px-1"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MobileItemCard({
  item,
  isSelected,
  onSelect,
  onView,
  line,
  onLineChange,
  viewOnly = false,
}) {
  const key = itemLineKey(item);
  const displayName = item.spare_name ?? item.product_name;
  const { requested, received, remaining } = warehouseInQtyFields(item);

  return (
    <article className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div
        className={`flex items-stretch gap-2 ${
          isSelected
            ? viewOnly
              ? "bg-blue-50"
              : "bg-green-50"
            : ""
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className={`flex-1 min-h-[56px] p-3 text-left active:bg-gray-100 ${
            viewOnly && isSelected ? "bg-blue-50" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            {item.product_image ? (
              <img
                src={item.product_image}
                alt=""
                className="w-12 h-12 shrink-0 object-cover rounded-lg border"
              />
            ) : (
              <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-100 border" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-900 line-clamp-2">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Req #{item.id} · Req {requested} · Recv {received} · Rem{" "}
                {remaining} · {item.product_code}
              </p>
              <CategoryBadge category={item.category} />
            </div>
            <ChevronDown
              className={`w-5 h-5 shrink-0 text-gray-400 transition-transform ${
                isSelected ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>
        {!viewOnly ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="shrink-0 w-14 flex items-center justify-center border-l border-gray-200 text-blue-700 active:bg-blue-50"
            aria-label="View details"
          >
            <Eye className="w-5 h-5" />
          </button>
        ) : null}
      </div>
      {viewOnly && isSelected ? (
        <div className="border-t border-blue-200 p-3 bg-blue-50/40">
          <WarehouseInRequestDetailsBlock
            item={item}
            showReceivedQuantity={false}
          />
        </div>
      ) : null}
      {!viewOnly && isSelected ? (
        <div className="border-t border-green-200 p-3 bg-green-50/40">
          <WarehouseInReceiveItemRow
            variant="compact"
            item={item}
            line={line}
            onLineChange={onLineChange}
            inputIdPrefix={`modal-m-${key}`}
          />
        </div>
      ) : null}
    </article>
  );
}

export default function WarehouseInReceiveModal({
  group,
  receivePageHref,
  onClose,
  onReceived,
  mode = "receive",
}) {
  const isViewOnly = mode === "view";
  const [selectedItemKey, setSelectedItemKey] = useState("");
  const [viewItem, setViewItem] = useState(null);
  const [receivedBy, setReceivedBy] = useState("");
  const [lineFields, setLineFields] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [formData, setFormData] = useState({
    received_date: new Date().toISOString().split("T")[0],
    warehouse_name: "",
    remarks: "",
  });

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setReceivedBy(data.username))
      .catch(() => setReceivedBy(""));
  }, []);

  useEffect(() => {
    if (!group) return;
    setSelectedItemKey(
      !isViewOnly && group.items.length === 1
        ? itemLineKey(group.items[0])
        : "",
    );
    const q = {};
    for (const item of group.items) {
      q[itemLineKey(item)] = emptyLine(item);
    }
    setLineFields(q);
    setSupportingDocs([]);
  }, [
    group?.groupKey,
    group?.items
      ?.map((i) => `${i.id}:${i.received_quantity ?? 0}:${i.quantity}`)
      .join(","),
    isViewOnly,
  ]);

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

  if (!group) return null;

  const selectedItem = group.items.find(
    (i) => itemLineKey(i) === selectedItemKey,
  );

  const updateLine = (item, patch) => {
    const key = itemLineKey(item);
    setLineFields((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || emptyLine(item)), ...patch },
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSelect = (key) => {
    setSelectedItemKey((prev) => (prev === key ? "" : key));
  };

  const fullFormHref =
    selectedItem && receivePageHref
      ? `${receivePageHref}?g=${encodeURIComponent(group.groupKey)}&item=${encodeURIComponent(selectedItemKey)}`
      : null;

  const handleReceiveStock = async () => {
    if (!selectedItem) {
      toast.error("Please select an item first");
      return;
    }
    if (!formData.warehouse_name) {
      toast.error("Please select a warehouse");
      return;
    }

    const key = itemLineKey(selectedItem);
    const line = lineFields[key] || emptyLine(selectedItem);

    if (!line.receivedImage) {
      toast.error("Received image required");
      return;
    }
    if (!String(line.location || "").trim()) {
      toast.error("Location required");
      return;
    }

    const qty = Number(line.receivedQty);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Please enter a valid received quantity");
      return;
    }
    const { remaining } = warehouseInQtyFields(selectedItem);
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
      if (selectedItem.__source === "product") {
        submitData.append(
          "bulk_items",
          JSON.stringify([
            { request_id: selectedItem.id, received_quantity: qty },
          ]),
        );
        res = await fetch("/api/warehouse-in", {
          method: "POST",
          body: submitData,
        });
      } else {
        submitData.append("request_id", String(selectedItem.id));
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
            : "Stock received!"),
      );
      setSelectedItemKey("");
      setSupportingDocs([]);
      onReceived?.();
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col bg-black/50 sm:items-center sm:justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col flex-1 min-h-0 w-full bg-white sm:flex-initial sm:rounded-xl sm:shadow-xl sm:max-w-5xl sm:max-h-[90vh] sm:flex-1">
          <div className="flex items-start justify-between border-b px-3 py-3 sm:px-5 sm:py-4 shrink-0">
            <div className="min-w-0 pr-2">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                {isViewOnly ? "View — " : ""}
                {group.kind === "invoice"
                  ? `Invoice ${group.invoice_number}`
                  : group.label}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">
                {group.itemCount} item{group.itemCount !== 1 ? "s" : ""} ·{" "}
                {group.from_company || "—"}
                {isViewOnly ? " · Read only" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 shrink-0"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {!isViewOnly ? (
            <div className="px-3 py-3 sm:px-5 border-b shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="hidden sm:block">
                <label className="block text-xs font-medium mb-1">
                  Received By
                </label>
                <input
                  value={receivedBy}
                  disabled
                  className="w-full border p-2 rounded bg-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Received Date *
                </label>
                <TypeableDateFilterInput
                  value={formData.received_date}
                  onChange={(v) =>
                    handleChange({
                      target: { name: "received_date", value: v },
                    })
                  }
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full border p-3 sm:p-2 rounded text-base sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Warehouse/Godown *
                </label>
                <select
                  name="warehouse_name"
                  value={formData.warehouse_name}
                  onChange={handleChange}
                  className="w-full border p-3 sm:p-2 rounded text-base sm:text-sm min-h-[44px]"
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
                <SupportingDocumentsField
                  layout="header"
                  supportingDocs={supportingDocs}
                  onAddFiles={handleSupportingDocsChange}
                  onRemove={removeSupportingDoc}
                  inputClass="w-full border p-2 sm:p-2 rounded bg-white text-sm min-h-[44px] sm:min-h-0"
                />
              </div>
            </div>
          ) : null}

          {!isViewOnly && group.items.length > 1 ? (
            <div className="px-3 pt-2 sm:hidden shrink-0">
              <label className="block text-xs font-medium mb-1">
                Quick select item
              </label>
              <select
                className="w-full border p-3 rounded-lg text-base min-h-[48px]"
                value={selectedItemKey}
                onChange={(e) => setSelectedItemKey(e.target.value)}
              >
                <option value="">— Select item —</option>
                {group.items.map((item) => (
                  <option key={itemLineKey(item)} value={itemLineKey(item)}>
                    #{item.id} · {item.product_name} (Qty {item.quantity})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 sm:p-4">
            <div className="md:hidden space-y-2 pb-2">
              {group.items.map((item) => {
                const key = itemLineKey(item);
                return (
                  <MobileItemCard
                    key={key}
                    item={item}
                    isSelected={selectedItemKey === key}
                    onSelect={() => toggleSelect(key)}
                    onView={() => setViewItem(item)}
                    line={lineFields[key] || emptyLine(item)}
                    onLineChange={(patch) => updateLine(item, patch)}
                    viewOnly={isViewOnly}
                  />
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-left sticky top-0">
                  <tr>
                    {!isViewOnly ? (
                      <th className="p-2 w-10" aria-label="View" />
                    ) : (
                      <th className="p-2 w-8" aria-hidden />
                    )}
                    <th className="p-2">Req #</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Image</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Code</th>
                    <th className="p-2">Req qty</th>
                    <th className="p-2">Received qty</th>
                    <th className="p-2">Remaining qty</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => {
                    const key = itemLineKey(item);
                    const isSelected = selectedItemKey === key;
                    const qty = warehouseInQtyFields(item);
                    return (
                      <Fragment key={key}>
                        <tr
                          className={`border-t transition-colors cursor-pointer ${
                            isSelected
                              ? isViewOnly
                                ? "bg-blue-50"
                                : "bg-green-50"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => toggleSelect(key)}
                        >
                          <td className="p-2 text-gray-400">
                            {isViewOnly ? (
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${
                                  isSelected ? "rotate-180" : ""
                                }`}
                                aria-hidden
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewItem(item);
                                }}
                                className="p-1.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                                title="View full details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                          <td className="p-2">{item.id}</td>
                          <td className="p-2">
                            <CategoryBadge category={item.category} />
                          </td>
                          <td className="p-2">
                            {item.product_image ? (
                              <img
                                src={item.product_image}
                                alt=""
                                className="w-10 h-10 object-cover rounded border"
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-2">{item.product_name}</td>
                          <td className="p-2 font-mono text-xs">
                            {item.product_code}
                          </td>
                          <td className="p-2">{qty.requested}</td>
                          <td className="p-2">{qty.received}</td>
                          <td className="p-2 font-medium text-amber-800">
                            {qty.remaining}
                          </td>
                        </tr>
                        {isSelected ? (
                          <tr
                            className={`border-t ${
                              isViewOnly ? "bg-blue-50/50" : "bg-green-50/50"
                            }`}
                          >
                            <td colSpan={9} className="p-3">
                              {isViewOnly ? (
                                <WarehouseInRequestDetailsBlock
                                  item={item}
                                  showReceivedQuantity={false}
                                />
                              ) : (
                                <>
                                  <WarehouseInReceiveItemRow
                                    variant="card"
                                    item={item}
                                    line={lineFields[key] || emptyLine(item)}
                                    onLineChange={(patch) =>
                                      updateLine(item, patch)
                                    }
                                    inputIdPrefix={`modal-${key}`}
                                  />
                                </>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t px-3 py-3 sm:px-5 sm:py-4 shrink-0 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:shadow-none">
            {!isViewOnly ? (
              <div className="hidden sm:flex flex-wrap gap-2">
                {fullFormHref ? (
                  <Link
                    href={fullFormHref}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded border text-xs text-gray-700 hover:bg-gray-50"
                    onClick={onClose}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Full form (optional)
                  </Link>
                ) : null}
              </div>
            ) : null}
            <div
              className={`flex flex-col sm:flex-row gap-2 w-full ${isViewOnly ? "sm:justify-end" : "sm:w-auto"}`}
            >
              {!isViewOnly ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleReceiveStock}
                  className="w-full sm:w-auto px-4 py-3.5 sm:py-2 rounded-lg bg-green-600 text-white text-base sm:text-sm font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-60 min-h-[48px]"
                >
                  {isSubmitting ? "Submitting…" : "Receive stock"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg border text-sm active:bg-gray-50"
              >
                Close
              </button>
              {!isViewOnly && fullFormHref ? (
                <Link
                  href={fullFormHref}
                  className="sm:hidden w-full text-center px-4 py-2 text-xs text-blue-700 underline"
                  onClick={onClose}
                >
                  Full form (optional)
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {viewItem && !isViewOnly ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/50 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-col flex-1 min-h-0 w-full bg-white sm:flex-initial sm:rounded-xl sm:max-w-2xl sm:max-h-[85vh] overflow-y-auto p-4 sm:p-5">
            <div className="flex justify-between items-start mb-3 shrink-0">
              <h4 className="font-bold text-gray-900">Request details</h4>
              <button
                type="button"
                onClick={() => setViewItem(null)}
                className="p-2.5 rounded-lg active:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <WarehouseInRequestDetailsBlock
                item={viewItem}
                showReceivedQuantity={false}
              />
            </div>
            <button
              type="button"
              onClick={() => setViewItem(null)}
              className="mt-4 w-full py-3 rounded-lg border text-base font-medium shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
