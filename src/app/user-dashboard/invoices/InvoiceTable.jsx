"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import MultiInvoiceLinkModal from "./MultiInvoiceLinkModal";

const InvoiceEditModal = dynamic(() => import("@/app/admin-dashboard/invoices/InvoiceEditModal"), { ssr: false });

export default function InvoiceTable({ onSummaryUpdate }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Single page — fetch all records
  const [currentPage] = useState(1);
  const limit = 10000;
  const [meta, setMeta] = useState({
    page: 1,
    limit: 10000,
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

        // Calculate per invoice linked amount (for display only)
        data.forEach(inv => {
          inv.totalLinkedAmount = inv.linkedStatements?.reduce(
            (sum, stmt) => sum + Number(stmt.amount || 0),
            0
          ) || 0;
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

        // Calculate and update summary data
        const summaryData = {
          grandTotal: sortedData.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0),
          balanceAmount: sortedData.reduce((sum, inv) => sum + Number(inv.balance_amount || 0), 0),
          taxAmount: sortedData.reduce((sum, inv) => sum + Number(inv.tax_amount || 0), 0),
          totalInvoices: sortedData.length,
        };
        
        if (onSummaryUpdate) {
          onSummaryUpdate(summaryData);
        }
      } else {
        setInvoices([]);
        setFetchError(response.detail || response.error || "Failed to load invoices");
        if (onSummaryUpdate) {
          onSummaryUpdate({ grandTotal: 0, balanceAmount: 0, taxAmount: 0, totalInvoices: 0 });
        }
      }
    } catch (err) {
      console.error("Fetch invoices failed:", err);
      setInvoices([]);
      setFetchError(err?.message || "Failed to load invoices");
      if (onSummaryUpdate) {
        onSummaryUpdate({ grandTotal: 0, balanceAmount: 0, taxAmount: 0, totalInvoices: 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    const t = setTimeout(() => {
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
    setFetchError(null);
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
                <td colSpan="11" className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan="11" className="text-center py-6 text-red-600">
                  {fetchError}
                </td>
              </tr>
            ) : invoices.length ? (
              invoices.map((i) => (
                <React.Fragment key={i.id}>
                  <tr className={`border-t hover:bg-gray-50 ${selectedInvoiceIds.has(i.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-2 w-12">
                      {i.linkedStatements && i.linkedStatements.length > 0 && (
                        <button
                          onClick={() => setExpandedInvoiceId(expandedInvoiceId === i.id ? null : i.id)}
                          className="text-gray-600 hover:text-blue-600"
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
                      {i.linkedStatements && i.linkedStatements.length > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 ml-2 px-2 py-0.5 rounded">
                          {i.linkedStatements.length} Linked Payment{i.linkedStatements.length > 1 ? 's' : ''}
                        </span>
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
                  {expandedInvoiceId === i.id && i.linkedStatements && i.linkedStatements.length > 0 && (
                    <tr>
                      <td colSpan="11" className="px-8 py-4 bg-gray-50">
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
                <td colSpan="11" className="text-center py-6 text-gray-500">
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
            setSelectedInvoiceIds(new Set());
            setSelectedInvoices([]);
          }}
          selectedInvoiceIds={selectedInvoiceIds}
          selectedGrandTotal={selectedInvoices.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0)}
          invoices={invoices}
          onLinkSuccess={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
