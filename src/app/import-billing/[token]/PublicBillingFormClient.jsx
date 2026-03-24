"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const inputCls =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const textareaCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 min-h-[96px] resize-y";

const fileCls =
  "block w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100";

function Label({ children, htmlFor, required }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-gray-700">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3.5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </div>
  );
}

function ReadField({ label, value, mono }) {
  const v = value != null && String(value).trim() !== "" ? String(value) : "—";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-0.5 text-sm text-gray-800 ${mono ? "font-mono text-xs" : ""}`}>{v}</p>
    </div>
  );
}

export default function PublicBillingFormClient({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [shipment, setShipment] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [bill_no, setBillNo] = useState("");
  const [bill_date, setBillDate] = useState("");
  const [bill_amount, setBillAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [with_invoice, setWithInvoice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/import-crm/public-billing/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(data.message || "Could not load this link"); return; }
        setShipment(data.shipment || null);
        setSubmitted(Boolean(data.submitted));
        const f = data.form;
        if (f) {
          setSavedForm(f);
          setBillNo(f.bill_no || "");
          setBillDate(f.bill_date ? String(f.bill_date).slice(0, 10) : "");
          setBillAmount(f.bill_amount != null ? String(f.bill_amount) : "");
          setRemarks(f.remarks || "");
          setWithInvoice(Boolean(f.with_invoice));
        }
      } catch {
        if (!cancelled) setError("Could not load this link");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const onSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (submitted || saving) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/import-crm/public-billing/${encodeURIComponent(token)}`,
        { method: "POST", body: fd },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === "ALREADY_SUBMITTED") {
        setSubmitted(true);
        return;
      }
      if (!res.ok) throw new Error(data.message || "Submit failed");
      // Save current values so the success screen shows correct data
      setSavedForm({
        bill_no,
        bill_date,
        bill_amount: bill_amount !== "" ? bill_amount : null,
        remarks,
        with_invoice,
        bill_file: null,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }, [submitted, saving, token, bill_no, bill_date, bill_amount, remarks, with_invoice]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-white px-6 py-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Invalid link</p>
          <p className="mt-1 text-xs text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  /* ── Already submitted ── */
  if (submitted) {
    const f = savedForm;
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top bar */}
        <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-lg">
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Dynaclean Industries</p>
            <h1 className="mt-0.5 text-lg font-bold text-gray-900 sm:text-xl">Billing submission</h1>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
          {/* Big success card */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex flex-col items-center px-6 py-8 text-center">
              {/* Animated circle check */}
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Billing submitted successfully!</h2>
              <p className="mt-2 max-w-xs text-sm text-gray-500">
                Your billing details have been received. You cannot edit or resubmit this form.
              </p>
              {shipment && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2">
                  <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Shipment #{shipment.id}</span>
                    <span className="mx-2 text-gray-300">·</span>
                    {shipment.ship_from} → {shipment.ship_to}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submitted details summary */}
          {f && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-3.5">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-400">Submitted details</h3>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="grid grid-cols-2 gap-x-6 px-5 py-4 sm:grid-cols-3">
                  <ReadField label="Bill no." value={f.bill_no} />
                  <ReadField label="Bill date" value={f.bill_date} />
                  <ReadField
                    label="Bill amount"
                    value={f.bill_amount != null && f.bill_amount !== ""
                      ? `₹ ${Number(f.bill_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : null}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-6 px-5 py-4">
                  <ReadField label="With invoice" value={f.with_invoice ? "Yes" : "No"} />
                  <ReadField label="Remarks" value={f.remarks} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-lg">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Dynaclean Industries</p>
          <h1 className="mt-0.5 text-lg font-bold text-gray-900 sm:text-xl">Submit billing details</h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 pb-16 sm:px-6">
        {/* Shipment pill */}
        {shipment && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Shipment #{shipment.id}</span>
              <span className="mx-2 text-gray-300">·</span>
              {shipment.ship_from} → {shipment.ship_to}
            </p>
          </div>
        )}

        <form className="space-y-4" onSubmit={onSubmit}>

          {/* ── Bill details ── */}
          <SectionCard title="Bill details">
            <div>
              <Label htmlFor="bill_no" required>Bill number</Label>
              <input
                id="bill_no"
                name="bill_no"
                required
                value={bill_no}
                onChange={(e) => setBillNo(e.target.value)}
                className={inputCls}
                placeholder="e.g. INV-2026-001"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="bill_date">Bill date</Label>
                <input
                  id="bill_date"
                  name="bill_date"
                  type="date"
                  value={bill_date}
                  onChange={(e) => setBillDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <Label htmlFor="bill_amount">Bill amount (₹)</Label>
                <input
                  id="bill_amount"
                  name="bill_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={bill_amount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
            </div>
          </SectionCard>

          {/* ── Invoice & documents ── */}
          <SectionCard title="Invoice & documents" subtitle="PDF or image file, max 15 MB">
            <div>
              <Label htmlFor="bill_file">Bill / invoice file</Label>
              <div className="mt-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 transition hover:border-blue-400 hover:bg-blue-50/30">
                <input
                  id="bill_file"
                  name="bill_file"
                  type="file"
                  className={fileCls}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                />
              </div>
            </div>
            <label className="flex cursor-pointer select-none items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:bg-gray-50">
              <input
                type="checkbox"
                name="with_invoice"
                value="1"
                checked={with_invoice}
                onChange={(e) => setWithInvoice(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">With invoice</p>
                <p className="text-xs text-gray-400">Check if invoice is included with this submission</p>
              </div>
            </label>
          </SectionCard>

          {/* ── Remarks ── */}
          <SectionCard title="Remarks">
            <div>
              <Label htmlFor="remarks">Additional notes</Label>
              <textarea
                id="remarks"
                name="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className={textareaCls}
                placeholder="Any notes or remarks…"
              />
            </div>
          </SectionCard>

          {/* ── Submit ── */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                "Submit billing details"
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
