"use client";

import { useState, useRef, useMemo } from "react";
import { FileDown } from "lucide-react";
import QuotationViewModal from "@/components/Quotation/QuotationViewModal";
import QuickQuotationModal from "@/components/Quotation/QuickQuotationModal";
import QuotationViewer from "@/components/Quotation/QuotationViewer";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function UserQuotationsListClient({ quotations, isServiceSupport = false }) {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer_id") || "";

  const [modalQuote, setModalQuote] = useState(null);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [downloadingQuote, setDownloadingQuote] = useState(null);
  const [hiddenPayload, setHiddenPayload] = useState(null);
  const viewerRef = useRef(null);

  const editHref = (quoteNumber) => {
    return `/user-dashboard/quotations/${encodeURIComponent(quoteNumber)}/edit`;
  };

  const handleDownloadPdf = async (quoteNumber) => {
    if (downloadingQuote) return;
    setDownloadingQuote(quoteNumber);
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(quoteNumber)}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.header) {
        alert("Could not load quotation data.");
        return;
      }
      setHiddenPayload(data);
      setTimeout(async () => {
        if (viewerRef.current?.downloadPDF) {
          await viewerRef.current.downloadPDF();
        }
        setHiddenPayload(null);
        setDownloadingQuote(null);
      }, 300);
    } catch (e) {
      console.error(e);
      alert("PDF generation failed.");
      setDownloadingQuote(null);
    }
  };

  const displayed = statusFilter === "completed"
    ? quotations.filter(q => q.has_order)
    : statusFilter === "pending"
    ? quotations.filter(q => !q.has_order)
    : quotations;

  return (
    <>
      <QuotationViewModal
        quoteNumber={modalQuote}
        onClose={() => setModalQuote(null)}
        showAddProspectLink
      />

      <QuickQuotationModal
        isOpen={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        onSuccess={() => setShowQuickModal(false)}
      />

      {isServiceSupport && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowQuickModal(true)}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
          >
            + Quick Quotation
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-sm w-40"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="hidden md:block overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100 text-left text-sm text-gray-700">
            <tr>
              <th className="px-4 py-3">Quotation ID</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total Amount</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-800">
            {displayed.length > 0 ? (
              displayed.map((q) => (
                <tr
                  key={q.quote_number}
                  className="border-t hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-2">{q.quote_number}</td>
                  <td className="px-4 py-2">
                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="font-semibold">Company Name:</span>{" "}
                        {q.company_name}
                      </div>
                      <div>
                        <span className="font-semibold">Client Name:</span>{" "}
                        {q.client_name || q.company_name}
                      </div>
                      <div>
                        <span className="font-semibold">Email:</span> {q.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">{q.phone || "-"}</td>
                  <td className="px-4 py-2">
                    {new Date(q.quote_date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2">₹{q.grand_total}</td>
                  <td className="px-4 py-2">{q.created_by}</td>
                  <td className="px-4 py-2">
                    {q.has_order ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full border border-green-300">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full border border-gray-200">
                        <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalQuote(q.quote_number)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        View
                      </button>
                      {!q.has_order ? (
                        <Link
                          href={editHref(q.quote_number)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(q.quote_number)}
                        disabled={downloadingQuote === q.quote_number}
                        title="Download PDF"
                        className="inline-flex items-center justify-center p-1.5 rounded bg-red-100 hover:bg-red-200 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloadingQuote === q.quote_number
                          ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                          : <FileDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="8"
                  className="text-center text-gray-500 px-4 py-6 italic"
                >
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {displayed.length > 0 ? (
          displayed.map((q) => (
            <div
              key={q.quote_number}
              className="border rounded shadow-sm p-4 bg-white space-y-2"
            >
              <div>
                <strong>Quotation ID:</strong> {q.quote_number}
              </div>
              <div>
                <strong>Client:</strong> {q.client_name || q.company_name}
              </div>
              <div>
                <strong>Email:</strong> {q.email || "-"}
              </div>
              <div>
                <strong>Phone:</strong> {q.phone || "-"}
              </div>
              <div>
                <strong>Date:</strong>{" "}
                {new Date(q.quote_date).toLocaleDateString("en-IN")}
              </div>
              <div>
                <strong>Total:</strong> ₹{q.grand_total}
              </div>
              <div>
                <strong>Created By:</strong> {q.created_by}
              </div>
              <div>
                {q.has_order ? (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full border border-green-300">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                    Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full border border-gray-200">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
                    Pending
                  </span>
                )}
              </div>
              <div className="text-right flex items-center justify-end gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setModalQuote(q.quote_number)}
                  className="inline-block bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  View
                </button>
                {!q.has_order ? (
                  <Link
                    href={editHref(q.quote_number)}
                    className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Edit
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(q.quote_number)}
                  disabled={downloadingQuote === q.quote_number}
                  title="Download PDF"
                  className="inline-flex items-center justify-center p-1.5 rounded bg-red-100 hover:bg-red-200 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadingQuote === q.quote_number
                    ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                    : <FileDown className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 italic">No entries found.</p>
        )}
      </div>

      {hiddenPayload && (
        <div className="fixed -top-[9999px] -left-[9999px] w-[1123px] pointer-events-none opacity-0 overflow-hidden">
          <QuotationViewer
            ref={viewerRef}
            header={hiddenPayload.header}
            items={hiddenPayload.items || []}
            customerEmail={hiddenPayload.customerEmail || ""}
            customerPhone={hiddenPayload.customerPhone || ""}
            customerFirstName={hiddenPayload.customerFirstName || ""}
            showAddProspectLink={false}
          />
        </div>
      )}
    </>
  );
}
