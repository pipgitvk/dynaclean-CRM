"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { X, FileText } from "lucide-react";
import InvoiceForm from "./submit-form";
import OrderActiveInvoiceGate from "@/components/invoices/OrderActiveInvoiceGate";

export default function InvoiceTypeSelector({ invoiceNumber, invoiceDate }) {
  const searchParams = useSearchParams();
  const initialQuotationNumber = String(
    searchParams.get("quotation_number") ||
      searchParams.get("quote_number") ||
      "",
  ).trim();
  const initialOrderId = String(searchParams.get("order_id") || "").trim();
  const returnTo = String(searchParams.get("return_to") || "").trim();
  const orderListRedirect =
    returnTo || (initialOrderId ? "/admin-dashboard/order" : undefined);

  const [invoiceType, setInvoiceType] = useState(null);
  const [existingTaxInvoice, setExistingTaxInvoice] = useState(null);
  const [checkingOrder, setCheckingOrder] = useState(Boolean(initialOrderId));

  useEffect(() => {
    if (!initialOrderId) {
      setCheckingOrder(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ order_id: initialOrderId });
        if (initialQuotationNumber) {
          params.set("quotation_number", initialQuotationNumber);
        }
        const res = await fetch(`/api/orders/active-invoice?${params}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.found) {
          setExistingTaxInvoice(data.invoice_number);
        }
      } catch {
        /* API enforces on submit */
      } finally {
        if (!cancelled) setCheckingOrder(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialOrderId, initialQuotationNumber]);

  if (invoiceType === "tax") {
    return (
      <OrderActiveInvoiceGate
        orderId={initialOrderId}
        quotationNumber={initialQuotationNumber}
        invoicesBasePath="/admin-dashboard/invoices"
      >
        <InvoiceForm
          invoiceNumber={invoiceNumber}
          invoiceDate={invoiceDate}
          invoiceType={invoiceType}
          onBack={() => setInvoiceType(null)}
          onSuccessRedirect={orderListRedirect}
          initialQuotationNumber={initialQuotationNumber}
          initialOrderId={initialOrderId}
        />
      </OrderActiveInvoiceGate>
    );
  }

  if (invoiceType === "performa") {
    return (
      <InvoiceForm
        invoiceNumber={invoiceNumber}
        invoiceDate={invoiceDate}
        invoiceType={invoiceType}
        onBack={() => setInvoiceType(null)}
        onSuccessRedirect={orderListRedirect}
        initialQuotationNumber={initialQuotationNumber}
        initialOrderId={initialOrderId}
      />
    );
  }

  const viewHref = existingTaxInvoice
    ? `/admin-dashboard/invoices/${encodeURIComponent(existingTaxInvoice)}`
    : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Select Invoice Type</h2>
          <button
            onClick={() => window.history.back()}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {checkingOrder ? (
          <p className="text-gray-500 text-sm mb-6">Checking existing invoice…</p>
        ) : null}

        {existingTaxInvoice && viewHref ? (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="mb-2">
              Is order ke liye tax invoice{" "}
              <span className="font-semibold">{existingTaxInvoice}</span> pehle se
              hai. Naya tax invoice delete/cancel ke baad hi banega.
            </p>
            <Link
              href={viewHref}
              className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
            >
              <FileText size={16} />
              View Invoice
            </Link>
          </div>
        ) : null}

        <p className="text-gray-600 text-sm mb-8">
          Choose the type of invoice you want to create:
        </p>

        <div className="space-y-4">
          <button
            type="button"
            disabled={Boolean(existingTaxInvoice) || checkingOrder}
            onClick={() => setInvoiceType("tax")}
            className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200">
              <FileText size={24} className="text-blue-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800 text-lg">Tax Invoice</h3>
              <p className="text-gray-600 text-sm">
                Standard tax invoice for business transactions
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setInvoiceType("performa")}
            className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200">
              <FileText size={24} className="text-purple-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800 text-lg">Performa Invoice</h3>
              <p className="text-gray-600 text-sm">
                Preliminary invoice before formal billing
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
