"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import InvoiceEditModal from "./InvoiceEditModal";
import ExcelJS from "exceljs";

export default function InvoiceTable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Sorting
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [fetchError, setFetchError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    const params = new URLSearchParams();
    params.append("page", currentPage);
    params.append("limit", limit);
    params.append("sort", sortBy);
    params.append("order", sortOrder);

    if (fromDate) params.append("fromDate", fromDate);
    if (toDate) params.append("toDate", toDate);
    if (search) params.append("search", search);

    try {
      setFetchError(null);
      const res = await fetch(`/api/invoice-table?${params.toString()}`);
      const response = await res.json();
      console.log("response data :", response);

      if (response.success) {
        setInvoices(response.data || []);
        setMeta(response.meta);
      } else {
        setInvoices([]);
        setFetchError(response.detail || response.error || "Failed to load invoices");
      }
    } catch (err) {
      console.error("Fetch invoices failed:", err);
      setInvoices([]);
      setFetchError(err?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, limit, fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchData();
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const handleReset = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setSortBy("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
    setFetchError(null);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const fetchAllDataForExport = async () => {
    const params = new URLSearchParams();
    params.append("page", 1);
    params.append("limit", 100000); // Large limit to get all data
    params.append("sort", sortBy);
    params.append("order", sortOrder);

    if (fromDate) params.append("fromDate", fromDate);
    if (toDate) params.append("toDate", toDate);
    if (search) params.append("search", search);

    try {
      const res = await fetch(`/api/invoice-table?${params.toString()}`);
      const response = await res.json();

      if (response.success) {
        return response.data || [];
      } else {
        throw new Error(response.detail || response.error || "Failed to load invoices");
      }
    } catch (err) {
      console.error("Fetch invoices for export failed:", err);
      throw err;
    }
  };

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const allInvoices = await fetchAllDataForExport();

      if (allInvoices.length === 0) {
        alert("No data to export");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Invoices");

      // Define columns for main invoice data
      worksheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Invoice Number", key: "invoice_number", width: 25 },
        { header: "GSTIN No", key: "gst_number", width: 20 },
        { header: "Buyer Name", key: "buyer_name", width: 30 },
        { header: "Order Date", key: "order_date", width: 15 },
        { header: "Tax Amount", key: "tax_amount", width: 15 },
        { header: "Grand Total", key: "grand_total", width: 15 },
        { header: "Created At", key: "created_at", width: 20 },
        { header: "Item Code", key: "item_code", width: 15 },
        { header: "Item Name", key: "item_name", width: 30 },
        { header: "HSN", key: "hsn_code", width: 15 },
        { header: "Quantity", key: "quantity", width: 12 },
        { header: "Taxable Value", key: "taxable_value", width: 15 },
        { header: "CGST", key: "cgst_amount", width: 12 },
        { header: "SGST", key: "sgst_amount", width: 12 },
        { header: "IGST", key: "igst_amount", width: 12 },
        { header: "Price Per Unit", key: "price_per_unit", width: 15 },
        { header: "Image URL", key: "imageUrl", width: 40 },
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data rows - flatten items into rows
      allInvoices.forEach((invoice) => {
        if (invoice.items && invoice.items.length > 0) {
          // Add a row for each item
          invoice.items.forEach((item, index) => {
            worksheet.addRow({
              id: index === 0 ? invoice.id : "",
              invoice_number: index === 0 ? invoice.invoice_number : "",
              gst_number: index === 0 ? (invoice.gst_number || "") : "",
              buyer_name: index === 0 ? invoice.buyer_name : "",
              order_date: index === 0 ? (invoice.order_date ? new Date(invoice.order_date).toLocaleDateString("en-IN") : "") : "",
              tax_amount: index === 0 ? invoice.tax_amount : "",
              grand_total: index === 0 ? invoice.grand_total : "",
              created_at: index === 0 ? (invoice.created_at ? new Date(invoice.created_at).toLocaleString("en-IN") : "") : "",
              item_code: item.product_code || "",
              item_name: item.item_name || "",
              hsn_code: item.hsn_code || "",
              quantity: item.quantity || 0,
              taxable_value: item.taxable_value || 0,
              cgst_amount: item.cgst_amount || 0,
              sgst_amount: item.sgst_amount || 0,
              igst_amount: item.igst_amount || 0,
              price_per_unit: item.price_per_unit || 0,
              imageUrl: item.imageUrl || "",
            });
          });
        } else {
          // Add a row for invoice without items
          worksheet.addRow({
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            gst_number: invoice.gst_number || "",
            buyer_name: invoice.buyer_name,
            order_date: invoice.order_date ? new Date(invoice.order_date).toLocaleDateString("en-IN") : "",
            tax_amount: invoice.tax_amount,
            grand_total: invoice.grand_total,
            created_at: invoice.created_at ? new Date(invoice.created_at).toLocaleString("en-IN") : "",
            item_code: "",
            item_name: "",
            hsn_code: "",
            quantity: 0,
            taxable_value: 0,
            cgst_amount: 0,
            sgst_amount: 0,
            igst_amount: 0,
            price_per_unit: 0,
            imageUrl: "",
          });
        }
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Create download link
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoices_${fromDate || "all"}_${toDate || "all"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const max = 5;
    let start = Math.max(1, currentPage - Math.floor(max / 2));
    let end = Math.min(meta.totalPages, start + max - 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const SortIcon = ({ column }) =>
    sortBy !== column ? (
      <span className="ml-1 text-gray-400">↕</span>
    ) : sortOrder === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );

  return (
    <div className="bg-white rounded shadow p-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row justify-between gap-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleReset}
            className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
          >
            Reset
          </button>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border px-3 py-1 rounded"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border px-3 py-1 rounded"
          />
          <button
            onClick={handleExportToExcel}
            disabled={isExporting}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isExporting ? "Exporting..." : "Export Excel"}
          </button>
        </div>
        <input
          type="text"
          placeholder="Search by invoice or buyer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-1 rounded w-full md:w-64"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto hidden md:block border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th
                onClick={() => handleSort("invoice_number")}
                className="px-4 py-2 cursor-pointer"
              >
                Invoice No <SortIcon column="invoice_number" />
              </th>
              <th className="px-4 py-2">Buyer</th>
              <th
                onClick={() => handleSort("order_date")}
                className="px-4 py-2 cursor-pointer"
              >
                Order Date <SortIcon column="order_date" />
              </th>
              <th className="px-4 py-2">Tax</th>
              <th className="px-4 py-2">Grand Total</th>
              <th
                onClick={() => handleSort("created_at")}
                className="px-4 py-2 cursor-pointer"
              >
                Created <SortIcon column="created_at" />
              </th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan="7" className="text-center py-6 text-red-600">
                  {fetchError}
                </td>
              </tr>
            ) : invoices.length ? (
              invoices.map((i) => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{i.invoice_number}</td>
                  <td className="px-4 py-2">{i.buyer_name}</td>
                  <td className="px-4 py-2">
                    {new Date(i.order_date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2">
                    ₹{Number(i.tax_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    ₹{Number(i.grand_total).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2">
                    {new Date(i.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <Link
                        href={`/admin-dashboard/invoices/${encodeURIComponent(i.invoice_number)}`}
                        className="bg-green-600 text-white px-3 py-1 rounded inline-block"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditId(i.id)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-500">
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center mt-6 gap-1">
          {getPageNumbers().map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`px-3 py-1 rounded ${p === currentPage ? "bg-green-600 text-white" : "bg-gray-100"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {editId != null && (
        <InvoiceEditModal
          open
          invoiceId={editId}
          onClose={() => setEditId(null)}
          onSaved={fetchData}
          viewHrefBase="/admin-dashboard/invoices"
        />
      )}
    </div>
  );
}
