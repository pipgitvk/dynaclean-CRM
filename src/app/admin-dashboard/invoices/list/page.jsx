"use client";

import InvoiceTable from "@/app/admin-dashboard/invoices/InvoiceTable";

export const dynamic = "force-dynamic";

export default function InvoicePage() {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Invoice Management</h1>
        <a
          href="/admin-dashboard/invoices/new"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Add Invoice
        </a>
      </div>

      <InvoiceTable />
    </div>
  );
}
