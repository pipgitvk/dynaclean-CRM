"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const inputClass =
  "h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

const textareaClass =
  "min-h-[88px] w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

const fileClass =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200";

function SectionMaybeReadOnly({ title, active, lockedValue, isFile, children }) {
  if (!active) {
    // Not in the re-assign list — show locked / read-only
    const display =
      lockedValue != null && String(lockedValue).trim() !== ""
        ? String(lockedValue)
        : "—";
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-60">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-600">{title}</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Locked
          </span>
        </div>
        <p className={`whitespace-pre-wrap text-sm text-slate-700 ${isFile ? "font-mono text-xs" : ""}`}>
          {display}
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm ring-1 ring-orange-100">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Label({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-medium text-slate-600"
    >
      {children}
    </label>
  );
}

const FIELD_LABELS = {
  pickup_person_details: "Pickup person details",
  supplier_address: "Supplier address",
  cargo_ready_confirmation: "Cargo ready confirmation",
  booking_details: "Booking details",
  vessel_flight_details: "Vessel / flight details",
  container_details: "Container details",
  bl_file: "BL upload",
  invoice_file: "Invoice upload",
  packing_list_file: "Packing list upload",
  other_documents: "Other documents",
};

export default function PublicAwardFollowupClient({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [shipment, setShipment] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
  const [reassignFields, setReassignFields] = useState(null);
  const [saving, setSaving] = useState(false);

  const [pickup_person_details, setPickup] = useState("");
  const [supplier_address, setSupplier] = useState("");
  const [cargo_ready_confirmation, setCargoReady] = useState("");
  const [booking_details, setBooking] = useState("");
  const [vessel_flight_details, setVessel] = useState("");
  const [container_details, setContainer] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/import-crm/public-award/${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message || "Could not load this link");
          return;
        }
        setShipment(data.shipment || null);
        setSubmitted(Boolean(data.submitted));
        setReassignFields(data.reassign_fields || null);
        const f = data.form;
        if (f) {
          setSavedForm(f);
          // Pre-fill state with existing values (re-assign: agent edits only selected)
          setPickup(f.pickup_person_details || "");
          setSupplier(f.supplier_address || "");
          setCargoReady(f.cargo_ready_confirmation || "");
          setBooking(f.booking_details || "");
          setVessel(f.vessel_flight_details || "");
          setContainer(f.container_details || "");
        }
      } catch {
        if (!cancelled) setError("Could not load this link");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (submitted || saving) return;
      const fd = new FormData(e.currentTarget);
      setSaving(true);
      try {
        const res = await fetch(
          `/api/import-crm/public-award/${encodeURIComponent(token)}`,
          { method: "POST", body: fd },
        );
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.code === "ALREADY_SUBMITTED") {
          toast.error(data.message || "Already submitted");
          setSubmitted(true);
          return;
        }
        if (!res.ok) {
          throw new Error(data.message || "Submit failed");
        }
        toast.success(data.message || "Submitted");
        const r2 = await fetch(
          `/api/import-crm/public-award/${encodeURIComponent(token)}`,
        );
        const d2 = await r2.json().catch(() => ({}));
        if (r2.ok) {
          setSubmitted(Boolean(d2.submitted));
          setReassignFields(d2.reassign_fields || null);
          if (d2.form) setSavedForm(d2.form);
        } else {
          setSubmitted(true);
        }
      } catch (err) {
        toast.error(err.message || "Submit failed");
      } finally {
        setSaving(false);
      }
    },
    [submitted, saving, token],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-600">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      </div>
    );
  }

  if (submitted) {
    const f = savedForm;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Thank you — we have received your details and uploads.
        </div>
        {shipment ? (
          <p className="mb-6 text-sm text-slate-600">
            Shipment #{shipment.id}: {shipment.ship_from} → {shipment.ship_to}
          </p>
        ) : null}
        {f ? (
          <div className="space-y-4 text-sm">
            <ReadBlock title="Pickup person details" value={f.pickup_person_details} />
            <ReadBlock title="Supplier address" value={f.supplier_address} />
            <ReadBlock
              title="Cargo ready confirmation"
              value={f.cargo_ready_confirmation}
            />
            <ReadBlock title="Booking details" value={f.booking_details} />
            <ReadBlock
              title="Vessel / flight details"
              value={f.vessel_flight_details}
            />
            <ReadBlock
              title="Container details (if FCL)"
              value={f.container_details}
            />
            <ReadBlock title="BL upload" value={f.bl_file} mono />
            <ReadBlock title="Invoice upload" value={f.invoice_file} mono />
            <ReadBlock
              title="Packing list upload"
              value={f.packing_list_file}
              mono
            />
            {f.other_documents?.length ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Other documents
                </p>
                <ul className="list-inside list-disc text-slate-700">
                  {f.other_documents.map((o, i) => (
                    <li key={i}>{o.name || o.path || "File"}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const needs = (key) => !reassignFields || reassignFields.includes(key);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-16">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Awarded shipment — details & documents
        </h1>
        {reassignFields ? (
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            <p className="font-semibold">Admin has requested corrections for the following fields:</p>
            <ul className="mt-1 list-inside list-disc text-orange-800">
              {reassignFields.map((f) => (
                <li key={f}>{FIELD_LABELS[f] || f}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-orange-700">
              Only the highlighted sections are editable. The rest are locked as previously submitted.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Please complete each section below and upload the requested files where applicable.
          </p>
        )}
        {shipment ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold text-slate-800">Shipment #{shipment.id}</span>
            <span className="mx-2 text-slate-300">·</span>
            {shipment.ship_from} → {shipment.ship_to}
            {shipment.mode ? (
              <>
                <span className="mx-2 text-slate-300">·</span>
                {shipment.mode}
              </>
            ) : null}
          </p>
        ) : null}
      </header>

      <form className="space-y-6" onSubmit={onSubmit}>
        <SectionMaybeReadOnly
          title="Pickup person details"
          active={needs("pickup_person_details")}
          lockedValue={savedForm?.pickup_person_details}
        >
          <Label htmlFor="pickup_person_details">Name, phone, timing *</Label>
          <textarea
            id="pickup_person_details"
            name="pickup_person_details"
            required={needs("pickup_person_details") && !reassignFields}
            value={pickup_person_details}
            onChange={(e) => setPickup(e.target.value)}
            className={textareaClass}
            placeholder="Contact name, mobile, pickup window / instructions"
          />
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="Supplier address"
          active={needs("supplier_address")}
          lockedValue={savedForm?.supplier_address}
        >
          <Label htmlFor="supplier_address">Full address *</Label>
          <textarea
            id="supplier_address"
            name="supplier_address"
            required={needs("supplier_address") && !reassignFields}
            value={supplier_address}
            onChange={(e) => setSupplier(e.target.value)}
            className={textareaClass}
            placeholder="Factory / supplier address for pickup"
          />
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="Cargo ready confirmation"
          active={needs("cargo_ready_confirmation")}
          lockedValue={savedForm?.cargo_ready_confirmation}
        >
          <Label htmlFor="cargo_ready_confirmation">Ready date / remarks</Label>
          <textarea
            id="cargo_ready_confirmation"
            name="cargo_ready_confirmation"
            value={cargo_ready_confirmation}
            onChange={(e) => setCargoReady(e.target.value)}
            className={textareaClass}
            placeholder="When is cargo ready, any special handling"
          />
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="Booking details"
          active={needs("booking_details")}
          lockedValue={savedForm?.booking_details}
        >
          <Label htmlFor="booking_details">Booking / reference</Label>
          <textarea
            id="booking_details"
            name="booking_details"
            value={booking_details}
            onChange={(e) => setBooking(e.target.value)}
            className={textareaClass}
            placeholder="Carrier booking ref, SO number, etc."
          />
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="Vessel / flight details"
          active={needs("vessel_flight_details")}
          lockedValue={savedForm?.vessel_flight_details}
        >
          <Label htmlFor="vessel_flight_details">Vessel or flight</Label>
          <input
            id="vessel_flight_details"
            name="vessel_flight_details"
            value={vessel_flight_details}
            onChange={(e) => setVessel(e.target.value)}
            className={inputClass}
            placeholder="Vessel name / voyage or flight no. & date"
          />
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="Container details (if FCL)"
          active={needs("container_details")}
          lockedValue={savedForm?.container_details}
        >
          <Label htmlFor="container_details">Container no. / type / seal</Label>
          <textarea
            id="container_details"
            name="container_details"
            value={container_details}
            onChange={(e) => setContainer(e.target.value)}
            className={textareaClass}
            placeholder="If FCL: container number(s), type, seal numbers"
          />
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="BL upload (HBL / MBL)"
          active={needs("bl_file")}
          lockedValue={savedForm?.bl_file}
          isFile
        >
          <Label htmlFor="bl_upload">Bill of lading</Label>
          <input
            id="bl_upload"
            name="bl_upload"
            type="file"
            className={fileClass}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          />
          <p className="mt-1 text-[11px] text-slate-500">PDF or image, max 15 MB</p>
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="Invoice upload"
          active={needs("invoice_file")}
          lockedValue={savedForm?.invoice_file}
          isFile
        >
          <Label htmlFor="invoice_upload">Commercial invoice</Label>
          <input
            id="invoice_upload"
            name="invoice_upload"
            type="file"
            className={fileClass}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
          />
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="Packing list upload"
          active={needs("packing_list_file")}
          lockedValue={savedForm?.packing_list_file}
          isFile
        >
          <Label htmlFor="packing_list_upload">Packing list</Label>
          <input
            id="packing_list_upload"
            name="packing_list_upload"
            type="file"
            className={fileClass}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
          />
        </SectionMaybeReadOnly>

        <SectionMaybeReadOnly
          title="Other documents"
          active={needs("other_documents")}
          lockedValue={
            savedForm?.other_documents?.length
              ? `${savedForm.other_documents.length} file(s)`
              : null
          }
          isFile
        >
          <Label htmlFor="other_documents">Additional files</Label>
          <input
            id="other_documents"
            name="other_documents"
            type="file"
            multiple
            className={fileClass}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
          />
        </SectionMaybeReadOnly>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-[10px] bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60 sm:w-auto sm:min-w-[200px]"
        >
          {saving ? "Submitting…" : reassignFields ? "Re-submit corrections" : "Submit"}
        </button>
      </form>
    </div>
  );
}

function ReadBlock({ title, value, mono }) {
  const v =
    value != null && String(value).trim() !== "" ? String(value) : "—";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p
        className={`whitespace-pre-wrap text-slate-800 ${mono ? "font-mono text-xs" : ""}`}
      >
        {v}
      </p>
    </div>
  );
}
