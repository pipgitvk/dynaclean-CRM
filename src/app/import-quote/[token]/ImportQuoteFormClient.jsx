"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  initialImportQuoteForm,
  ImportCrmPublicQuoteFormSections,
} from "@/components/import-crm/ImportCrmPublicQuoteFormSections";

export default function ImportQuoteFormClient({ token }) {
  const [form, setForm] = useState(initialImportQuoteForm);
  const [supplierName, setSupplierName] = useState(null);
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
          `/api/import-crm/public-quote/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.message || "This link is not valid.");
          setSupplierName(null);
          setAlreadySubmitted(false);
          return;
        }
        setSupplierName(data.supplier_name || "Supplier");
        setAlreadySubmitted(Boolean(data.already_submitted));
      } catch {
        if (!cancelled) {
          setLoadError("Could not load this page.");
          setSupplierName(null);
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
        `/api/import-crm/public-quote/${encodeURIComponent(token)}`,
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
      setForm(initialImportQuoteForm());
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
            {supplierName ? `Thank you, ${supplierName}` : "Thank you"}
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
          Import quote
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {supplierName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Please fill the freight and clearance details below. All fields are
          optional unless your team asked for specific items.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ImportCrmPublicQuoteFormSections
          form={form}
          update={update}
          shipmentIdReadOnly={false}
        />

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
