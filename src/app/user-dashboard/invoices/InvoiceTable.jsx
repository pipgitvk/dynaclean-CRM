"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import InvoiceEditModal from "@/app/admin-dashboard/invoices/InvoiceEditModal";
import MultiInvoiceLinkModal from "./MultiInvoiceLinkModal";

const SESSION_KEY = "invoice_selected_ids";

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

  // Link payment modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState(() => {
    // Restore selection from sessionStorage on mount
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch (_) {}
    return new Set();
  });
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  // Persist selectedInvoiceIds to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...selectedInvoiceIds]));
    } catch (_) {}
  }, [selectedInvoiceIds]);

  const handleRemoveSelected = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSelectedInvoiceIds(new Set());
    setSelectedInvoices([]);
  };

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
        let data = response.data || [];
        
        // Group invoices by parent_id and sort so parent appears first, then children
        const grouped = {};
        const standalone = [];
        
        // First pass: organize by parent
        data.forEach(invoice => {
          if (invoice.parent_id) {
            // This is a child
            if (!grouped[invoice.parent_id]) {
              grouped[invoice.parent_id] = { parent: null, children: [] };
            }
            grouped[invoice.parent_id].children.push(invoice);
          } else {
            // This is a standalone or parent
            if (!grouped[invoice.id]) {
              grouped[invoice.id] = { parent: null, children: [] };
            }
            grouped[invoice.id].parent = invoice;
          }
        });

        // Build final sorted array: parent followed by its children
        const sortedData = [];
        const processedIds = new Set();

        // Sort groups by parent id
        const groupIds = Object.keys(grouped)
          .map(Number)
          .sort((a, b) => b - a); // Descending order (highest first)

        groupIds.forEach(parentId => {
          const group = grouped[parentId];
          if (group.parent && !processedIds.has(group.parent.id)) {
            sortedData.push(group.parent);
            processedIds.add(group.parent.id);
          }
          // Add children sorted by id (ascending)
          group.children.sort((a, b) => a.id - b.id).forEach(child => {
            if (!processedIds.has(child.id)) {
              sortedData.push(child);
              processedIds.add(child.id);
            }
          });
        });

        setInvoices(sortedData);
        setMeta(response.meta);

        // Re-sync selectedInvoices from restored selectedInvoiceIds
        setSelectedInvoices(prev => {
          // Use functional form to get current selectedInvoiceIds from sessionStorage
          try {
            const saved = sessionStorage.getItem(SESSION_KEY);
            if (saved) {
              const restoredIds = new Set(JSON.parse(saved));
              return sortedData.filter(inv => restoredIds.has(inv.id));
            }
          } catch (_) {}
          return prev;
        });
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
              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 whitespace-nowrap font-semibold"
            >
              Link Payment ({selectedInvoiceIds.size})
            </button>
          )}
          {selectedInvoiceIds.size > 0 && (
            <button
              onClick={handleRemoveSelected}
              className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 whitespace-nowrap font-semibold"
            >
              Remove Selected ({selectedInvoiceIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto hidden md:block border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
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
              <th className="px-4 py-2">Employee</th>
              <th
                onClick={() => handleSort("order_date")}
                className="px-4 py-2 cursor-pointer"
              >
                Order Date <SortIcon column="order_date" />
              </th>
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
                <td colSpan="10" className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan="10" className="text-center py-6 text-red-600">
                  {fetchError}
                </td>
              </tr>
            ) : invoices.length ? (
              invoices.map((i) => (
                <tr key={i.id} className={`border-t hover:bg-gray-50 ${selectedInvoiceIds.has(i.id) ? 'bg-blue-50' : ''}`}>
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
                  </td>
                  <td className={`px-4 py-2 ${i.parent_id ? 'pl-8' : ''}`}>{i.buyer_name}</td>
                  <td className={`px-4 py-2 ${i.parent_id ? 'pl-8' : ''}`}>{i.employee_name || "-"}</td>
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
                    ₹{Number(i.balance_amount || 0).toLocaleString("en-IN")}
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
                            // Parent = highest ID, children = lower IDs with same parent_id or not yet assigned
                            const newSelected = new Set([i.id]);
                            
                            // For now, just select this one invoice
                            // Parent-child relationship will be set when saving
                            setSelectedInvoiceIds(newSelected);
                            setSelectedInvoices([i]);
                            setShowLinkModal(true);
                          }
                        }}
                        disabled={selectedInvoiceIds.size > 0 && !selectedInvoiceIds.has(i.id)}
                        className={`text-white px-3 py-1 rounded ${
                          selectedInvoiceIds.size > 0 && !selectedInvoiceIds.has(i.id)
                            ? 'bg-gray-400 cursor-not-allowed opacity-50'
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                        title={selectedInvoiceIds.size > 0 && !selectedInvoiceIds.has(i.id) ? 'Disabled: These invoices are linked to a payment' : ''}
                      >
                        Link Payment
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="text-center py-6 text-gray-500">
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
          viewHrefBase="/user-dashboard/invoices"
        />
      )}

      {showLinkModal && (
        <MultiInvoiceLinkModal
          isOpen={showLinkModal}
          closeModal={() => {
            setShowLinkModal(false);
          }}
          selectedInvoiceIds={selectedInvoiceIds}
          selectedGrandTotal={selectedInvoices.reduce((sum, inv) => sum + Number(inv.balance_amount || 0), 0)}
          invoices={invoices}
          onLinkSuccess={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
