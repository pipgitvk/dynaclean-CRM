"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Search, X } from "lucide-react";
import toast from "react-hot-toast";

const inputClass =
  "h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

const selectClass =
  "h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

function emptyDraft() {
  return {
    tempId: `po-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    po_number: "",
    supplier_id: "",
    po_date: "",
    currency: "INR",
    total_value: "",
    remarks: "",
  };
}

function formatTableDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNotesPreview(text, maxLen = 48) {
  if (text == null || String(text).trim() === "") return "—";
  const s = String(text).replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

export default function PurchaseOrdersListClient() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableBusy, setTableBusy] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [draftLines, setDraftLines] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [resPo, resSup] = await Promise.all([
        fetch("/api/import-crm/purchase-orders"),
        fetch("/api/import-crm/suppliers"),
      ]);
      const dataPo = await resPo.json();
      const dataSup = await resSup.json();
      if (!resPo.ok) throw new Error(dataPo.message || "Failed to load orders");
      if (!resSup.ok) throw new Error(dataSup.message || "Failed to load suppliers");
      setOrders(dataPo.purchase_orders || []);
      setSuppliers(dataSup.suppliers || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addDraftLine = useCallback(() => {
    setDraftLines((prev) => [...prev, emptyDraft()]);
  }, []);

  const openDrawer = useCallback(() => {
    if (suppliers.length === 0) {
      toast.error("Add at least one supplier first.");
      return;
    }
    setDrawerOpen(true);
    setDraftLines((prev) =>
      prev.length === 0 ? [...prev, emptyDraft()] : prev,
    );
  }, [suppliers.length]);

  const removeDraftLine = useCallback((tempId) => {
    setDraftLines((prev) => prev.filter((d) => d.tempId !== tempId));
  }, []);

  const updateDraft = useCallback((tempId, field, value) => {
    setDraftLines((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d)),
    );
  }, []);

  const clearAllDrafts = useCallback(() => {
    setDraftLines([]);
  }, []);

  const saveAllDrafts = useCallback(async () => {
    const toSave = draftLines.filter(
      (d) =>
        d.po_number.trim() &&
        d.po_date &&
        d.supplier_id !== "" &&
        Number(d.supplier_id) > 0,
    );
    if (toSave.length === 0) {
      toast.error(
        "Each row needs PO number, supplier, and PO date before saving.",
      );
      return;
    }
    setSaveLoading(true);
    const savedTempIds = [];
    let firstError = null;
    try {
      for (const d of toSave) {
        const res = await fetch("/api/import-crm/purchase-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            po_number: d.po_number.trim(),
            supplier_id: Number(d.supplier_id),
            po_date: d.po_date,
            currency: (d.currency || "INR").trim() || "INR",
            total_value:
              d.total_value === "" || d.total_value == null
                ? 0
                : Number(d.total_value),
            remarks: d.remarks.trim() || null,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          savedTempIds.push(d.tempId);
        } else {
          firstError = firstError || data.message || "Could not save";
        }
      }
      if (savedTempIds.length > 0) {
        toast.success(
          savedTempIds.length === 1
            ? "Purchase order saved"
            : `${savedTempIds.length} purchase orders saved`,
        );
        const nextDrafts = draftLines.filter(
          (d) => !savedTempIds.includes(d.tempId),
        );
        setDraftLines(nextDrafts);
        if (nextDrafts.length === 0) setDrawerOpen(false);
        setTableBusy(true);
        await loadAll();
        setTableBusy(false);
      }
      if (firstError) toast.error(firstError);
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaveLoading(false);
    }
  }, [draftLines, loadAll]);

  const filteredOrders = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((p) => {
      const blob = [
        p.id,
        p.po_number,
        p.supplier_name,
        p.currency,
        p.remarks,
        p.po_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [orders, searchText]);

  const hasFilter = searchText.trim().length > 0;

  const tableHeaders = [
    "ID",
    "PO number",
    "Supplier",
    "PO date",
    "Currency",
    "Total",
    "Remarks",
    "Created",
  ];

  return (
    <>
      {suppliers.length === 0 ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Add at least one supplier before creating a purchase order.{" "}
          <Link
            href="/admin-dashboard/import-crm/suppliers"
            className="font-semibold underline decoration-amber-700/50 underline-offset-2 hover:text-amber-900"
          >
            Go to Suppliers
          </Link>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search PO number, supplier, currency, remarks, or ID"
              autoComplete="off"
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={openDrawer}
          disabled={suppliers.length === 0}
          className="h-11 w-full shrink-0 rounded-[10px] bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0 sm:w-auto sm:min-w-[10.5rem]"
        >
          Add purchase order
        </button>
      </div>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        transition
        className="relative z-[200]"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-slate-900/40 transition duration-300 ease-out data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex justify-end overflow-hidden">
          <DialogPanel
            transition
            className="flex h-full w-full max-w-lg transform flex-col border-l border-slate-200 bg-white shadow-2xl transition duration-300 ease-out data-[closed]:translate-x-full"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0 pt-0.5">
                <DialogTitle className="text-base font-semibold text-slate-900">
                  New purchase orders
                </DialogTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  {draftLines.length} row{draftLines.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearAllDrafts();
                    setDrawerOpen(false);
                  }}
                  className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                >
                  Clear & close
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close panel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <div className="space-y-4">
                {draftLines.map((d, idx) => (
                  <div
                    key={d.tempId}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        Row {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDraftLine(d.tempId)}
                        className="inline-flex items-center gap-1 rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                        aria-label="Remove row"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          PO number *
                        </label>
                        <input
                          type="text"
                          className={inputClass}
                          value={d.po_number}
                          onChange={(e) =>
                            updateDraft(d.tempId, "po_number", e.target.value)
                          }
                          placeholder="Required"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Supplier *
                        </label>
                        <select
                          className={selectClass}
                          value={d.supplier_id}
                          onChange={(e) =>
                            updateDraft(
                              d.tempId,
                              "supplier_id",
                              e.target.value,
                            )
                          }
                        >
                          <option value="">Select supplier</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.supplier_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          PO date *
                        </label>
                        <input
                          type="date"
                          className={inputClass}
                          value={d.po_date}
                          onChange={(e) =>
                            updateDraft(d.tempId, "po_date", e.target.value)
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Currency
                          </label>
                          <input
                            type="text"
                            className={inputClass}
                            placeholder="INR"
                            value={d.currency}
                            onChange={(e) =>
                              updateDraft(d.tempId, "currency", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Total value
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={inputClass}
                            value={d.total_value}
                            onChange={(e) =>
                              updateDraft(
                                d.tempId,
                                "total_value",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Remarks
                        </label>
                        <textarea
                          rows={2}
                          className={`${inputClass} min-h-[2.75rem] py-2`}
                          value={d.remarks}
                          onChange={(e) =>
                            updateDraft(d.tempId, "remarks", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saveLoading || suppliers.length === 0}
                  onClick={saveAllDrafts}
                  className="h-10 rounded-[10px] bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saveLoading ? "Saving…" : "Save to table"}
                </button>
                <button
                  type="button"
                  onClick={addDraftLine}
                  className="h-10 rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  + Add another row
                </button>
                <button
                  type="button"
                  onClick={clearAllDrafts}
                  className="h-10 rounded-[10px] px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Clear all rows
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
        {loading || tableBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-slate-500">
            Loading…
          </div>
        ) : null}
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[56rem] w-full divide-y divide-slate-200 text-sm sm:min-w-[64rem]">
            <thead className="bg-slate-50">
              <tr>
                {tableHeaders.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3 sm:text-xs"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableHeaders.length}
                    className="px-3 py-10 text-center text-sm text-slate-500 sm:px-4 sm:py-12"
                  >
                    {hasFilter
                      ? "No purchase orders match this search."
                      : suppliers.length === 0
                        ? "Add suppliers first, then use Add purchase order."
                        : "No purchase orders yet. Click Add purchase order — form opens on the right."}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((p) => (
                  <tr
                    key={p.id}
                    className="bg-white hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-2 py-2.5 font-medium text-slate-900 sm:px-4 sm:py-3">
                      {p.id}
                    </td>
                    <td className="max-w-[10rem] px-2 py-2.5 font-mono text-xs text-slate-800 sm:px-4 sm:py-3 sm:text-sm">
                      {p.po_number}
                    </td>
                    <td className="max-w-[12rem] px-2 py-2.5 text-slate-800 sm:max-w-[16rem] sm:px-4 sm:py-3">
                      <span className="line-clamp-2 font-medium">
                        {p.supplier_name || "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                      {formatTableDate(p.po_date)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                      {p.currency || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-slate-800 sm:px-4 sm:py-3">
                      {formatMoney(p.total_value)}
                    </td>
                    <td
                      className="max-w-[12rem] px-2 py-2.5 text-slate-600 sm:max-w-[16rem] sm:px-4 sm:py-3"
                      title={p.remarks || undefined}
                    >
                      {formatNotesPreview(p.remarks, 56)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-600 sm:px-4 sm:py-3">
                      {formatTableDate(p.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
