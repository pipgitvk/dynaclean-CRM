"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Search, X } from "lucide-react";
import toast from "react-hot-toast";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function numMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function textOrDash(v) {
  if (v == null) return "—";
  const s = String(v).trim();
  return s === "" ? "—" : s;
}

function fileLabel(path) {
  if (path == null || String(path).trim() === "") return "—";
  const parts = String(path).replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function parseOtherDocsJson(raw) {
  if (raw == null || String(raw).trim() === "") return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** DB path like import-crm-award/{id}/file.ext → admin API URL */
function awardUploadViewUrl(storedRelativePath) {
  if (!storedRelativePath || String(storedRelativePath).trim() === "") {
    return null;
  }
  const p = String(storedRelativePath).replace(/\\/g, "/").replace(/^\/+/, "");
  const prefix = "import-crm-award/";
  if (!p.startsWith(prefix)) return null;
  const rest = p.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  const qid = rest.slice(0, slash);
  const fname = rest.slice(slash + 1);
  if (!qid || !fname) return null;
  return `/api/import-crm/award-upload/${qid}/${encodeURIComponent(fname)}`;
}

function isImageFileName(name) {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(String(name || ""));
}

function isPdfFileName(name) {
  return /\.pdf$/i.test(String(name || ""));
}

const REASSIGN_FIELDS = [
  { key: "pickup_person_name", label: "Pickup person name", dbKey: "af_pickup_person_name" },
  { key: "pickup_person_phone", label: "Pickup person phone", dbKey: "af_pickup_person_phone" },
  { key: "pickup_person_email", label: "Pickup person email", dbKey: "af_pickup_person_email" },
  { key: "pickup_person_details", label: "Pickup person details", dbKey: "af_pickup_person_details" },
  { key: "pickup_date", label: "Pickup date", dbKey: "af_pickup_date" },
  { key: "picked_date", label: "Picked date", dbKey: "af_picked_date" },
  { key: "transit_date", label: "Transit date", dbKey: "af_transit_date" },
  { key: "delivered_date", label: "Delivered date", dbKey: "af_delivered_date" },
  { key: "supplier_name", label: "Supplier name", dbKey: "af_supplier_name" },
  { key: "supplier_email", label: "Supplier email", dbKey: "af_supplier_email" },
  { key: "supplier_phone", label: "Supplier phone", dbKey: "af_supplier_phone" },
  { key: "supplier_address", label: "Supplier address", dbKey: "af_supplier_address" },
  { key: "cargo_ready_confirmation", label: "Cargo ready confirmation", dbKey: "af_cargo_ready_confirmation" },
  { key: "booking_details", label: "Booking details", dbKey: "af_booking_details" },
  { key: "vessel_flight_details", label: "Vessel / flight details", dbKey: "af_vessel_flight_details" },
  { key: "container_details", label: "Container details", dbKey: "af_container_details" },
  { key: "bl_file", label: "BL upload", dbKey: "af_bl_file" },
  { key: "invoice_file", label: "Invoice upload", dbKey: "af_invoice_file" },
  { key: "packing_list_file", label: "Packing list upload", dbKey: "af_packing_list_file" },
  { key: "other_documents", label: "Other documents", dbKey: "af_other_documents_json" },
];

export default function ImportCrmAwardFollowupsClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [reassignRow, setReassignRow] = useState(null);
  const [reassignSelected, setReassignSelected] = useState([]);
  const [reassignSaving, setReassignSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/import-crm/award-followups");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load");
      setRows(data.rows || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = Object.values(r)
        .filter((v) => v != null && v !== "")
        .map((v) => String(v))
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, searchText]);

  const handleApprove = useCallback(
    async (id) => {
      if (!window.confirm("Mark this follow-up as approved?")) return;
      setApprovingId(id);
      try {
        const res = await fetch(
          `/api/import-crm/award-followups/${id}/approve`,
          { method: "POST" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Approve failed");
        toast.success(data.message || "Approved");
        await load();
      } catch (e) {
        toast.error(e.message || "Could not approve");
      } finally {
        setApprovingId(null);
      }
    },
    [load],
  );

  const openReassignModal = useCallback((row) => {
    setReassignRow(row);
    setReassignSelected([]);
  }, []);

  const closeReassignModal = useCallback(() => {
    if (reassignSaving) return;
    setReassignRow(null);
    setReassignSelected([]);
  }, [reassignSaving]);

  const toggleReassignField = useCallback((key) => {
    setReassignSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const handleReassignSubmit = useCallback(async () => {
    if (!reassignRow || reassignSelected.length === 0) return;
    setReassignSaving(true);
    try {
      const res = await fetch(
        `/api/import-crm/award-followups/${reassignRow.link_quote_id}/reassign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: reassignSelected }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Re-assign failed");
      toast.success(data.message || "Re-assigned");
      setReassignRow(null);
      setReassignSelected([]);
      await load();
    } catch (e) {
      toast.error(e.message || "Could not re-assign");
    } finally {
      setReassignSaving(false);
    }
  }, [reassignRow, reassignSelected, load]);

  const headers = [
    "Quote ID",
    "Shipment",
    "Route",
    "Submitter",
    "Agent ID",
    "Quote (INR)",
    "Status",
    "Awarded",
    "Form sent",
    "Actions",
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
              placeholder="Search shipment, email, agent, pickup, booking, files…"
              autoComplete="off"
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="h-11 shrink-0 rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-500">
            Loading…
          </div>
        ) : null}
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[72rem] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="w-10 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:text-xs"
                />
                {headers.map((h) => (
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
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length + 1}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    {searchText.trim()
                      ? "No rows match this search."
                      : "No awarded quotes yet. Award a row from Quote submissions — follow-up forms will list here."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const id = r.link_quote_id;
                  const open = expandedId === id;
                  const submitted = Boolean(r.award_form_submitted_at);
                  const approved = Boolean(r.af_approved_at);
                  return (
                    <Fragment key={id}>
                      <tr className="bg-white hover:bg-slate-50/80">
                        <td className="px-2 py-2.5 sm:px-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(open ? null : id)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            aria-expanded={open}
                          >
                            {open ? "−" : "+"}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 font-medium text-slate-900 sm:px-4 sm:py-3">
                          {id}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs sm:px-4 sm:py-3">
                          {r.shipment_id || "—"}
                        </td>
                        <td
                          className="max-w-[10rem] px-2 py-2.5 text-xs text-slate-700 sm:max-w-[14rem] sm:px-4 sm:py-3"
                          title={`${r.ship_from || ""} → ${r.ship_to || ""}`}
                        >
                          <span className="line-clamp-2">
                            {textOrDash(r.ship_from)} → {textOrDash(r.ship_to)}
                          </span>
                        </td>
                        <td className="max-w-[12rem] break-all px-2 py-2.5 text-xs text-slate-800 sm:px-4 sm:py-3">
                          {r.submitter_email?.trim() ? (
                            <span title={r.submitter_email}>
                              {r.submitter_email}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-2.5 font-mono text-xs sm:px-4 sm:py-3">
                          {r.agent_id || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-slate-800 sm:px-4 sm:py-3">
                          {numMoney(r.total_cost_inr)}
                        </td>
                        <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                          {approved ? (
                            <span className="inline-flex rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900">
                              Approved
                            </span>
                          ) : submitted ? (
                            <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                              Submitted
                            </span>
                          ) : (
                            <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-700 sm:px-4 sm:py-3">
                          {formatDate(r.awarded_at)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-700 sm:px-4 sm:py-3">
                          {formatDate(r.award_form_submitted_at)}
                        </td>
                        <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!submitted || approved || approvingId === id}
                              onClick={() => handleApprove(id)}
                              title={
                                approved
                                  ? "Already approved"
                                  : !submitted
                                    ? "Form not yet submitted"
                                    : "Approve this follow-up"
                              }
                              className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {approvingId === id ? "…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={approved}
                              onClick={() => openReassignModal(r)}
                              title={
                                approved
                                  ? "Cannot re-assign after approval"
                                  : "Select fields to re-assign"
                              }
                              className="inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-800 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Re-assign
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-slate-50/90">
                          <td
                            colSpan={headers.length + 1}
                            className="px-3 py-4 sm:px-6"
                          >
                            {!submitted ? (
                              <p className="text-sm text-slate-600">
                                Waiting for the awarded submitter to complete the
                                portal form (email with &quot;Open form&quot;
                                button).
                              </p>
                            ) : (
                              <div className="space-y-4 text-xs">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Shipment
                                    </p>
                                    <p className="text-slate-700">
                                      <span className="text-slate-500">
                                        Mode / term:{" "}
                                      </span>
                                      {textOrDash(r.mode)} /{" "}
                                      {textOrDash(r.shipment_term)}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Pickup person
                                    </p>
                                    <Field label="Name" value={r.af_pickup_person_name} />
                                    <Field label="Phone" value={r.af_pickup_person_phone} />
                                    <Field label="Email" value={r.af_pickup_person_email} />
                                    <Field label="Details / instructions" value={r.af_pickup_person_details} />
                                  </div>
                                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Dates
                                    </p>
                                    <Field label="Pickup date" value={r.af_pickup_date} />
                                    <Field label="Picked date" value={r.af_picked_date} />
                                    <Field label="Transit date" value={r.af_transit_date} />
                                    <Field label="Delivered date" value={r.af_delivered_date} />
                                  </div>
                                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Supplier
                                    </p>
                                    <Field label="Name" value={r.af_supplier_name} />
                                    <Field label="Email" value={r.af_supplier_email} />
                                    <Field label="Phone" value={r.af_supplier_phone} />
                                    <Field label="Address" value={r.af_supplier_address} />
                                    <Field label="Cargo ready confirmation" value={r.af_cargo_ready_confirmation} />
                                  </div>
                                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Booking & movement
                                    </p>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                      <Field label="Booking details" value={r.af_booking_details} />
                                      <Field label="Vessel / flight" value={r.af_vessel_flight_details} />
                                      <Field label="Container (FCL)" value={r.af_container_details} />
                                    </div>
                                  </div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Uploaded files (under{" "}
                                    <code className="rounded bg-slate-100 px-1">
                                      uploads/
                                    </code>
                                    )
                                  </p>
                                  <div className="flex flex-nowrap items-start gap-x-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:gap-x-3 [&::-webkit-scrollbar]:h-1">
                                    <AwardFileThumb
                                      label="BL"
                                      storedPath={r.af_bl_file}
                                    />
                                    <AwardFileThumb
                                      label="Inv."
                                      storedPath={r.af_invoice_file}
                                    />
                                    <AwardFileThumb
                                      label="P/L"
                                      storedPath={r.af_packing_list_file}
                                    />
                                    {parseOtherDocsJson(
                                      r.af_other_documents_json,
                                    ).map((o, i) => (
                                      <AwardFileThumb
                                        key={i}
                                        label={
                                          o.name
                                            ? fileLabel(o.name)
                                            : `Other ${i + 1}`
                                        }
                                        storedPath={o.path}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Re-assign modal ── */}
      <Dialog
        open={Boolean(reassignRow)}
        onClose={closeReassignModal}
        className="relative z-[300]"
      >
        <DialogBackdrop className="fixed inset-0 bg-slate-900/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <DialogTitle className="text-base font-semibold text-slate-900">
                  Re-assign fields
                </DialogTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  Select the fields you want the agent to re-fill. Only those fields
                  will be shown in their portal form.
                </p>
              </div>
              <button
                type="button"
                onClick={closeReassignModal}
                disabled={reassignSaving}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <ul className="space-y-1">
                {REASSIGN_FIELDS.map(({ key, label, dbKey }) => {
                  const raw = reassignRow?.[dbKey];
                  const hasValue =
                    raw != null &&
                    String(raw).trim() !== "" &&
                    String(raw).trim() !== "null";
                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                          checked={reassignSelected.includes(key)}
                          onChange={() => toggleReassignField(key)}
                          disabled={reassignSaving}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">
                            {label}
                          </p>
                          {hasValue ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                              Current: {String(raw).slice(0, 80)}
                              {String(raw).length > 80 ? "…" : ""}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs italic text-slate-400">
                              Not filled yet
                            </p>
                          )}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeReassignModal}
                disabled={reassignSaving}
                className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReassignSubmit}
                disabled={reassignSelected.length === 0 || reassignSaving}
                className="rounded-[10px] bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {reassignSaving
                  ? "Sending…"
                  : `Re-assign ${reassignSelected.length > 0 ? `(${reassignSelected.length})` : ""}`}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">
        {textOrDash(value)}
      </p>
    </div>
  );
}

/** One row of small thumbnails (click opens full file). */
function AwardFileThumb({ label, storedPath }) {
  const base = fileLabel(storedPath);
  const url = awardUploadViewUrl(storedPath);
  const wrapClass =
    "flex w-[3.25rem] shrink-0 flex-col items-center gap-0.5 sm:w-[3.75rem]";

  if (!storedPath || base === "—") {
    return (
      <div className={`${wrapClass} opacity-45`}>
        <span className="line-clamp-2 text-center text-[8px] font-bold uppercase leading-tight text-slate-400">
          {label}
        </span>
        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[10px] text-slate-400 sm:h-16 sm:w-16">
          —
        </div>
      </div>
    );
  }
  if (!url) {
    return (
      <div className={wrapClass}>
        <span className="line-clamp-2 text-center text-[8px] font-bold uppercase leading-tight text-slate-600">
          {label}
        </span>
        <div
          className="flex h-14 w-14 items-center rounded-md border border-slate-200 bg-amber-50 p-0.5 sm:h-16 sm:w-16"
          title={base}
        >
          <span className="line-clamp-3 w-full text-center font-mono text-[6px] leading-tight text-amber-900">
            {base}
          </span>
        </div>
      </div>
    );
  }
  const img = isImageFileName(base);
  const pdf = isPdfFileName(base);
  return (
    <div className={wrapClass}>
      <span
        className="line-clamp-2 max-w-full text-center text-[8px] font-bold uppercase leading-tight text-slate-600"
        title={label}
      >
        {label}
      </span>
      {img ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-14 w-14 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm ring-1 ring-slate-100/80 transition hover:ring-teal-300 sm:h-16 sm:w-16"
          title={base}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-only URL */}
          <img
            src={url}
            alt={label}
            className="h-full w-full object-cover"
          />
        </a>
      ) : null}
      {pdf ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-14 items-center justify-center rounded-md border border-red-200 bg-red-50 text-[9px] font-extrabold text-red-800 shadow-sm hover:bg-red-100 sm:h-16 sm:w-16"
          title={base}
        >
          PDF
        </a>
      ) : null}
      {!img && !pdf ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-14 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-[8px] font-semibold text-slate-700 hover:bg-slate-200 sm:h-16 sm:w-16"
          title={base}
        >
          FILE
        </a>
      ) : null}
    </div>
  );
}
