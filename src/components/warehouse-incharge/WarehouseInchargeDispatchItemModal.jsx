"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { loadDispatchFormRows } from "@/lib/loadDispatchFormRows";
import { isSpare1110 } from "@/lib/isSpare1110";
import { isServiceCharge } from "@/lib/dispatchSerialRules";
import {
  afterDispatchRowSaved,
  shouldSkipDispatchUploadForRow,
} from "@/lib/dispatchRowPersist";

function normCode(c) {
  return String(c ?? "").trim();
}

export default function WarehouseInchargeDispatchItemModal({
  open,
  onClose,
  orderId,
  itemCode,
  itemName,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const persistedRowIdsRef = useRef(new Set());
  const [initialSerialNos, setInitialSerialNos] = useState(new Set());
  const [stockInfo, setStockInfo] = useState({});
  const [zeroStockWarnings, setZeroStockWarnings] = useState({});

  const load = useCallback(async () => {
    if (!orderId || !itemCode) return;
    setLoading(true);
    try {
      const data = await loadDispatchFormRows(orderId, "first");
      const code = normCode(itemCode);
      const filtered = data.filter((r) => normCode(r.item_code) === code);
      setRows(filtered);
      const idsWithSerial = new Set(
        filtered.filter((r) => r.serial_no?.trim()).map((r) => r.id),
      );
      setInitialSerialNos(idsWithSerial);
      setSavedIds(idsWithSerial);
      filtered.forEach((row) => {
        if (row.godown && row.quote_number && row.item_code) {
          fetchStockForRow(row.id, row.quote_number, row.godown, row.item_code);
        }
      });
    } catch (e) {
      toast.error(e.message || "Could not load dispatch rows");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orderId, itemCode]);

  useEffect(() => {
    if (open) load();
    else {
      setRows([]);
      setSavedIds(new Set());
      persistedRowIdsRef.current = new Set();
    }
  }, [open, load]);

  const fetchStockForRow = async (rowId, quoteNumber, godown, code) => {
    try {
      const res = await fetch("/api/stock/check-single-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_number: quoteNumber,
          godown,
          item_code: code,
        }),
      });
      const json = await res.json().catch(() => ({}));
      const list = json.stockResults || [];
      setStockInfo((prev) => ({ ...prev, [rowId]: list }));
      const hasZero =
        !json.allowZeroStock &&
        !isSpare1110(code) &&
        list.some((item) => !item.stock_count || item.stock_count <= 0);
      setZeroStockWarnings((prev) => ({ ...prev, [rowId]: hasZero }));
    } catch {
      setStockInfo((prev) => ({ ...prev, [rowId]: [] }));
    }
  };

  const updateField = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
    if (field === "godown") {
      const row = rows.find((r) => r.id === id);
      if (row?.quote_number && row?.item_code && value) {
        fetchStockForRow(id, row.quote_number, value, row.item_code);
      }
    }
  };

  const uploadForRow = async (row) => {
    const form = new FormData();
    form.append("id", row.id);
    if (row.serial_no) form.append("serial_no", row.serial_no);
    if (row.remarks) form.append("remarks", row.remarks);
    if (row.godown) form.append("godown", row.godown);
    for (const key of ["_frontPhoto", "_backPhoto", "_rightPhoto", "_leftPhoto"]) {
      if (row[key]) form.append("photos", row[key]);
    }
    if (!row.godown) throw new Error("Select godown");
    if (
      zeroStockWarnings[row.id] &&
      !isSpare1110(row.item_code) &&
      !isServiceCharge(row.item_name, row.item_code)
    ) {
      throw new Error("Stock is 0 in selected godown");
    }
    if (!row.serial_no?.trim()) throw new Error("Serial number required");

    const res = await fetch("/api/dispatch/update", { method: "POST", body: form });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Save failed");
    }
    afterDispatchRowSaved(row.id, setSavedIds, setRows, persistedRowIdsRef);
  };

  const saveRow = async (row) => {
    if (
      shouldSkipDispatchUploadForRow(
        row,
        initialSerialNos,
        savedIds,
        persistedRowIdsRef,
      )
    ) {
      toast.success("Already saved");
      return;
    }
    setSavingId(row.id);
    try {
      await uploadForRow(row);
      toast.success("Saved");
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-xl">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Fill dispatch details</h3>
            <p className="text-xs text-gray-500 mt-0.5">Order #{orderId}</p>
            <p className="text-sm text-gray-800 mt-1">
              <span className="font-medium text-gray-600">Product name:</span>{" "}
              <span className="font-medium">{itemName || "—"}</span>
            </p>
            <p className="text-sm text-gray-800">
              <span className="font-medium text-gray-600">Product code:</span>{" "}
              <span className="font-mono">{itemCode || "—"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No active dispatch units for this item.</p>
          ) : (
            rows.map((r, idx) => (
              <div key={r.id} className="border rounded-lg p-3 space-y-3">
                <p className="text-xs font-medium text-gray-500">Unit {idx + 1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Serial no *</label>
                    <input
                      className="mt-1 w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                      value={r.serial_no || ""}
                      disabled={initialSerialNos.has(r.id)}
                      onChange={(e) => updateField(r.id, "serial_no", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Godown *</label>
                    <select
                      className="mt-1 w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                      value={r.godown || ""}
                      disabled={initialSerialNos.has(r.id)}
                      onChange={(e) => updateField(r.id, "godown", e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Delhi - Mundka">Delhi - Mundka</option>
                      <option value="Tamil_Nadu - Coimbatore">Tamil_Nadu - Coimbatore</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-600">Remarks</label>
                    <input
                      className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                      value={r.remarks || ""}
                      disabled={initialSerialNos.has(r.id)}
                      onChange={(e) => updateField(r.id, "remarks", e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-600">Photos (front, back, right, left)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "_frontPhoto", label: "Front" },
                    { key: "_backPhoto", label: "Back" },
                    { key: "_rightPhoto", label: "Right" },
                    { key: "_leftPhoto", label: "Left" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <span className="text-[10px] text-gray-500">{label}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="block w-full text-xs mt-0.5"
                        disabled={initialSerialNos.has(r.id)}
                        onChange={(e) =>
                          updateField(
                            r.id,
                            key,
                            e.target.files?.[0] || null,
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                {zeroStockWarnings[r.id] && !isSpare1110(r.item_code) && (
                  <p className="text-xs text-red-600">No stock in selected godown</p>
                )}
                {!initialSerialNos.has(r.id) && (
                  <button
                    type="button"
                    disabled={savingId === r.id}
                    onClick={() => saveRow(r)}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingId === r.id ? "Saving…" : "Save unit"}
                  </button>
                )}
                {initialSerialNos.has(r.id) && (
                  <p className="text-xs text-green-700">Unit already dispatched</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
