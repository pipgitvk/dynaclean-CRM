"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import WarrantyRegistrationFormCard from "./WarrantyRegistrationFormCard";
import WarrantyDispatchItemLabel from "@/components/warranty/WarrantyDispatchItemLabel";

const STATES = [
  "Andhra Pradesh (28)",
  "Arunachal Pradesh (12)",
  "Assam (18)",
  "Bihar (10)",
  "Chhattisgarh (22)",
  "Goa (30)",
  "Gujarat (24)",
  "Haryana (06)",
  "Himachal Pradesh (02)",
  "Jharkhand (20)",
  "Karnataka (29)",
  "Kerala (32)",
  "Madhya Pradesh (23)",
  "Maharashtra (27)",
  "Manipur (14)",
  "Meghalaya (17)",
  "Mizoram (15)",
  "Nagaland (13)",
  "Odisha (21)",
  "Punjab (03)",
  "Rajasthan (08)",
  "Sikkim (11)",
  "Tamil Nadu (33)",
  "Telangana (36)",
  "Tripura (16)",
  "Uttar Pradesh (09)",
  "Uttarakhand (05)",
  "West Bengal (19)",
  "Delhi (07)",
  "Jammu and Kashmir (01)",
  "Ladakh (38)",
];

function normalizeStateFromDb(rawState) {
  if (!rawState) return "";
  const trimmed = String(rawState).trim();
  if (STATES.includes(trimmed)) return trimmed;
  const withoutCode = trimmed.split("(")[0].trim();
  if (STATES.includes(withoutCode)) return withoutCode;
  const found = STATES.find((s) =>
    trimmed.toLowerCase().startsWith(s.toLowerCase()),
  );
  return found || trimmed;
}

function dispatchToForm(d) {
  return {
    product_name: d.product_name || "",
    model: d.model || "",
    specification: d.specification || "",
    serial_number: d.serial_number || "",
    gstin: d.gstin || "",
    state: normalizeStateFromDb(d.state),
    customer_name: d.customer_name || "",
    email: d.email || "",
    contact_person: d.contact_person || "",
    contact: d.contact || "",
    customer_address: d.customer_address || "",
    invoice_number: d.invoice_number || "",
    invoice_date: d.invoice_date ? String(d.invoice_date).slice(0, 10) : "",
  };
}

