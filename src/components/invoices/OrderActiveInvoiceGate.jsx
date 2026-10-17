"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";

/**
 * Blocks tax invoice creation when order already has an active tax invoice.
 */
export default function OrderActiveInvoiceGate({
  orderId,
  quotationNumber,
  invoicesBasePath = "/accounts-dashboard/invoices",
  children,
}) {
  const [state, setState] = useState({ loading: Boolean(orderId), invoice: null });

  useEffect(() => {
    if (!orderId) {
      setState({ loading: false, invoice: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ order_id: orderId });
        if (quotationNumber) {
          params.set("quotation_number", quotationNumber);
        }
        const res = await fetch(`/api/orders/active-invoice?${params}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.found && data.invoice_number) {
          setState({ loading: false, invoice: data.invoice_number });
        } else {
          setState({ loading: false, invoice: null });
        }
      } catch {
        if (!cancelled) setState({ loading: false, invoice: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, quotationNumber]);

  if (!orderId) return children;

  if (state.loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={22} />
          Checking existing invoice…
        </div>
      </div>
    );
  }

  if (state.invoice) {
    const viewHref = `${invoicesBasePath}/${encodeURIComponent(state.invoice)}`;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <FileText className="text-amber-700" size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Invoice pehle se bana hua hai
          </h2>
          <p className="text-gray-600 text-sm mb-6">
            Order <span className="font-medium">{orderId}</span> ke liye active
            invoice{" "}
            <span className="font-semibold text-gray-800">{state.invoice}</span> hai.
            Naya tax invoice tabhi ban sakta hai jab purana delete ya cancel ho.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={viewHref}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FileText size={18} />
              View Invoice
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
