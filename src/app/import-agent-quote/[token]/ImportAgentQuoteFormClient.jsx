"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const initialForm = () => ({
  shipment_id: "",
  agent_id: "",
  ocean_freight: "",
  origin_cfs: "",
  origin_customs: "",
  origin_docs: "",
  origin_vgm: "",
  destination_cc_fee: "",
  destination_thc: "",
  destination_do_fee: "",
  destination_deconsole_fee: "",
  destination_gst: "",
  clearance_agency: "",
  clearance_loading: "",
  clearance_edi: "",
  clearance_exam: "",
  clearance_cfs_actual: "",
  clearance_transport_actual: "",
  clearance_misc: "",
  exchange_rate: "",
  total_cost_inr: "",
  remarks: "",
});

const inputClass =
  "h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", step }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        name={name}
        type={type}
        step={step}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}

export default function ImportAgentQuoteFormClient({ token }) {
  const [form, setForm] = useState(initialForm);
  const [agentName, setAgentName] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    setLoadError(null);
    setAlreadySubmitted(false);
    (async () => {
      try {
        const res = await fetch(
          `/api/import-crm/public-agent-quote/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.message || "This link is not valid.");
          setAgentName(null);
          setAlreadySubmitted(false);
          return;
        }
        setAgentName(data.agent_name || "Agent");
        setAlreadySubmitted(Boolean(data.already_submitted));
      } catch {
        if (!cancelled) {
          setLoadError("Could not load this page.");
          setAgentName(null);
          setAlreadySubmitted(false);
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const update = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/import-crm/public-agent-quote/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await res.json();
      if (res.status === 409) {
        setAlreadySubmitted(true);
        toast.error(
          data.message || "This form has already been submitted.",
        );
        return;
      }
      if (!res.ok) throw new Error(data.message || "Submit failed");
      toast.success("Thank you — your details were saved.");
      setAlreadySubmitted(true);
      setForm(initialForm());
    } catch (err) {
      toast.error(err.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMeta) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-600">
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {loadError}
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-slate-800">
          <p className="text-lg font-semibold">
            {agentName ? `Thank you, ${agentName}` : "Thank you"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            This link only accepts one submission. If you already sent your
            details, no further action is needed. For changes, contact your
            import team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Import agent quote
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {agentName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Please fill the freight and clearance details below. All fields are
          optional unless your team asked for specific items.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Shipment">
          <Field
            label="Shipment ID"
            name="shipment_id"
            value={form.shipment_id}
            onChange={update}
          />
          <Field
            label="Agent ID"
            name="agent_id"
            value={form.agent_id}
            onChange={update}
          />
        </Section>

        <Section title="Ocean & origin">
          <Field
            label="Ocean freight"
            name="ocean_freight"
            type="number"
            step="0.01"
            value={form.ocean_freight}
            onChange={update}
          />
          <Field
            label="Origin CFS"
            name="origin_cfs"
            type="number"
            step="0.01"
            value={form.origin_cfs}
            onChange={update}
          />
          <Field
            label="Origin customs"
            name="origin_customs"
            type="number"
            step="0.01"
            value={form.origin_customs}
            onChange={update}
          />
          <Field
            label="Origin docs"
            name="origin_docs"
            type="number"
            step="0.01"
            value={form.origin_docs}
            onChange={update}
          />
          <Field
            label="Origin VGM"
            name="origin_vgm"
            type="number"
            step="0.01"
            value={form.origin_vgm}
            onChange={update}
          />
        </Section>

        <Section title="Destination">
          <Field
            label="Destination CC fee"
            name="destination_cc_fee"
            type="number"
            step="0.01"
            value={form.destination_cc_fee}
            onChange={update}
          />
          <Field
            label="Destination THC"
            name="destination_thc"
            type="number"
            step="0.01"
            value={form.destination_thc}
            onChange={update}
          />
          <Field
            label="Destination DO fee"
            name="destination_do_fee"
            type="number"
            step="0.01"
            value={form.destination_do_fee}
            onChange={update}
          />
          <Field
            label="Destination deconsole fee"
            name="destination_deconsole_fee"
            type="number"
            step="0.01"
            value={form.destination_deconsole_fee}
            onChange={update}
          />
          <Field
            label="Destination GST"
            name="destination_gst"
            type="number"
            step="0.01"
            value={form.destination_gst}
            onChange={update}
          />
        </Section>

        <Section title="Clearance">
          <Field
            label="Clearance agency"
            name="clearance_agency"
            type="number"
            step="0.01"
            value={form.clearance_agency}
            onChange={update}
          />
          <Field
            label="Clearance loading"
            name="clearance_loading"
            type="number"
            step="0.01"
            value={form.clearance_loading}
            onChange={update}
          />
          <Field
            label="Clearance EDI"
            name="clearance_edi"
            type="number"
            step="0.01"
            value={form.clearance_edi}
            onChange={update}
          />
          <Field
            label="Clearance exam"
            name="clearance_exam"
            type="number"
            step="0.01"
            value={form.clearance_exam}
            onChange={update}
          />
          <Field
            label="Clearance CFS (actual)"
            name="clearance_cfs_actual"
            type="number"
            step="0.01"
            value={form.clearance_cfs_actual}
            onChange={update}
          />
          <Field
            label="Clearance transport (actual)"
            name="clearance_transport_actual"
            type="number"
            step="0.01"
            value={form.clearance_transport_actual}
            onChange={update}
          />
          <Field
            label="Clearance misc"
            name="clearance_misc"
            type="number"
            step="0.01"
            value={form.clearance_misc}
            onChange={update}
          />
        </Section>

        <Section title="Totals">
          <Field
            label="Exchange rate"
            name="exchange_rate"
            type="number"
            step="0.000001"
            value={form.exchange_rate}
            onChange={update}
          />
          <Field
            label="Total cost (INR)"
            name="total_cost_inr"
            type="number"
            step="0.01"
            value={form.total_cost_inr}
            onChange={update}
          />
        </Section>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Remarks
          </label>
          <textarea
            name="remarks"
            rows={4}
            className={`${inputClass} min-h-[5rem] py-2`}
            value={form.remarks}
            onChange={(e) => update("remarks", e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-[10px] bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:min-w-[12rem]"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
