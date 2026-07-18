"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ChevronRight, ChevronDown } from "lucide-react";
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
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  // Calculate total linked amount for each invoice (for display)
  const invoicesWithLinkedAmount = useMemo(() => {
    return invoices.map(invoice => ({
      ...invoice,
      totalLinkedAmount: invoice.linkedStatements?.reduce(
        (sum, stmt) => sum + Number(stmt.amount || 0),
        0
      ) || 0
    }));
  }, [invoices]);

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
    return [...invoicesWithLinkedAmount].sort((a, b) => {
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
  }, [invoicesWithLinkedAmount, sortCol, sortDir]);

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
              <th className="px-4 py-3 w-12"></th>
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
              <th className="px-4 py-3 text-right font-semibold text-gray-600 whitespace-nowrap">
                Balance Amount
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
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                  No invoices found for this buyer.
                </td>
              </tr>
            ) : (
              sorted.map((inv) => (
                <>
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 w-12">
                      {inv.linkedStatements && inv.linkedStatements.length > 0 && (
                        <button
                          onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                          className="text-gray-600 hover:text-blue-600"
                        >
                          {expandedInvoiceId === inv.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {inv.invoice_number}
                      {inv.linkedStatements && inv.linkedStatements.length > 0 && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {inv.linkedStatements.length} Linked
                        </span>
                      )}
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
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      <span className={Number(inv.balance_amount) > 0 ? "text-red-600" : "text-green-600"}>
                        ₹{fmtDecimal(inv.balance_amount)}
                      </span>
                      {inv.totalLinkedAmount > 0 && (
                        <div className="text-xs text-gray-500">
                          (-₹{fmtDecimal(inv.totalLinkedAmount)})
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {inv.created_at
                        ? dayjs(inv.created_at).format("D/M/YYYY")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/admin-dashboard/invoices/${encodeURIComponent(inv.invoice_number)}`}
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
                  {expandedInvoiceId === inv.id && inv.linkedStatements && inv.linkedStatements.length > 0 && (
                    <tr>
                      <td colSpan={10} className="px-8 py-4 bg-gray-50">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-gray-700">Linked Payments:</h4>
                          <div className="text-right">
                            <span className="text-sm text-gray-500">Total Linked: </span>
                            <span className="text-lg font-bold text-red-600">
                              ₹{fmtDecimal(inv.totalLinkedAmount)}
                            </span>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm border rounded">
                            <thead className="bg-gray-200">
                              <tr>
                                <th className="px-4 py-2 text-left">ID</th>
                                <th className="px-4 py-2 text-left">Trans ID</th>
                                <th className="px-4 py-2 text-left">Date</th>
                                <th className="px-4 py-2 text-left">Description</th>
                                <th className="px-4 py-2 text-right">Amount</th>
                                <th className="px-4 py-2 text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inv.linkedStatements.map((stmt) => (
                                <tr key={stmt.id} className="border-t">
                                  <td className="px-4 py-2">{stmt.id}</td>
                                  <td className="px-4 py-2 font-mono">{stmt.trans_id || "—"}</td>
                                  <td className="px-4 py-2">
                                    {stmt.date ? dayjs(stmt.date).format("D/M/YYYY") : "—"}
                                  </td>
                                  <td className="px-4 py-2 max-w-xs truncate" title={stmt.description}>
                                    {stmt.description || "—"}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-red-600">
                                    ₹{fmtDecimal(stmt.amount)}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      stmt.invoice_status === "Settled" 
                                        ? "bg-green-100 text-green-800" 
                                        : stmt.invoice_status === "Partial Paid" 
                                          ? "bg-yellow-100 text-yellow-800" 
                                          : "bg-gray-100 text-gray-800"
                                    }`}>
                                      {stmt.invoice_status || "Unsettled"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>

          {sorted.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <td colSpan={5} className="px-4 py-3 text-gray-700">
                  Total ({invoices.length} invoices)
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  ₹{fmtDecimal(totalTax)}
                </td>
                <td className="px-4 py-3 text-right text-green-600">
                  ₹{fmt(grandTotal)}
                </td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    const totalRemaining = sorted.reduce((sum, inv) => sum + Number(inv.balance_amount), 0);
                    return <span className={totalRemaining > 0 ? "text-red-600" : "text-green-600"}>₹{fmtDecimal(totalRemaining)}</span>;
                  })()}
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
