"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const inputClass =
  "h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

const textareaClass =
  "min-h-[88px] w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

const fileClass =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200";

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

export default function PublicAwardFollowupClient({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [shipment, setShipment] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
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
        if (data.submitted && data.form) {
          setSavedForm(data.form);
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
        if (r2.ok && d2.submitted && d2.form) {
          setSubmitted(true);
          setSavedForm(d2.form);
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-16">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Awarded shipment — details & documents
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Please complete each section below and upload the requested files where
          applicable.
        </p>
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
        <Section title="Pickup person details">
          <div>
            <Label htmlFor="pickup_person_details">Name, phone, timing *</Label>
            <textarea
              id="pickup_person_details"
              name="pickup_person_details"
              required
              value={pickup_person_details}
              onChange={(e) => setPickup(e.target.value)}
              className={textareaClass}
              placeholder="Contact name, mobile, pickup window / instructions"
            />
          </div>
        </Section>

        <Section title="Supplier address">
          <div>
            <Label htmlFor="supplier_address">Full address *</Label>
            <textarea
              id="supplier_address"
              name="supplier_address"
              required
              value={supplier_address}
              onChange={(e) => setSupplier(e.target.value)}
              className={textareaClass}
              placeholder="Factory / supplier address for pickup"
            />
          </div>
        </Section>

        <Section title="Cargo ready confirmation">
          <div>
            <Label htmlFor="cargo_ready_confirmation">Ready date / remarks</Label>
            <textarea
              id="cargo_ready_confirmation"
              name="cargo_ready_confirmation"
              value={cargo_ready_confirmation}
              onChange={(e) => setCargoReady(e.target.value)}
              className={textareaClass}
              placeholder="When is cargo ready, any special handling"
            />
          </div>
        </Section>

        <Section title="Booking details">
          <div>
            <Label htmlFor="booking_details">Booking / reference</Label>
            <textarea
              id="booking_details"
              name="booking_details"
              value={booking_details}
              onChange={(e) => setBooking(e.target.value)}
              className={textareaClass}
              placeholder="Carrier booking ref, SO number, etc."
            />
          </div>
        </Section>

        <Section title="Vessel / flight details">
          <div>
            <Label htmlFor="vessel_flight_details">Vessel or flight</Label>
            <input
              id="vessel_flight_details"
              name="vessel_flight_details"
              value={vessel_flight_details}
              onChange={(e) => setVessel(e.target.value)}
              className={inputClass}
              placeholder="Vessel name / voyage or flight no. & date"
            />
          </div>
        </Section>

        <Section title="Container details (if FCL)">
          <div>
            <Label htmlFor="container_details">Container no. / type / seal</Label>
            <textarea
              id="container_details"
              name="container_details"
              value={container_details}
              onChange={(e) => setContainer(e.target.value)}
              className={textareaClass}
              placeholder="If FCL: container number(s), type, seal numbers"
            />
          </div>
        </Section>

        <Section title="BL upload (HBL / MBL)">
          <div>
            <Label htmlFor="bl_upload">Bill of lading</Label>
            <input
              id="bl_upload"
              name="bl_upload"
              type="file"
              className={fileClass}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              PDF or image, max 15 MB
            </p>
          </div>
        </Section>

        <Section title="Invoice upload">
          <div>
            <Label htmlFor="invoice_upload">Commercial invoice</Label>
            <input
              id="invoice_upload"
              name="invoice_upload"
              type="file"
              className={fileClass}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
            />
          </div>
        </Section>

        <Section title="Packing list upload">
          <div>
            <Label htmlFor="packing_list_upload">Packing list</Label>
            <input
              id="packing_list_upload"
              name="packing_list_upload"
              type="file"
              className={fileClass}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
            />
          </div>
        </Section>

        <Section title="Other documents">
          <div>
            <Label htmlFor="other_documents">Additional files</Label>
            <input
              id="other_documents"
              name="other_documents"
              type="file"
              multiple
              className={fileClass}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
            />
          </div>
        </Section>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-[10px] bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60 sm:w-auto sm:min-w-[200px]"
        >
          {saving ? "Submitting…" : "Submit"}
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
