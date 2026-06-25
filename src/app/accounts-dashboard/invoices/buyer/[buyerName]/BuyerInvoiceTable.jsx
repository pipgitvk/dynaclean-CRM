"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";
import dayjs from "dayjs";
import InvoiceEditModal from "@/app/admin-dashboard/invoices/InvoiceEditModal";

const fmt = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDecimal = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BuyerInvoiceTable({ invoices: initialInvoices, buyerName }) {
  const [invoices, setInvoices] = useState(initialInvoices ?? []);
  const [sortCol, setSortCol] = useState("order_date");
  const [sortDir, setSortDir] = useState("desc");
  const [editId, setEditId] = useState(null);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="ml-1 text-gray-300">↕</span>;
    return sortDir === "asc"
      ? <ArrowUp size={13} className="ml-1 inline text-blue-600" />
      : <ArrowDown size={13} className="ml-1 inline text-blue-600" />;
  };

  const sorted = useMemo(() => {
    return [...invoices].sort((a, b) => {
      let aVal = a[sortCol] ?? "";
      let bVal = b[sortCol] ?? "";
      if (sortCol === "grand_total" || sortCol === "tax_amount") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [invoices, sortCol, sortDir]);

  const grandTotal = useMemo(
    () => invoices.reduce((s, i) => s + Number(i.grand_total || 0), 0),
    [invoices]
  );

  const totalTax = useMemo(
    () => invoices.reduce((s, i) => s + Number(i.tax_amount || 0), 0),
    [invoices]
  );

  return (
    <div className="space-y-3">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">Invoices</h2>
        <span className="text-sm text-gray-500">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} · Total:{" "}
          <span className="font-semibold text-green-600">₹{fmt(grandTotal)}</span>
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th
                onClick={() => handleSort("invoice_number")}
                className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-blue-600"
              >
                Invoice No <SortIcon col="invoice_number" />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                Buyer
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                Employee
              </th>
              <th
                onClick={() => handleSort("order_date")}
                className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-blue-600"
              >
                Order Date <SortIcon col="order_date" />
              </th>
              <th
                onClick={() => handleSort("tax_amount")}
                className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-blue-600"
              >
                Tax <SortIcon col="tax_amount" />
              </th>
              <th
                onClick={() => handleSort("grand_total")}
                className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-blue-600"
              >
                Grand Total <SortIcon col="grand_total" />
              </th>
              <th
                onClick={() => handleSort("created_at")}
                className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-blue-600"
              >
                Created <SortIcon col="created_at" />
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 whitespace-nowrap">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  No invoices found for this buyer.
                </td>
              </tr>
            ) : (
              sorted.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {inv.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[220px]">
                    {buyerName}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {inv.employee_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {inv.order_date
                      ? dayjs(inv.order_date).format("D/M/YYYY")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    ₹{fmtDecimal(inv.tax_amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                    ₹{fmt(inv.grand_total)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {inv.created_at
                      ? dayjs(inv.created_at).format("D/M/YYYY")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        href={`/accounts-dashboard/invoices/${encodeURIComponent(inv.invoice_number)}`}
                        className="rounded px-3 py-1 bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => setEditId(inv.id)}
                        className="rounded px-3 py-1 bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {sorted.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-gray-700">
                  Total ({invoices.length} invoices)
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  ₹{fmtDecimal(totalTax)}
                </td>
                <td className="px-4 py-3 text-right text-green-600">
                  ₹{fmt(grandTotal)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Edit Modal */}
      {editId != null && (
        <InvoiceEditModal
          open
          invoiceId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            // Reload page to refresh invoice data
            window.location.reload();
          }}
          viewHrefBase="/admin-dashboard/invoices"
        />
      )}
    </div>
  );
}