export default function WarrantyForm() {
  const [mode, setMode] = useState("manual");
  const [showModeModal, setShowModeModal] = useState(true);
  const [orderId, setOrderId] = useState("");
  const [orderDispatches, setOrderDispatches] = useState([]);
  const [orderError, setOrderError] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [selectedDispatchIds, setSelectedDispatchIds] = useState(() => new Set());
  const [batchForms, setBatchForms] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oid = String(params.get("order_id") || "").trim();
    const modeParam = String(params.get("mode") || "").trim().toLowerCase();
    if (oid && modeParam === "order") {
      setOrderId(oid);
      setMode("order");
    }
    setShowModeModal(true);
  }, []);

  const fetchByOrderId = useCallback(async (silent = false) => {
    const trimmed = orderId.trim();
    if (!trimmed) {
      if (!silent) toast.error("Please enter Order ID");
      return;
    }
    setLoadingOrder(true);
    setOrderError("");
    setOrderDispatches([]);
    setSelectedDispatchIds(new Set());
    try {
      const res = await fetch(
        `/api/warranty/by-order-id?order_id=${encodeURIComponent(trimmed)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch data for this Order ID");
      }
      setOrderDispatches(data.dispatches || []);
      if (!data.dispatches?.length) {
        setOrderError("No eligible dispatch found for this Order ID.");
      }
    } catch (err) {
      setOrderError(err.message || "Failed to fetch data for this Order ID");
    } finally {
      setLoadingOrder(false);
    }
  }, [orderId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oid = String(params.get("order_id") || "").trim();
    const modeParam = String(params.get("mode") || "").trim().toLowerCase();
    if (oid && modeParam === "order" && orderId === oid) {
      fetchByOrderId(true);
    }
  }, [orderId, fetchByOrderId]);

  const productDispatches = orderDispatches.filter(
    (d) =>
      d.item_kind === "product" && String(d.serial_number || "").trim() !== "",
  );
  const spareDispatches = orderDispatches.filter((d) => d.item_kind !== "product");

  const toggleDispatch = (dispatchId) => {
    setSelectedDispatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(dispatchId)) next.delete(dispatchId);
      else next.add(dispatchId);
      return next;
    });
  };

  const selectAllInSection = (items, checked) => {
    setSelectedDispatchIds((prev) => {
      const next = new Set(prev);
      items.forEach((d) => {
        if (checked) next.add(d.dispatch_id);
        else next.delete(d.dispatch_id);
      });
      return next;
    });
  };

  const addSelectedForms = () => {
    const selected = orderDispatches.filter((d) =>
      selectedDispatchIds.has(d.dispatch_id),
    );
    if (!selected.length) {
      toast.error("Select at least one product or spare");
      return;
    }
    const newForms = selected.map((d) => ({
      clientId: `warranty-${d.dispatch_id}-${crypto.randomUUID()}`,
      dispatchId: d.dispatch_id,
      itemMeta: {
        product_name: d.product_name,
        model: d.model,
        serial_number: d.serial_number,
        customer_name: d.customer_name,
        item_kind: d.item_kind,
      },
      initialForm: dispatchToForm(d),
    }));
    setBatchForms((prev) => [...prev, ...newForms]);
    setSelectedDispatchIds(new Set());
    setShowModeModal(false);
    toast.success(`Opened ${newForms.length} registration form(s)`);
  };

  const renderDispatchPickList = (items, sectionTitle) => {
    if (!items.length) return null;
    const allSelected = items.every((d) => selectedDispatchIds.has(d.dispatch_id));
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {sectionTitle}{" "}
            <span className="font-semibold text-gray-400">({items.length})</span>
          </p>
          <button
            type="button"
            onClick={() => selectAllInSection(items, !allSelected)}
            className="text-[11px] font-semibold text-blue-600 hover:underline"
          >
            {allSelected ? "Clear" : "Select all"}
          </button>
        </div>
        <div className="max-h-44 overflow-y-auto rounded-md border text-sm">
          {items.map((d) => {
            const checked = selectedDispatchIds.has(d.dispatch_id);
            return (
              <label
                key={d.dispatch_id}
                className={`flex cursor-pointer gap-3 border-b px-3 py-2 last:border-b-0 ${
                  checked ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() => toggleDispatch(d.dispatch_id)}
                />
                <div className="min-w-0 flex-1">
                  <WarrantyDispatchItemLabel
                    productName={d.product_name}
                    model={d.model}
                    serialNumber={d.serial_number}
                    customerName={d.customer_name}
                    itemKind={d.item_kind}
                    compact
                  />
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const selectedCount = selectedDispatchIds.size;

  return (
    <div className="relative z-10 mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
      {showModeModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowModeModal(false)}
              aria-label="Close"
              title="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              ✕
            </button>
            <h3 className="mb-2 text-lg font-semibold">Warranty Registration</h3>
            <p className="mb-4 text-sm text-gray-600">
              Choose how you want to register the warranty.
            </p>
            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="warrantyMode"
                  value="manual"
                  checked={mode === "manual"}
                  onChange={() => setMode("manual")}
                />
                <span>Manual (fill form yourself)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="warrantyMode"
                  value="order"
                  checked={mode === "order"}
                  onChange={() => setMode("order")}
                />
                <span>By Order ID (prefill from Dispatch / Quotation)</span>
              </label>
            </div>

            {mode === "order" && (
              <div className="mb-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="Enter Order ID"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => fetchByOrderId(false)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                    disabled={loadingOrder}
                  >
                    {loadingOrder ? "Searching..." : "Search"}
                  </button>
                </div>
                {orderError ? (
                  <p className="text-xs text-red-600">{orderError}</p>
                ) : null}
                {orderDispatches.length > 0 ? (
                  <div className="max-h-[min(22rem,55vh)] space-y-3 overflow-y-auto pr-0.5">
                    {renderDispatchPickList(productDispatches, "Products")}
                    {renderDispatchPickList(spareDispatches, "Spares")}
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-2">
              {mode === "order" && orderDispatches.length > 0 ? (
                <button
                  type="button"
                  onClick={addSelectedForms}
                  disabled={selectedCount === 0}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add selected ({selectedCount})
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowModeModal(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {mode === "manual" ? "Continue with Manual" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 p-8 sm:p-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl text-gray-800 sm:text-center md:text-start sm:text-3xl">
            Product Warranty Registration
          </h2>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setMode("order");
                setShowModeModal(true);
              }}
              className="inline-flex items-center rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              Fill from Order ID
            </button>
            <Link
              href="/admin-dashboard/warranty/products"
              className="inline-block rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl"
            >
              Show Products
            </Link>
          </div>
        </div>

        {batchForms.length > 0 ? (
          <div className="space-y-8">
            <p className="text-sm text-gray-600">
              {batchForms.length} form(s) — submit each product separately.
            </p>
            {batchForms.map((item) => (
              <WarrantyRegistrationFormCard
                key={item.clientId}
                itemMeta={item.itemMeta}
                initialForm={item.initialForm}
                showRemove
                onRemove={() =>
                  setBatchForms((prev) =>
                    prev.filter((f) => f.clientId !== item.clientId),
                  )
                }
                onRegistered={() =>
                  setBatchForms((prev) =>
                    prev.filter((f) => f.clientId !== item.clientId),
                  )
                }
              />
            ))}
          </div>
        ) : (
          <WarrantyRegistrationFormCard />
        )}
      </div>
    </div>
  );
}