"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  initialImportQuoteForm,
  ImportCrmPublicQuoteFormSections,
  importQuoteInputClass,
} from "@/components/import-crm/ImportCrmPublicQuoteFormSections";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PublicShipmentViewClient({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shipment, setShipment] = useState(null);
  const [form, setForm] = useState(initialImportQuoteForm);
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setSubmitDone(false);
      try {
        const res = await fetch(
          `/api/import-crm/public-shipment/${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message || "Could not load shipment");
          setShipment(null);
          return;
        }
        setShipment(data.shipment || null);
      } catch {
        if (!cancelled) {
          setError("Could not load shipment");
          setShipment(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const update = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
  }, []);

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (submitDone || submitInFlightRef.current) return;
    const emailTrim = submitterEmail.trim().toLowerCase();
    if (!emailTrim) {
      toast.error("Please enter your email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
      const { shipment_id: _omitShipmentId, ...payload } = form;
      const res = await fetch(
        `/api/import-crm/public-shipment/${encodeURIComponent(token)}/quotation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            submitter_email: emailTrim,
          }),
        },
      );
      const data = await res.json();
      if (res.status === 409 && data.code === "DUPLICATE_EMAIL") {
        submitInFlightRef.current = false;
        toast.error(data.message || "You have already submitted.");
        return;
      }
      if (res.status === 409) {
        submitInFlightRef.current = false;
        toast.error(data.message || "Could not submit.");
        return;
      }
      if (!res.ok) {
        submitInFlightRef.current = false;
        throw new Error(data.message || "Submit failed");
      }
      toast.success("Thank you — your quote was saved.");
      setSubmitDone(true);
    } catch (err) {
      submitInFlightRef.current = false;
      toast.error(err.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-600">
        Loading…
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-medium text-slate-900">Shipment not found</p>
        <p className="mt-2 text-sm text-slate-600">
          {error || "This link may be invalid or expired."}
        </p>
      </div>
    );
  }

  const rows = [
    ["From (origin)", shipment.ship_from],
    ["To (destination)", shipment.ship_to],
    [
      "CBM (cubic metres)",
      shipment.cbm != null
        ? Number(shipment.cbm).toLocaleString("en-IN")
        : "—",
    ],
    ["Shipment term", shipment.shipment_term || "—"],
    ["Mode", shipment.mode || "—"],
    ["Material ready date", formatDate(shipment.material_ready_date)],
    ["Agent delivery deadline", formatDate(shipment.agent_delivery_deadline)],
    ["Remarks", shipment.remarks?.trim() ? shipment.remarks : "—"],
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        Shipment details
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Shared read-only summary for logistics.
      </p>
      <dl className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-start sm:gap-4"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="text-sm text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 border-t border-slate-200 pt-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Import quote
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          Freight & clearance
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter your work email: the same email cannot submit twice for this
          shipment (others may still submit with their own email). Other fields
          are optional unless your import team asked for them.
        </p>

        {submitDone ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center text-slate-800">
            <p className="text-lg font-semibold">Thank you</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Your quote for this shipment was saved. For changes, contact your
              import team.
            </p>
          </div>
        ) : (
          <form onSubmit={handleQuoteSubmit} className="mt-6 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Your email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                name="submitter_email"
                autoComplete="email"
                required
                className={importQuoteInputClass}
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <ImportCrmPublicQuoteFormSections
              form={form}
              update={update}
              hideShipmentIdField
            />

            <button
              type="submit"
              disabled={submitting || submitDone}
              className="h-11 w-full rounded-[10px] bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[12rem]"
            >
              {submitting ? "Submitting…" : "Submit quote"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
