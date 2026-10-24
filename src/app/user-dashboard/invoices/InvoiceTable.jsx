  "use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import MultiInvoiceLinkModal from "./MultiInvoiceLinkModal";

function InvoiceTableLoadingState({ label = "Loading invoices…" }) {
  return (
    <tr>
      <td colSpan={13} className="py-16">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full border-4 border-blue-100"
              aria-hidden
            />
            <Loader2
              className="h-10 w-10 animate-spin text-blue-600"
              aria-hidden
            />
          </div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400 max-w-xs">
            Please wait while we fetch your invoice list
          </p>
        </div>
      </td>
    </tr>
  );
}

const InvoiceEditModal = dynamic(() => import("@/app/admin-dashboard/invoices/InvoiceEditModal"), { ssr: false });

export default function InvoiceTable({ onSummaryUpdate }) {
  const PAGE_SIZE = 40;
  const SCROLL_LOAD_OFFSET_PX = 200;
  const pageRef = useRef(1);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scrollLoadEnabled, setScrollLoadEnabled] = useState(false);
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
        if (group.parent.type !== "performa") {
          sortedData.push(group.parent);
          processedIds.add(group.parent.id);
        }
      }
      group.children
        .sort((a, b) => a.id - b.id)
        .forEach((child) => {
          if (!processedIds.has(child.id) && child.type !== "performa") {
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
      setInvoices([]);
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
      if (!append && fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      const controller = new AbortController();
      if (!append) fetchAbortRef.current = controller;

      const res = await fetch(`/api/invoice-table?${params.toString()}`, {
        signal: controller.signal,
      });
      const response = await res.json();

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
        pageRef.current = page;
        if (typeof response.meta?.hasMore === "boolean") {
          setHasMore(response.meta.hasMore);
        } else {
          setHasMore(data.length === PAGE_SIZE);
        }
      } else if (!append) {
        setInvoices([]);
        setFetchError(response.detail || response.error || "Failed to load invoices");
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("Fetch invoices failed:", err);
      if (!append) {
        setInvoices([]);
        setFetchError(err?.message || "Failed to load invoices");
      }
    } finally {
      if (fetchAbortRef.current?.signal.aborted && !append) return;
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
        setScrollLoadEnabled(true);
      }
    }
  };

  const resetAndFetch = () => {
    setCurrentPage(1);
    pageRef.current = 1;
    setHasMore(true);
    setScrollLoadEnabled(false);
    setLinkedDetailsById({});
    setExpandedInvoiceId(null);
    fetchData({ page: 1, append: false });
  };

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchDataRef.current({ page: pageRef.current + 1, append: true });
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    resetAndFetch();
  }, [fromDate, toDate, sortBy, sortOrder, invoiceTypeFilter, statusFilter]);

  useEffect(() => {
    if (skipInitialSearchFetch.current) {
      skipInitialSearchFetch.current = false;
      return;
    }
    const t = setTimeout(() => {
      resetAndFetch();
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!onSummaryUpdate || loading) return;
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
  }, [invoices, loading, onSummaryUpdate]);

  const handleReset = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
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
          if (inv.parent_id === parentId || inv.id === parentId) {newSelected.delete(inv.id);}
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
  const [linkedDetailsById, setLinkedDetailsById] = useState({});
  const [loadingLinkedId, setLoadingLinkedId] = useState(null);
  const skipInitialSearchFetch = useRef(true);
  const fetchAbortRef = useRef(null);

  const invoiceMayHaveLinkedPayments = (inv) => {
    const paid = Number(inv?.amount_paid || 0);
    const status = String(inv?.status || "").toUpperCase();
    return (
      paid > 0 ||
      status === "PAID" ||
      status.includes("PARTIAL")
    );
  };

  const getLinkedStatementsForRow = (inv) =>
    linkedDetailsById[inv.id]?.linkedStatements ||
    inv.linkedStatements ||
    [];

  const getTotalLinkedAmountForRow = (inv) =>
    linkedDetailsById[inv.id]?.totalLinkedAmount ??
    inv.totalLinkedAmount ??
    0;

  const fetchLinkedDetails = async (invoiceId) => {
    if (linkedDetailsById[invoiceId] || loadingLinkedId === invoiceId) return;
    setLoadingLinkedId(invoiceId);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "1",
        includeDetails: "1",
        includeCount: "0",
        invoiceIds: String(invoiceId),
      });
      const res = await fetch(`/api/invoice-table?${params.toString()}`);
      const response = await res.json();
      if (response.success && response.data?.[0]) {
        const row = response.data[0];
        const stmts = row.linkedStatements || [];
        const totalLinkedAmount =
          row.totalLinkedAmount ??
          stmts.reduce((sum, stmt) => sum + Number(stmt.amount || 0), 0);
        setLinkedDetailsById((prev) => ({
          ...prev,
          [invoiceId]: { linkedStatements: stmts, totalLinkedAmount },
        }));
      }
    } catch (err) {
      console.error("Failed to load linked payments:", err);
    } finally {
      setLoadingLinkedId(null);
    }
  };

  const toggleLinkedPayments = async (inv) => {
    if (expandedInvoiceId === inv.id) {
      setExpandedInvoiceId(null);
      return;
    }
    setExpandedInvoiceId(inv.id);
    await fetchLinkedDetails(inv.id);
  };

  useEffect(() => {
    if (!scrollLoadEnabled) return;

    const scrollRoot = document.querySelector("main.overflow-auto");
    if (!scrollRoot) return;

    const onScroll = () => {
      if (loading || loadingMore || !hasMore) return;
      const nearBottom =
        scrollRoot.scrollTop + scrollRoot.clientHeight >=
        scrollRoot.scrollHeight - SCROLL_LOAD_OFFSET_PX;
      if (nearBottom) {
        loadMore();
      }
    };

    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, [scrollLoadEnabled, loadMore, hasMore, loading, loadingMore]);

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
          <TypeableDateFilterInput value={fromDate} onChange={setFromDate} className="border px-3 py-1 rounded"/>
          <TypeableDateFilterInput value={toDate} onChange={setToDate} className="border px-3 py-1 rounded"/>
          <select
            value={invoiceTypeFilter}
            onChange={(e) => setInvoiceTypeFilter(e.target.value)}
            className="border px-3 py-1 rounded"
          >
            <option value="">All Types</option>
            <option value="tax">Tax Invoice</option>
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
              <th className="px-4 py-2 w-12"></th>
              <th className="px-4 py-2 w-12">
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
              <th
                onClick={() => handleSort("invoice_number")}
                className="px-4 py-2 cursor-pointer"
              >
                Invoice No <SortIcon column="invoice_number" />
              </th>
              <th className="px-4 py-2">Buyer</th>
              <th className="px-4 py-2">Created By</th>
              <th
                onClick={() => handleSort("order_date")}
                className="px-4 py-2 cursor-pointer"
              >
                Order Date <SortIcon column="order_date" />
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
              <InvoiceTableLoadingState />
            ) : fetchError ? (
              <tr>
                <td colSpan="13" className="text-center py-6 text-red-600">
                  {fetchError}
                </td>
              </tr>
            ) : invoices.length ? (
              invoices.map((i) => {
                const linkedStatements = getLinkedStatementsForRow(i);
                const totalLinkedAmount = getTotalLinkedAmountForRow(i);
                const showLinkedExpand =
                  linkedStatements.length > 0 || invoiceMayHaveLinkedPayments(i);

                return (
                <React.Fragment key={i.id}>
                  <tr className={`border-t hover:bg-gray-50 ${selectedInvoiceIds.has(i.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-2 w-12">
                      {showLinkedExpand && (
                        <button
                          type="button"
                          onClick={() => toggleLinkedPayments(i)}
                          className="text-gray-600 hover:text-blue-600"
                          title="Linked payments"
                        >
                          {expandedInvoiceId === i.id ? '▼' : '▶'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 w-12">
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.has(i.id)}
                        onChange={() => handleSelectInvoice(i.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {i.parent_id && (
                        <span className="text-gray-400 mr-2">└─</span>
                      )}
                      {i.invoice_number}
                      {!i.parent_id && invoices.some(inv => inv.parent_id === i.id) && (
                        <span className="text-xs bg-blue-100 text-blue-700 ml-2 px-2 py-0.5 rounded">Parent</span>
                      )}
                      {linkedStatements.length > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 ml-2 px-2 py-0.5 rounded">
                          {linkedStatements.length} Linked Payment{linkedStatements.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-2 ${i.parent_id ? 'pl-8' : ''}`}>{i.buyer_name}</td>
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
                          : i.status === 'PARTIAL PAID' || i.status === 'PARTIAL'
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
                      {totalLinkedAmount > 0 && (
                        <div className="text-xs text-gray-500">
                          (-₹{Number(totalLinkedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(i.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <Link
                          href={`/user-dashboard/invoices/${encodeURIComponent(i.invoice_number)}`}
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
                  {expandedInvoiceId === i.id && (
                    <tr>
                      <td colSpan="13" className="px-8 py-4 bg-gray-50">
                        {loadingLinkedId === i.id ? (
                          <p className="text-sm text-gray-600">Loading linked payments…</p>
                        ) : linkedStatements.length === 0 ? (
                          <p className="text-sm text-gray-500">No linked payments found.</p>
                        ) : (
                        <>
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-gray-700">Linked Payments:</h4>
                          <div className="text-right">
                            <span className="text-sm text-gray-600">Total Linked: </span>
                            <span className="text-lg font-bold text-red-600">
                              ₹{Number(totalLinkedAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                              {linkedStatements.map((stmt) => (
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
                        </>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
              })
            ) : (
              <tr>
                <td colSpan="13" className="text-center py-6 text-gray-500">
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && invoices.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              Loaded {invoices.length}
              {meta.total != null && meta.total > 0
                ? ` of ${meta.total}`
                : ""}{" "}
              invoices
            </span>
            {loadingMore ? (
              <span className="font-medium text-blue-600">Loading more...</span>
            ) : hasMore ? (
              <span>Scroll down to load more</span>
            ) : (
              <span>All invoices loaded</span>
            )}
          </div>
        </div>
      )}

      {editId != null && (
        <InvoiceEditModal
          key={editId}
          open
          invoiceId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => resetAndFetch()}
          viewHrefBase="/user-dashboard/invoices"
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
