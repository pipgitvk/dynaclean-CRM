"use client";

import { useState } from "react";
import Link from "next/link";
import QuotationViewModal from "@/components/Quotation/QuotationViewModal";

export default function UserQuotationsListClient({ quotations }) {
  const [modalQuote, setModalQuote] = useState(null);

  return (
    <>
      <QuotationViewModal
        quoteNumber={modalQuote}
        onClose={() => setModalQuote(null)}
        showAddProspectLink
      />

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
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-800">
            {quotations.length > 0 ? (
              quotations.map((q) => (
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
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-wrap gap-1 justify-center items-center">
                      <button
                        type="button"
                        onClick={() => setModalQuote(q.quote_number)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        View
                      </button>
                      <Link
                        href={`/user-dashboard/quotations/${encodeURIComponent(q.quote_number)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm border border-gray-400 text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
                      >
                        Full page
                      </Link>
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
        {quotations.length > 0 ? (
          quotations.map((q) => (
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

              <div className="text-right flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModalQuote(q.quote_number)}
                  className="inline-block bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  View
                </button>
                <Link
                  href={`/user-dashboard/quotations/${encodeURIComponent(q.quote_number)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm border border-gray-400 text-gray-700 px-3 py-1 rounded hover:bg-gray-50"
                >
                  Full page
                </Link>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 italic">No entries found.</p>
        )}
      </div>
    </>
  );
}
