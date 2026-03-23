"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const textareaClass = `${inputClass} min-h-[2.75rem] py-2`;

const DRAFT_DEFAULTS = {
  supplier_name: "",
  contact_person: "",
  email: "",
  phone: "",
  alt_phone: "",
  country: "",
  state: "",
  city: "",
  address: "",
  pincode: "",
  factory_name: "",
  supplier_type: "",
  main_products: "",
  pickup_address: "",
  gst_no: "",
  pan_no: "",
  iec_no: "",
  tax_registration_no: "",
  registration_no: "",
  default_origin_country: "",
  default_origin_city: "",
  nearest_port: "",
  default_incoterm: "",
  cargo_ready_lead_time: "",
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  swift_code: "",
  branch_name: "",
  available_documents: "",
  remarks: "",
  status: "Active",
};

function emptyDraft() {
  return {
    tempId: `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ...DRAFT_DEFAULTS,
  };
}

function draftToPayload(d) {
  const out = {};
  for (const k of Object.keys(DRAFT_DEFAULTS)) {
    out[k] = d[k];
  }
  return out;
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

export default function SuppliersListClient() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableBusy, setTableBusy] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [draftLines, setDraftLines] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/import-crm/suppliers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load");
      setSuppliers(data.suppliers || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const addDraftLine = useCallback(() => {
    setDraftLines((prev) => [...prev, emptyDraft()]);
  }, []);

  const openSupplierDrawer = useCallback(() => {
    setDrawerOpen(true);
    setDraftLines((prev) =>
      prev.length === 0 ? [...prev, emptyDraft()] : prev,
    );
  }, []);

  const removeDraftLine = useCallback((tempId) => {
    setDraftLines((prev) => prev.filter((d) => d.tempId !== tempId));
  }, []);

  const updateDraft = useCallback((tempId, field, value) => {
    setDraftLines((prev) =>
      prev.map((d) =>
        d.tempId === tempId ? { ...d, [field]: value } : d,
      ),
    );
  }, []);

  const clearAllDrafts = useCallback(() => {
    setDraftLines([]);
  }, []);

  const saveAllDrafts = useCallback(async () => {
    const toSave = draftLines.filter((d) => d.supplier_name.trim());
    if (toSave.length === 0) {
      toast.error("Add at least one row with a supplier name.");
      return;
    }
    setSaveLoading(true);
    const savedTempIds = [];
    let firstError = null;
    try {
      for (const d of toSave) {
        const res = await fetch("/api/import-crm/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftToPayload(d)),
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
            ? "Supplier saved"
            : `${savedTempIds.length} suppliers saved`,
        );
        const nextDrafts = draftLines.filter(
          (d) => !savedTempIds.includes(d.tempId),
        );
        setDraftLines(nextDrafts);
        if (nextDrafts.length === 0) setDrawerOpen(false);
        setTableBusy(true);
        await fetchSuppliers();
        setTableBusy(false);
      }
      if (firstError) toast.error(firstError);
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaveLoading(false);
    }
  }, [draftLines, fetchSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      const blob = Object.values(s)
        .filter((v) => v != null && v !== "")
        .map((v) => String(v))
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [suppliers, searchText]);

  const hasFilter = searchText.trim().length > 0;

  const tableHeaders = [
    "ID",
    "Supplier name",
    "Country",
    "City",
    "State",
    "Contact",
    "Email",
    "Phone",
    "GST",
    "Status",
    "Created",
  ];

  return (
    <>
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
              placeholder="Search supplier name, country, email, phone, or ID"
              autoComplete="off"
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={openSupplierDrawer}
          className="h-11 w-full shrink-0 rounded-[10px] bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:min-w-[10.5rem]"
        >
          Add Supplier
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
            className="flex h-full w-full max-w-2xl transform flex-col border-l border-slate-200 bg-white shadow-2xl transition duration-300 ease-out data-[closed]:translate-x-full"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0 pt-0.5">
                <DialogTitle className="text-base font-semibold text-slate-900">
                  New suppliers
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
                    <div className="grid gap-4">
                      <SectionTitle>Basic</SectionTitle>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DraftInput
                          label="Supplier name *"
                          d={d}
                          field="supplier_name"
                          updateDraft={updateDraft}
                          placeholder="Required"
                        />
                        <DraftInput
                          label="Status"
                          d={d}
                          field="status"
                          updateDraft={updateDraft}
                          placeholder="Active"
                        />
                        <DraftInput
                          label="Supplier type"
                          d={d}
                          field="supplier_type"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Contact person"
                          d={d}
                          field="contact_person"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Email"
                          d={d}
                          field="email"
                          type="email"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Phone"
                          d={d}
                          field="phone"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Alt. phone"
                          d={d}
                          field="alt_phone"
                          updateDraft={updateDraft}
                        />
                      </div>

                      <SectionTitle>Address</SectionTitle>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DraftInput
                          label="Country"
                          d={d}
                          field="country"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="State"
                          d={d}
                          field="state"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="City"
                          d={d}
                          field="city"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Pincode"
                          d={d}
                          field="pincode"
                          updateDraft={updateDraft}
                        />
                        <div className="sm:col-span-2">
                          <DraftTextarea
                            label="Address"
                            d={d}
                            field="address"
                            rows={2}
                            updateDraft={updateDraft}
                          />
                        </div>
                      </div>

                      <SectionTitle>Factory & products</SectionTitle>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DraftInput
                          label="Factory name"
                          d={d}
                          field="factory_name"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Main products"
                          d={d}
                          field="main_products"
                          updateDraft={updateDraft}
                        />
                        <div className="sm:col-span-2">
                          <DraftTextarea
                            label="Pickup address"
                            d={d}
                            field="pickup_address"
                            rows={2}
                            updateDraft={updateDraft}
                          />
                        </div>
                      </div>

                      <SectionTitle>Tax & registration</SectionTitle>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DraftInput
                          label="GST no."
                          d={d}
                          field="gst_no"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="PAN no."
                          d={d}
                          field="pan_no"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="IEC no."
                          d={d}
                          field="iec_no"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Tax registration no."
                          d={d}
                          field="tax_registration_no"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Registration no."
                          d={d}
                          field="registration_no"
                          updateDraft={updateDraft}
                        />
                      </div>

                      <SectionTitle>Origin & logistics</SectionTitle>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DraftInput
                          label="Default origin country"
                          d={d}
                          field="default_origin_country"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Default origin city"
                          d={d}
                          field="default_origin_city"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Nearest port"
                          d={d}
                          field="nearest_port"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Default incoterm"
                          d={d}
                          field="default_incoterm"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Cargo ready lead time"
                          d={d}
                          field="cargo_ready_lead_time"
                          updateDraft={updateDraft}
                        />
                      </div>

                      <SectionTitle>Bank</SectionTitle>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DraftInput
                          label="Bank name"
                          d={d}
                          field="bank_name"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Account holder"
                          d={d}
                          field="account_holder_name"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Account number"
                          d={d}
                          field="account_number"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="SWIFT code"
                          d={d}
                          field="swift_code"
                          updateDraft={updateDraft}
                        />
                        <DraftInput
                          label="Branch name"
                          d={d}
                          field="branch_name"
                          updateDraft={updateDraft}
                        />
                      </div>

                      <SectionTitle>Other</SectionTitle>
                      <div className="grid gap-3">
                        <DraftTextarea
                          label="Available documents"
                          d={d}
                          field="available_documents"
                          rows={2}
                          updateDraft={updateDraft}
                        />
                        <DraftTextarea
                          label="Remarks"
                          d={d}
                          field="remarks"
                          rows={2}
                          updateDraft={updateDraft}
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
                  disabled={saveLoading}
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
          <table className="min-w-[72rem] w-full divide-y divide-slate-200 text-sm">
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
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableHeaders.length}
                    className="px-3 py-10 text-center text-sm text-slate-500 sm:px-4 sm:py-12"
                  >
                    {hasFilter
                      ? "No suppliers match this search."
                      : "No suppliers yet. Click Add Supplier — the form opens on the right; save to add rows here."}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="bg-white hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-2 py-2.5 font-medium text-slate-900 sm:px-4 sm:py-3">
                      {s.id}
                    </td>
                    <td className="max-w-[12rem] px-2 py-2.5 text-slate-800 sm:max-w-[16rem] sm:px-4 sm:py-3">
                      <span className="line-clamp-2 font-medium">
                        {s.supplier_name}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                      {s.country || "—"}
                    </td>
                    <td className="max-w-[6rem] truncate px-2 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                      {s.city || "—"}
                    </td>
                    <td className="max-w-[6rem] truncate px-2 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                      {s.state || "—"}
                    </td>
                    <td className="max-w-[8rem] px-2 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                      <span className="line-clamp-2 text-xs">
                        {s.contact_person || "—"}
                      </span>
                    </td>
                    <td className="max-w-[10rem] break-all px-2 py-2.5 text-xs text-slate-700 sm:px-4 sm:py-3">
                      {s.email || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-700 sm:px-4 sm:py-3">
                      {s.phone || "—"}
                    </td>
                    <td className="max-w-[7rem] truncate px-2 py-2.5 font-mono text-xs text-slate-700 sm:px-4 sm:py-3">
                      {s.gst_no || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-700 sm:px-4 sm:py-3">
                      {s.status || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-600 sm:px-4 sm:py-3">
                      {formatTableDate(s.created_at)}
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

function SectionTitle({ children }) {
  return (
    <p className="border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
      {children}
    </p>
  );
}

function DraftInput({
  label,
  d,
  field,
  updateDraft,
  type = "text",
  placeholder,
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        type={type}
        className={inputClass}
        value={d[field] ?? ""}
        placeholder={placeholder}
        onChange={(e) => updateDraft(d.tempId, field, e.target.value)}
      />
    </div>
  );
}

function DraftTextarea({ label, d, field, rows, updateDraft }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <textarea
        rows={rows}
        className={textareaClass}
        value={d[field] ?? ""}
        onChange={(e) => updateDraft(d.tempId, field, e.target.value)}
      />
    </div>
  );
}
