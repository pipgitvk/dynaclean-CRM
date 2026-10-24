"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

const invoicePageSize = 50;

export default function ViewAllInvoicesModal({ open, onClose }) {
  const [allInvoices, setAllInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");

  const fetchAllInvoices = useCallback(async (page = 1) => {
    try {
      setLoadingInvoices(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(invoicePageSize),
        fromDate: fromDate || "",
        toDate: toDate || "",
        search: invoiceSearch || "",
      });
      const res = await fetch(`/api/invoice-list?${params}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setAllInvoices(data.data ?? []);
        setInvoiceTotal(data.meta?.total || 0);
        setInvoicePage(page);
      } else {
        setAllInvoices([]);
        setInvoiceTotal(0);
      }
    } catch (e) {
      console.error("Failed to fetch invoices:", e);
      setAllInvoices([]);
      setInvoiceTotal(0);
    } finally {
      setLoadingInvoices(false);
    }
  }, [fromDate, toDate, invoiceSearch]);

  useEffect(() => {
    if (open) {
      setInvoicePage(1);
      fetchAllInvoices(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const downloadExcel = async () => {
    try {
      const params = new URLSearchParams({
        fromDate: fromDate || "",
        toDate: toDate || "",
        search: invoiceSearch || "",
      });
      const res = await fetch(`/api/invoices-export?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        alert("Failed to export invoices");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoices_${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Failed to export invoices");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800">All Invoices</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadExcel}
              disabled={invoiceTotal === 0 || loadingInvoices}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-semibold"
            >
              Download Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Close"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b bg-gray-50 space-y-3">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                From Date
              </label>
              <TypeableDateFilterInput
                value={fromDate}
                onChange={setFromDate}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                To Date
              </label>
              <TypeableDateFilterInput
                value={toDate}
                onChange={setToDate}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchAllInvoices(1)}
              disabled={loadingInvoices}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
            >
              Apply Filter
            </button>
          </div>
          <div>
            <input
              type="text"
              placeholder="Search by Invoice #, GSTIN, Employee, HSN, Item Code..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchAllInvoices(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="p-4">
          {loadingInvoices ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
            </div>
          ) : invoiceTotal === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No invoices found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 text-left">ID</th>
                      <th className="border p-2 text-left">Invoice #</th>
                      <th className="border p-2 text-left">Buyer Name</th>
                      <th className="border p-2 text-left">GSTIN</th>
                      <th className="border p-2 text-left">Employee</th>
                      <th className="border p-2 text-left">Invoice Date</th>
                      <th className="border p-2 text-left">Tax Amount</th>
                      <th className="border p-2 text-left">Taxable Amt</th>
                      <th className="border p-2 text-left">Grand Total</th>
                      <th className="border p-2 text-left">HSN</th>
                      <th className="border p-2 text-left">Qty</th>
                      <th className="border p-2 text-left">Taxable Value</th>
                      <th className="border p-2 text-left">CGST</th>
                      <th className="border p-2 text-left">SGST</th>
                      <th className="border p-2 text-left">IGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allInvoices.map((inv, idx) =>
                      inv.items && inv.items.length > 0
                        ? inv.items.map((item, itemIdx) => (
                            <tr
                              key={`${idx}-${itemIdx}`}
                              className="border-t hover:bg-blue-50"
                            >
                              {itemIdx === 0 && (
                                <>
                                  <td
                                    className="border p-2 text-blue-600 font-semibold"
                                    rowSpan={inv.items.length}
                                  >
                                    {inv.id}
                                  </td>
                                  <td
                                    className="border p-2 text-blue-600 font-semibold"
                                    rowSpan={inv.items.length}
                                  >
                                    {inv.invoice_number}
                                  </td>
                                  <td className="border p-2" rowSpan={inv.items.length}>
                                    {inv.buyer_name || "-"}
                                  </td>
                                  <td className="border p-2" rowSpan={inv.items.length}>
                                    {inv.gst_number || "-"}
                                  </td>
                                  <td className="border p-2" rowSpan={inv.items.length}>
                                    {inv.employee_name || "-"}
                                  </td>
                                  <td className="border p-2" rowSpan={inv.items.length}>
                                    {inv.invoice_date
                                      ? new Date(inv.invoice_date).toLocaleDateString(
                                          "en-IN",
                                        )
                                      : inv.created_at
                                        ? new Date(inv.created_at).toLocaleDateString(
                                            "en-IN",
                                          )
                                        : "-"}
                                  </td>
                                  <td
                                    className="border p-2 text-right font-semibold"
                                    rowSpan={inv.items.length}
                                  >
                                    ₹
                                    {Number(inv.tax_amount || 0).toLocaleString(
                                      "en-IN",
                                    )}
                                  </td>
                                  <td
                                    className="border p-2 text-right"
                                    rowSpan={inv.items.length}
                                  >
                                    ₹
                                    {Number(item.taxable_value || 0).toLocaleString(
                                      "en-IN",
                                    )}
                                  </td>
                                  <td
                                    className="border p-2 text-right font-semibold text-green-600"
                                    rowSpan={inv.items.length}
                                  >
                                    ₹
                                    {Number(inv.grand_total || 0).toLocaleString(
                                      "en-IN",
                                    )}
                                  </td>
                                </>
                              )}
                              <td className="border p-2">{item.hsn_code || "-"}</td>
                              <td className="border p-2 text-center">
                                {item.quantity || "-"}
                              </td>
                              <td className="border p-2 text-right">
                                ₹
                                {Number(item.taxable_value || 0).toLocaleString(
                                  "en-IN",
                                )}
                              </td>
                              <td className="border p-2 text-right">
                                ₹
                                {Number(item.cgst_amount || 0).toLocaleString(
                                  "en-IN",
                                )}
                              </td>
                              <td className="border p-2 text-right">
                                ₹
                                {Number(item.sgst_amount || 0).toLocaleString(
                                  "en-IN",
                                )}
                              </td>
                              <td className="border p-2 text-right">
                                ₹
                                {Number(item.igst_amount || 0).toLocaleString(
                                  "en-IN",
                                )}
                              </td>
                            </tr>
                          ))
                        : (
                            <tr key={idx} className="border-t hover:bg-blue-50">
                              <td className="border p-2 text-blue-600 font-semibold">
                                {inv.id}
                              </td>
                              <td className="border p-2 text-blue-600 font-semibold">
                                {inv.invoice_number}
                              </td>
                              <td className="border p-2">{inv.buyer_name || "-"}</td>
                              <td className="border p-2">{inv.gst_number || "-"}</td>
                              <td className="border p-2">{inv.employee_name || "-"}</td>
                              <td className="border p-2">
                                {inv.invoice_date
                                  ? new Date(inv.invoice_date).toLocaleDateString("en-IN")
                                  : inv.created_at
                                    ? new Date(inv.created_at).toLocaleDateString("en-IN")
                                    : "-"}
                              </td>
                              <td className="border p-2 text-right font-semibold">
                                ₹{Number(inv.tax_amount || 0).toLocaleString("en-IN")}
                              </td>
                              <td className="border p-2 text-right">₹0</td>
                              <td className="border p-2 text-right font-semibold text-green-600">
                                ₹{Number(inv.grand_total || 0).toLocaleString("en-IN")}
                              </td>
                              <td className="border p-2 text-center text-gray-500" colSpan={6}>
                                No items
                              </td>
                            </tr>
                          ),
                    )}
                  </tbody>
                </table>
              </div>

              {invoiceTotal > invoicePageSize && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    Showing {(invoicePage - 1) * invoicePageSize + 1} -{" "}
                    {Math.min(invoicePage * invoicePageSize, invoiceTotal)} of{" "}
                    {invoiceTotal} invoices
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fetchAllInvoices(invoicePage - 1)}
                      disabled={invoicePage === 1 || loadingInvoices}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm font-semibold text-gray-700">
                      Page {invoicePage}
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchAllInvoices(invoicePage + 1)}
                      disabled={
                        invoicePage * invoicePageSize >= invoiceTotal || loadingInvoices
                      }
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
