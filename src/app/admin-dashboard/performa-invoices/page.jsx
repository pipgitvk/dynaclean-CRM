"use client";

import Link from "next/link";
import PerformaInvoiceList from "@/components/invoice/PerformaInvoiceList";

export const dynamic = "force-dynamic";

export default function PerformaInvoicesListPage() {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Performa Invoices</h1>
        <Link
          href="/admin-dashboard/invoices/performa"
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 inline-flex items-center gap-2 font-medium"
        >
          <span>+</span> New Performa Invoice
        </Link>
      </div>

      <PerformaInvoiceList viewHrefBase="/admin-dashboard/invoices" />
    </div>
  );
}
