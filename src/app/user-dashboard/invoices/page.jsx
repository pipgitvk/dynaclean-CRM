"use client";

import { useState } from "react";
import InvoiceTable from "./InvoiceTable";

export const dynamic = "force-dynamic";

export default function InvoicePage() {
  // State to hold summary data passed from InvoiceTable
  const [summaryData, setSummaryData] = useState({
    grandTotal: 0,
    balanceAmount: 0,
    taxAmount: 0,
    totalInvoices: 0,
  });

  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Invoice Management</h1>
        {/* <a
          href="/user-dashboard/invoices/new"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Add Invoice
        </a> */}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Grand Total Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200 p-6 shadow-md">
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">
            Grand Total
          </p>
          <p className="text-3xl font-bold text-blue-900">
            ₹{fmt(summaryData.grandTotal)}
          </p>
          <p className="text-xs text-blue-600 mt-2">
            {summaryData.totalInvoices} invoice{summaryData.totalInvoices !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Balance Amount Card */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg border-2 border-red-200 p-6 shadow-md">
          <p className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">
            Balance Amount
          </p>
          <p className="text-3xl font-bold text-red-900">
            ₹{fmt(summaryData.balanceAmount)}
          </p>
          <p className="text-xs text-red-600 mt-2">
            Pending amount
          </p>
        </div>

        {/* Tax Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border-2 border-green-200 p-6 shadow-md">
          <p className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-2">
            Total Tax
          </p>
          <p className="text-3xl font-bold text-green-900">
            ₹{fmt(summaryData.taxAmount)}
          </p>
          <p className="text-xs text-green-600 mt-2">
            GST, CGST, SGST, IGST
          </p>
        </div>
      </div>

      <InvoiceTable onSummaryUpdate={setSummaryData} />
    </div>
  );
}
