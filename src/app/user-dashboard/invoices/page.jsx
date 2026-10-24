"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, LayoutGrid } from "lucide-react";
import InvoiceTable from "./InvoiceTable";
import ViewAllInvoicesModal from "./ViewAllInvoicesModal";

export const dynamic = "force-dynamic";

export default function InvoicePage() {
  const [viewAllOpen, setViewAllOpen] = useState(false);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Invoice Management</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setViewAllOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            <FileText size={16} />
            View All
          </button>
          <Link
            href="/accounts-dashboard/invoices"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700"
          >
            <LayoutGrid size={16} />
            Cards
          </Link>
          <Link
            href="/accounts-dashboard/invoices/new"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700"
          >
            <FileText size={16} />
            Add Invoice
          </Link>
        </div>
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

      <ViewAllInvoicesModal
        open={viewAllOpen}
        onClose={() => setViewAllOpen(false)}
      />
    </div>
  );
}
