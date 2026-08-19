"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import MultiInvoiceLinkModal from "@/app/user-dashboard/invoices/MultiInvoiceLinkModal";

const InvoiceEditModal = dynamic(() => import("./InvoiceEditModal"), { ssr: false });

export default function InvoiceTable({ onSummaryUpdate }) {
  const PAGE_SIZE = 100;
  const SCROLL_THRESHOLD_PX = 160;

  const getMonthStartEnd = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { firstDay, lastDay };
  };

  const formatDateForInput = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const { firstDay: firstDayOfMonth, lastDay: lastDayOfMonth } = getMonthStartEnd();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(formatDateForInput(firstDayOfMonth));
  const [toDate, setToDate] = useState(formatDateForInput(lastDayOfMonth));
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [meta, setMeta] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  // Sorting
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [fetchError, setFetchError] = useState(null);
  const [editId, setEditId] = useState(null);
  
  // Link payment modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState(new Set());
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  const processInvoicesForView = (data) => {
    const grouped = {};

    data.forEach((invoice) => {
      if (invoice.parent_id) {
        if (!grouped[invoice.parent_id]) {
          grouped[invoice.parent_id] = { parent: null, children: [] };
        }
        grouped[invoice.parent_id].children.push(invoice);
      } else {
        if (!grouped[invoice.id]) {
          grouped[invoice.id] = { parent: null, children: [] };
        }
        grouped[invoice.id].parent = invoice;
      }
    });

    data.forEach((inv) => {
      inv.totalLinkedAmount =
        inv.linkedStatements?.reduce(
          (sum, stmt) => sum + Number(stmt.amount || 0),
          0,
        ) || 0;
    });

    const sortedData = [];
    const processedIds = new Set();
    const groupIds = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => b - a);

    groupIds.forEach((parentId) => {
      const group = grouped[parentId];
      if (group.parent && !processedIds.has(group.parent.id)) {
        sortedData.push(group.parent);
        processedIds.add(group.parent.id);
      }
      group.children
        .sort((a, b) => a.id - b.id)
        .forEach((child) => {
          if (!processedIds.has(child.id)) {
            sortedData.push(child);
            processedIds.add(child.id);
          }
        });
    });

    return sortedData;
  };

  const fetchData = async ({ page = 1, append = false } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setFetchError(null);
    }

    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", PAGE_SIZE);
    params.append("sort", sortBy);
    params.append("order", sortOrder);
    params.append("includeDetails", "0");
    params.append("includeCount", "0");

    if (fromDate) params.append("fromDate", fromDate);
    if (toDate) params.append("toDate", toDate);
    if (search) params.append("search", search);
    if (invoiceTypeFilter) params.append("invoiceType", invoiceTypeFilter);
    if (statusFilter) params.append("status", statusFilter);

    try {
      const res = await fetch(`/api/invoice-table?${params.toString()}`);
      const response = await res.json();
      console.log("response data :", response);

      if (response.success) {
        const data = response.data || [];
        const sortedData = processInvoicesForView(data);
        setInvoices((prev) => {
          if (!append) return sortedData;
          const existing = new Set(prev.map((inv) => inv.id));
          const merged = [...prev];
          sortedData.forEach((inv) => {
            if (!existing.has(inv.id)) {
              existing.add(inv.id);
              merged.push(inv);
            }
          });
          return merged;
        });
        setMeta(response.meta);
        setCurrentPage(page);
        if (typeof response.meta?.hasMore === "boolean") {
          setHasMore(response.meta.hasMore);
        } else {
          setHasMore(data.length === PAGE_SIZE);
        }
      } else {
        if (!append) {
          setInvoices([]);
          setFetchError(response.detail || response.error || "Failed to load invoices");
        }
      }
    } catch (err) {
      console.error("Fetch invoices failed:", err);
      if (!append) {
        setInvoices([]);
        setFetchError(err?.message || "Failed to load invoices");
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const resetAndFetch = () => {
    setCurrentPage(1);
    setHasMore(true);
    fetchData({ page: 1, append: false });
  };

  const loadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    fetchData({ page: currentPage + 1, append: true });
  };

  useEffect(() => {
    resetAndFetch();
  }, [fromDate, toDate, sortBy, sortOrder, invoiceTypeFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      resetAndFetch();
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!onSummaryUpdate) return;
    const filteredForSummary = invoices.filter(
      (inv) => inv.type !== "performa" && inv.status !== "CANCELLED",
    );
    onSummaryUpdate({
      grandTotal: filteredForSummary.reduce(
        (sum, inv) => sum + Number(inv.grand_total || 0),
        0,
      ),
      balanceAmount: filteredForSummary.reduce(
        (sum, inv) => sum + Number(inv.balance_amount || 0),
        0,
      ),
      taxAmount: filteredForSummary.reduce(
        (sum, inv) => sum + Number(inv.tax_amount || 0),
        0,
      ),
      totalInvoices: filteredForSummary.length,
    });
  }, [invoices, onSummaryUpdate]);

  const handleReset = () => {
    const { firstDay, lastDay } = getMonthStartEnd();
    setSearch("");
    setFromDate(formatDateForInput(firstDay));
    setToDate(formatDateForInput(lastDay));
    setInvoiceTypeFilter("");
    setStatusFilter("");
    setSortBy("created_at");
    setSortOrder("desc");
    setFetchError(null);
    setSelectedInvoiceIds(new Set());
    setSelectedInvoices([]);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleSelectInvoice = (invoiceId) => {
    const newSelected = new Set(selectedInvoiceIds);
    const clickedInvoice = invoices.find(inv => inv.id === invoiceId);
    
    if (!clickedInvoice) return;
    
    if (newSelected.has(invoiceId)) {
      // Deselect this invoice
      newSelected.delete(invoiceId);
      
      // If it's a parent, deselect all its children
      if (!clickedInvoice.parent_id) {
        invoices.forEach(inv => {
          if (inv.parent_id === invoiceId) {
            newSelected.delete(inv.id);
          }
        });
      } else {
        // If it's a child, deselect parent AND all sibling children
        const parentId = clickedInvoice.parent_id;
        invoices.forEach(inv => {
          if (inv.parent_id === parentId || inv.id === parentId) {
            newSelected.delete(inv.id);
          }
        });
      }
    } else {
      // Select this invoice
      newSelected.add(invoiceId);
      
      // If it's a parent, auto-select all its children
      if (!clickedInvoice.parent_id) {
        invoices.forEach(inv => {
          if (inv.parent_id === invoiceId) {
            newSelected.add(inv.id);
          }
        });
      } else {
        // If it's a child, auto-select parent AND all sibling children
        const parentId = clickedInvoice.parent_id;
        newSelected.add(parentId);
        invoices.forEach(inv => {
          if (inv.parent_id === parentId) {
            newSelected.add(inv.id);
          }
        });
      }
    }
    
    setSelectedInvoiceIds(newSelected);
    
    // Update selected invoices data
    const selected = invoices.filter(inv => newSelected.has(inv.id));
    setSelectedInvoices(selected);
  };

  const handleLinkPaymentClick = () => {
    if (selectedInvoiceIds.size === 0) return;
    setShowLinkModal(true);
  };

  const SortIcon = ({ column }) =>
    sortBy !== column ? (
      <span className="ml-1 text-gray-400">↕</span>
    ) : sortOrder === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );

  // State to track expanded invoices for showing linked statements
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  useEffect(() => {
    const handleWindowScroll = () => {
      if (loading || loadingMore || !hasMore) return;
      const doc = document.documentElement;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        doc.scrollHeight - SCROLL_THRESHOLD_PX;
      if (nearBottom) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [loading, loadingMore, hasMore, currentPage]);

  return (
    <div className="bg-white rounded shadow p-4">
      {/* Filters and Link Payment Button */}
      <div className="flex flex-col md:flex-row justify-between gap-3 mb-4">
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
          <select
            value={invoiceTypeFilter}
            onChange={(e) => setInvoiceTypeFilter(e.target.value)}
            className="border px-3 py-1 rounded"
          >
            <option value="">All Types</option>
            <option value="tax">Tax Invoice</option>
            <option value="performa">Performa Invoice</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border px-3 py-1 rounded"
          >
            <option value="">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL PAID">Partial Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <input
            type="text"
            placeholder="Search by invoice or buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-3 py-1 rounded w-full md:w-64"
          />
          {selectedInvoiceIds.size > 0 && (
            <button
              onClick={handleLinkPaymentClick}
              disabled={selectedInvoices.some(inv => inv.type === 'performa')}
              className={`px-4 py-1 rounded whitespace-nowrap font-semibold ${
                selectedInvoices.some(inv => inv.type === 'performa')
                  ? 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title={selectedInvoices.some(inv => inv.type === 'performa') ? 'Cannot link payments to Performa Invoices' : ''}
            >
              Link Payment ({selectedInvoiceIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto hidden md:block border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 w-12 bg-gray-100 sticky left-0 z-20"></th>
              <th className="px-4 py-2 w-12 bg-gray-100 sticky left-12 z-20">
                <input
                  type="checkbox"
                  checked={selectedInvoiceIds.size > 0 && selectedInvoiceIds.size === invoices.length && invoices.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const newSet = new Set(invoices.map(inv => inv.id));
                      setSelectedInvoiceIds(newSet);
                      setSelectedInvoices(invoices);
                    } else {
                      setSelectedInvoiceIds(new Set());
                      setSelectedInvoices([]);
                    }
                  }}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-4 py-2 bg-amber-50 text-amber-800 sticky left-24 z-10">
                Customer ID
              </th>
              <th
                onClick={() => handleSort("invoice_number")}
                className="px-4 py-2 cursor-pointer"
              >
                Invoice No <SortIcon column="invoice_number" />
              </th>
              <th className="px-4 py-2">Buyer</th>
              <th className="px-4 py-2">Consignee GSTIN</th>
              <th className="px-4 py-2">Employee</th>
              <th
                onClick={() => handleSort("invoice_date")}
                className="px-4 py-2 cursor-pointer"
              >
                Invoice Date <SortIcon column="invoice_date" />
              </th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Tax</th>
              <th className="px-4 py-2">Grand Total</th>
              <th className="px-4 py-2">Balance Amount</th>
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
                <td colSpan="15" className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan="15" className="text-center py-6 text-red-600">
                  {fetchError}
                </td>
              </tr>
            ) : invoices.length ? (
              invoices.map((i) => (
                <React.Fragment key={i.id}>
                  <tr className={`border-t hover:bg-gray-50 ${selectedInvoiceIds.has(i.id) ? 'bg-blue-50' : ''}`}>
                    <td className={`px-4 py-2 w-12 sticky left-0 z-20 ${selectedInvoiceIds.has(i.id) ? 'bg-blue-50' : 'bg-white'}`}>
                      {i.linkedStatements && i.linkedStatements.length > 0 && (
                        <button
                          onClick={() => setExpandedInvoiceId(expandedInvoiceId === i.id ? null : i.id)}
                          className="text-gray-600 hover:text-blue-600"
                        >
                          {expandedInvoiceId === i.id ? '▼' : '▶'}
                        </button>
                      )}
                    </td>
                    <td className={`px-4 py-2 w-12 sticky left-12 z-20 ${selectedInvoiceIds.has(i.id) ? 'bg-blue-50' : 'bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.has(i.id)}
                        onChange={() => handleSelectInvoice(i.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className={`px-4 py-2 bg-amber-50 sticky left-24 z-10 ${selectedInvoiceIds.has(i.id) ? 'bg-blue-50/60' : ''}`}>
                      <span className="font-mono text-sm font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                        {i.customer_id || i.customer_id === 0 ? i.customer_id : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {i.parent_id && (
                        <span className="text-gray-400 mr-2">└─</span>
                      )}
                      {i.invoice_number}
                      {!i.parent_id && invoices.some(inv => inv.parent_id === i.id) && (
                        <span className="text-xs bg-blue-100 text-blue-700 ml-2 px-2 py-0.5 rounded">Parent</span>
                      )}
                      {i.linkedStatements && i.linkedStatements.length > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 ml-2 px-2 py-0.5 rounded">
                          {i.linkedStatements.length} Linked Payment{i.linkedStatements.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-2 ${i.parent_id ? 'pl-8' : ''}`}>{i.buyer_name}</td>
                    <td className={`px-4 py-2 text-sm font-mono ${i.parent_id ? 'pl-8' : ''}`}>{i.gst_consignee || "-"}</td>
                    <td className={`px-4 py-2 ${i.parent_id ? 'pl-8' : ''}`}>{i.employee_name || "-"}</td>
                    <td className="px-4 py-2">
                      {new Date(i.order_date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${
                        i.type === 'performa' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {i.type === 'performa' ? 'Performa Invoice' : 'Tax Invoice'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${
                        i.status === 'PAID'
                          ? 'bg-green-100 text-green-800'
                          : i.status === 'PARTIAL PAID'
                            ? 'bg-yellow-100 text-yellow-800'
                            : i.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                      }`}>
                        {i.status || '—'}
                      </span>
                      {i.order_id && (
                        <div className="mt-1 text-xs text-gray-500">
                          Ord: {i.order_id}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      ₹{Number(i.tax_amount).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      ₹{Number(i.grand_total).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      <span className={Number(i.balance_amount) > 0 ? 'text-red-600' : 'text-green-600'}>
                        ₹{Number(i.balance_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      {i.totalLinkedAmount > 0 && (
                        <div className="text-xs text-gray-500">
                          (-₹{Number(i.totalLinkedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                        </div>
                      )}
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
                        <button
                          type="button"
                          onClick={() => {
                            // If already have a link modal open with these invoices selected
                            if (selectedInvoiceIds.size > 0) {
                              // Open with all selected invoices
                              setShowLinkModal(true);
                            } else {
                              // First time - select this invoice and find related ones
                              const newSelected = new Set([i.id]);
                              setSelectedInvoiceIds(newSelected);
                              setSelectedInvoices([i]);
                              setShowLinkModal(true);
                            }
                          }}
                          disabled={i.type === 'performa' || (selectedInvoiceIds.size > 0 && !selectedInvoiceIds.has(i.id))}
                          className={`text-white px-3 py-1 rounded ${
                            i.type === 'performa' || (selectedInvoiceIds.size > 0 && !selectedInvoiceIds.has(i.id))
                              ? 'bg-gray-400 cursor-not-allowed opacity-50'
                              : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                          title={i.type === 'performa' ? 'Link Payment not available for Performa Invoices' : selectedInvoiceIds.size > 0 && !selectedInvoiceIds.has(i.id) ? 'Disabled: These invoices are linked to a payment' : ''}
                        >
                          Link Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedInvoiceId === i.id && i.linkedStatements && i.linkedStatements.length > 0 && (
                    <tr>
                      <td colSpan="15" className="px-8 py-4 bg-gray-50">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-gray-700">Linked Payments:</h4>
                          <div className="text-right">
                            <span className="text-sm text-gray-600">Total Linked: </span>
                            <span className="text-lg font-bold text-red-600">
                              ₹{Number(i.totalLinkedAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                              {i.linkedStatements.map((stmt) => (
                                <tr key={stmt.id} className="border-t">
                                  <td className="px-4 py-2">{stmt.id}</td>
                                  <td className="px-4 py-2 font-mono">{stmt.trans_id || "-"}</td>
                                  <td className="px-4 py-2">
                                    {stmt.date ? new Date(stmt.date).toLocaleDateString("en-IN") : "-"}
                                  </td>
                                  <td className="px-4 py-2 max-w-xs truncate" title={stmt.description}>
                                    {stmt.description || "-"}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-red-600">
                                    ₹{Number(stmt.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan="15" className="text-center py-6 text-gray-500">
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && invoices.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <span>
            Loaded {invoices.length}{meta.total != null ? ` of ${meta.total}` : ""} invoices
          </span>
          {loadingMore ? (
            <span className="font-medium text-blue-600">Loading more...</span>
          ) : hasMore ? (
            <span>Scroll down to load more</span>
          ) : (
            <span>All invoices loaded</span>
          )}
        </div>
      )}

      {editId != null && (
        <InvoiceEditModal
          open
          invoiceId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => resetAndFetch()}
          viewHrefBase="/admin-dashboard/invoices"
        />
      )}

      {showLinkModal && (
        <MultiInvoiceLinkModal
          isOpen={showLinkModal}
          closeModal={() => {
            setShowLinkModal(false);
            setSelectedInvoiceIds(new Set());
            setSelectedInvoices([]);
          }}
          selectedInvoiceIds={selectedInvoiceIds}
          selectedGrandTotal={selectedInvoices.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0)}
          invoices={invoices}
          onLinkSuccess={() => {
            resetAndFetch();
          }}
        />
      )}
    </div>
  );
}
