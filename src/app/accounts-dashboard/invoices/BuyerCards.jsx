"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, FileText, IndianRupee, X } from "lucide-react";
import dayjs from "dayjs";

function getInitials(name = "") {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-amber-500",
];

function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const fmt = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function BuyerCards() {
  const router = useRouter();
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [showViewModal, setShowViewModal] = useState(false);
  const [allInvoices, setAllInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const invoicePageSize = 50;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");

  useEffect(() => {
    fetch("/api/invoice-buyers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setBuyers(data.buyers ?? []);
        else setError(data.error || "Failed to load buyers");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return buyers;
    const q = search.trim().toLowerCase();
    return buyers.filter((b) => b.buyer_name?.toLowerCase().includes(q));
  }, [buyers, search]);

  const totals = useMemo(() => ({
    buyers: buyers.length,
    invoices: buyers.reduce((s, b) => s + Number(b.invoice_count || 0), 0),
    amount: buyers.reduce((s, b) => s + Number(b.total_amount || 0), 0),
  }), [buyers]);

  const handleCardClick = (buyerName) => {
    router.push(`/accounts-dashboard/invoices/buyer/${encodeURIComponent(buyerName)}`);
  };

  const fetchAllInvoices = async (page = 1) => {
    try {
      setLoadingInvoices(true);
      const params = new URLSearchParams({
        page,
        limit: invoicePageSize,
        fromDate: fromDate || "",
        toDate: toDate || "",
        search: invoiceSearch || "",
      });
      const res = await fetch(`/api/invoice-list?${params}`, { credentials: "include" });
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
  };

  const handleViewClick = () => {
    setShowViewModal(true);
    setInvoicePage(1);
    fetchAllInvoices(1);
  };

  const handleFilterChange = () => {
    setInvoicePage(1);
    fetchAllInvoices(1);
  };

  const handleSearchChange = (value) => {
    setInvoiceSearch(value);
    setInvoicePage(1);
  };

  const downloadExcel = async () => {
    try {
      const params = new URLSearchParams({
        fromDate: fromDate || "",
        toDate: toDate || "",
      });
      const res = await fetch(`/api/invoices-export?${params}`, { credentials: "include" });
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        <p className="text-lg font-semibold">Failed to load buyers</p>
        <p className="text-sm mt-1 text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Invoice Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totals.buyers} buyers · {totals.invoices} invoices total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleViewClick}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 self-start sm:self-auto"
          >
            <FileText size={16} />
            View All
          </button>
          <a
            href="/accounts-dashboard/invoices/new"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 self-start sm:self-auto"
          >
            <FileText size={16} />
            Add Invoice
          </a>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Users,        label: "Total Buyers",   value: totals.buyers,              color: "text-blue-600",   bg: "bg-blue-50"   },
          { icon: FileText,     label: "Total Invoices", value: totals.invoices,             color: "text-purple-600", bg: "bg-purple-50" },
          { icon: IndianRupee,  label: "Total Amount",   value: `₹${fmt(totals.amount)}`,   color: "text-green-600",  bg: "bg-green-50"  },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl border border-gray-200 ${bg} p-4`}>
            <div className={`rounded-full p-2 ${bg}`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search buyer name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white text-gray-800 pl-9 pr-9 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Buyer Cards Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          {search ? `No buyers matching "${search}"` : "No buyers found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((buyer) => (
            <BuyerCard
              key={buyer.buyer_name}
              buyer={buyer}
              onClick={() => handleCardClick(buyer.buyer_name)}
            />
          ))}
        </div>
      )}

      {/* View All Invoices Modal */}
      {showViewModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">All Invoices</h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadExcel}
                  disabled={invoiceTotal === 0 || loadingInvoices}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-semibold"
                >
                  📥 Download Excel
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Date & Search Filter */}
            <div className="p-4 border-b bg-gray-50 space-y-3">
              <div className="flex gap-4 flex-wrap items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <button
                  onClick={handleFilterChange}
                  disabled={loadingInvoices}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
                >
                  Apply Filter
                </button>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Search by Invoice #, GSTIN, Employee, HSN, Item Code, or any field..."
                  value={invoiceSearch}
                  onChange={(e) => {
                    handleSearchChange(e.target.value);
                    setInvoicePage(1);
                    fetchAllInvoices(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="p-4">
              {loadingInvoices ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
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
                          <th className="border p-2 text-left">Date</th>
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
                        {allInvoices.map((inv, idx) => (
                          inv.items && inv.items.length > 0 ? (
                            inv.items.map((item, itemIdx) => (
                              <tr key={`${idx}-${itemIdx}`} className="border-t hover:bg-blue-50">
                                {itemIdx === 0 && (
                                  <>
                                    <td className="border p-2 text-blue-600 font-semibold" rowSpan={inv.items.length}>{inv.id}</td>
                                    <td className="border p-2 text-blue-600 font-semibold" rowSpan={inv.items.length}>{inv.invoice_number}</td>
                                    <td className="border p-2" rowSpan={inv.items.length}>{inv.buyer_name || "-"}</td>
                                    <td className="border p-2" rowSpan={inv.items.length}>{inv.gst_number || "-"}</td>
                                    <td className="border p-2" rowSpan={inv.items.length}>{inv.employee_name || "-"}</td>
                                    <td className="border p-2" rowSpan={inv.items.length}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN") : "-"}</td>
                                    <td className="border p-2 text-right font-semibold" rowSpan={inv.items.length}>₹{Number(inv.tax_amount || 0).toLocaleString('en-IN')}</td>
                                    <td className="border p-2 text-right" rowSpan={inv.items.length}>₹{Number(item.taxable_value || 0).toLocaleString('en-IN')}</td>
                                    <td className="border p-2 text-right font-semibold text-green-600" rowSpan={inv.items.length}>₹{Number(inv.grand_total || 0).toLocaleString('en-IN')}</td>
                                  </>
                                )}
                                <td className="border p-2">{item.hsn_code || "-"}</td>
                                <td className="border p-2 text-center">{item.quantity || "-"}</td>
                                <td className="border p-2 text-right">₹{Number(item.taxable_value || 0).toLocaleString('en-IN')}</td>
                                <td className="border p-2 text-right">₹{Number(item.cgst_amount || 0).toLocaleString('en-IN')}</td>
                                <td className="border p-2 text-right">₹{Number(item.sgst_amount || 0).toLocaleString('en-IN')}</td>
                                <td className="border p-2 text-right">₹{Number(item.igst_amount || 0).toLocaleString('en-IN')}</td>
                              </tr>
                            ))
                          ) : (
                            <tr key={idx} className="border-t hover:bg-blue-50">
                              <td className="border p-2 text-blue-600 font-semibold">{inv.id}</td>
                              <td className="border p-2 text-blue-600 font-semibold">{inv.invoice_number}</td>
                              <td className="border p-2">{inv.buyer_name || "-"}</td>
                              <td className="border p-2">{inv.gst_number || "-"}</td>
                              <td className="border p-2">{inv.employee_name || "-"}</td>
                              <td className="border p-2">{inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN") : "-"}</td>
                              <td className="border p-2 text-right font-semibold">₹{Number(inv.tax_amount || 0).toLocaleString('en-IN')}</td>
                              <td className="border p-2 text-right">₹{Number(0).toLocaleString('en-IN')}</td>
                              <td className="border p-2 text-right font-semibold text-green-600">₹{Number(inv.grand_total || 0).toLocaleString('en-IN')}</td>
                              <td className="border p-2" colSpan="6" className="text-center text-gray-500">No items</td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {invoiceTotal > invoicePageSize && (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        Showing {(invoicePage - 1) * invoicePageSize + 1} - {Math.min(invoicePage * invoicePageSize, invoiceTotal)} of {invoiceTotal} invoices
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fetchAllInvoices(invoicePage - 1)}
                          disabled={invoicePage === 1 || loadingInvoices}
                          className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-sm font-semibold text-gray-700">Page {invoicePage}</span>
                        <button
                          onClick={() => fetchAllInvoices(invoicePage + 1)}
                          disabled={invoicePage * invoicePageSize >= invoiceTotal || loadingInvoices}
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
      )}
    </div>
  );
}

function BuyerCard({ buyer, onClick }) {
  const initials = getInitials(buyer.buyer_name);
  const bgColor = avatarColor(buyer.buyer_name);
  const lastDate = buyer.last_invoice_date
    ? dayjs(buyer.last_invoice_date).format("DD MMM YYYY")
    : "—";

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {/* Avatar + name */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`${bgColor} shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
            {buyer.buyer_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Last: {lastDate}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Invoices</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">
            {buyer.invoice_count}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total</p>
          <p className="text-base font-bold text-green-600 mt-0.5">
            ₹{fmt(buyer.total_amount)}
          </p>
        </div>
      </div>

      {/* Hover hint */}
      <p className="mt-3 text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        View Ledger →
      </p>
    </button>
  );
}
