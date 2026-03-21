"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import QuotationViewer from "./QuotationViewer";

export default function QuotationViewModal({
  quoteNumber,
  onClose,
  showAddProspectLink = true,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!quoteNumber) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quoteNumber, onClose]);

  useEffect(() => {
    if (!quoteNumber) {
      setPayload(null);
      setErr("");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(
          `/api/quotations/${encodeURIComponent(quoteNumber)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success || !data.header) {
          setErr(data.message || "Could not load quotation");
          setPayload(null);
        } else {
          setPayload(data);
        }
      } catch {
        if (!cancelled) {
          setErr("Could not load quotation");
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quoteNumber]);

  if (!quoteNumber) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-black/50 w-full h-full cursor-default border-0 p-0"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="flex min-h-full items-start justify-center p-2 sm:p-4 pointer-events-none">
        <div
          className="relative bg-gray-100 rounded-lg shadow-xl w-full max-w-5xl my-4 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quotation-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 p-3 border-b bg-white shrink-0">
            <h2
              id="quotation-modal-title"
              className="text-base sm:text-lg font-semibold truncate pr-2"
            >
              Quotation {quoteNumber}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100 text-gray-600 shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-3 sm:p-4 min-h-0">
            {loading ? (
              <p className="text-center text-gray-600 py-8">Loading…</p>
            ) : null}
            {err && !loading ? (
              <p className="text-center text-red-600 py-8">{err}</p>
            ) : null}
            {payload && !loading ? (
              <QuotationViewer
                header={payload.header}
                items={payload.items || []}
                customerEmail={payload.customerEmail || ""}
                customerPhone={payload.customerPhone || ""}
                customerFirstName={payload.customerFirstName || ""}
                showAddProspectLink={showAddProspectLink}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
