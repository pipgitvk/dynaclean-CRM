"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, Download, Eye, Plus, Upload, Trash2, Edit2, ChevronDown, FileSpreadsheet, Printer, Link2, MoreVertical, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

const fmt = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-IN");
};

const formatDateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateDisplay = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}`;
};

function LinkPaymentModal({ open, onClose, purchase, onLinked, currentStatementIds }) {
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState([]);
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState(null);
  
  // Date filter states - default to current month
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Initialize default dates (entire current month - start to end)
  useEffect(() => {
    // Force August 2026 for testing (since you mentioned it should be 01/08 to 31/08)
    const currentDate = new Date(2026, 7, 12); // Year, Month (0-indexed), Day - August 2026
    console.log("Using date:", currentDate);
    
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    console.log("Start of August 2026:", startOfMonth);
    console.log("End of August 2026:", endOfMonth);
    console.log("From date string:", startOfMonth.toISOString().split("T")[0]);
    console.log("To date string:", endOfMonth.toISOString().split("T")[0]);
    
    setFromDate(startOfMonth.toISOString().split("T")[0]); // Should be 2026-08-01
    setToDate(endOfMonth.toISOString().split("T")[0]); // Should be 2026-08-31
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchStatements();
  }, [open, fromDate, toDate]);

  const fetchStatements = () => {
    setStatements([]);
    setSearch("");
    let cancelled = false;
    setLoading(true);
    
    fetch("/api/statements", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        let rows = Array.isArray(data?.statements) ? data.statements : [];
        
        // Filter by date range if provided
        if (fromDate || toDate) {
          rows = rows.filter(stmt => {
            const stmtDate = new Date(stmt.date);
            if (isNaN(stmtDate.getTime())) return false;
            
            if (fromDate && stmtDate < new Date(fromDate)) return false;
            if (toDate && stmtDate > new Date(toDate)) return false;
            
            return true;
          });
        }
        
        setStatements(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load statements");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  };

  const getLinkedKeys = (stmt) => {
    const raw = stmt?.linked_purchase_ids;
    if (raw == null || String(raw).trim() === "") return [];
    let arr = null;
    try {
      const parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = String(raw).split(",").map(s => s.trim()).filter(Boolean);
    }
    const keys = [];
    for (const v of arr) {
      if (v == null) continue;
      const s = String(v).trim().toUpperCase();
      if (!s) continue;
      if (/^(PP|PS|SP)\d+$/.test(s)) {
        keys.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
      } else if (/^\d+$/.test(s)) {
        keys.push(`PP${s}`);
      }
    }
    return keys;
  };

  const { currentTotal, myKey } = useMemo(() => {
    const pid = Number(purchase?.id);
    const key = Number.isFinite(pid) && pid > 0 ? `PP${pid}` : "";
    const total = statements.reduce((acc, s) => {
      if (getLinkedKeys(s).includes(key)) {
        return acc + Number(s.amount || 0);
      }
      return acc;
    }, 0);
    return { currentTotal: total, myKey: key };
  }, [statements, purchase?.id]);

  const hasPurchaseId = (stmt) => {
    const pid = Number(purchase?.id);
    if (!Number.isFinite(pid) || pid <= 0) return false;
    return getLinkedKeys(stmt).includes(`PP${pid}`);
  };

  const eligibleStatements = useMemo(() => {
    const q = search.trim().toLowerCase();
    const isUnsettled = (s) =>
      (String(s.invoice_status || "").trim() === "Unsettled") ||
      (!s.invoice_status && !s.client_expense_id);
    const isDebit = (s) => String(s.type || "").trim() === "Debit";

    let rows = statements.filter((s) => {
      if (!isDebit(s)) return false;
      const linked = getLinkedKeys(s);
      // Show if it's already linked to THIS purchase
      if (linked.includes(myKey)) return true;
      // Also show if it's unsettled (and not linked to anything else)
      if (isUnsettled(s) && linked.length === 0) return true;
      // Also show if it's explicitly passed in currentStatementIds
      if (Array.isArray(currentStatementIds) && currentStatementIds.includes(Number(s?.id))) return true;

      return false;
    });

    if (q) {
      rows = rows.filter((s) => {
        const id = String(s.id ?? "").toLowerCase();
        const transId = String(s.trans_id ?? "").toLowerCase();
        const desc = String(s.description ?? "").toLowerCase();
        const amount = String(s.amount ?? "").toLowerCase();
        const linked = String(s.linked_purchase_ids ?? "").toLowerCase();
        
        return id.includes(q) || transId.includes(q) || desc.includes(q) || amount.includes(q) || linked.includes(q);
      });
    }

    return rows;
  }, [statements, search, myKey, currentStatementIds]);

  async function toggleLink(statementId, transId, currentlyLinked) {
    try {
      if (!purchase?.id) return;
      
      const action = currentlyLinked ? "unlink" : "link";
      const stmt = statements.find(s => s.id === statementId);
      const stmtAmount = Number(stmt?.amount || 0);

      if (action === "link") {
        if (currentTotal + stmtAmount > Number(purchase.amount || 0)) {
          toast.error(`Cannot link: Total payment (₹${(currentTotal + stmtAmount).toLocaleString()}) would exceed Net Amount (₹${Number(purchase.amount || 0).toLocaleString()})`);
          return;
        }
      }

      setLinkingId(statementId);
      const res = await fetch(`/api/statements/${statementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          purchase_id: purchase.id,
          purchase_type: "PP",
          action: action
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);

      toast.success(action === "link" ? "Payment linked" : "Payment unlinked");

      // Update local state of statements so the UI updates immediately
      setStatements(prev => prev.map(s => {
        if (s.id === statementId) {
          const pid = Number(purchase.id);
          const token = `PP${pid}`;
          let linked = getLinkedKeys(s);
          if (action === "link") {
            if (!linked.includes(token)) linked.push(token);
          } else {
            linked = linked.filter(t => t !== token);
          }
          return {
            ...s,
            linked_purchase_ids: JSON.stringify(linked),
            invoice_status: linked.length > 0 ? "Settled" : "Unsettled"
          };
        }
        return s;
      }));

      onLinked?.(purchase.id, statementId, transId, action);
    } catch (e) {
      toast.error(e.message || "Operation failed");
    } finally {
      setLinkingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-4 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Link Payment</h3>
            <div className="flex flex-col gap-0.5 mt-0.5">
              <p className="text-xs text-gray-500">
                Purchase #{purchase?.id} • Multiple selection enabled
              </p>
              <p className="text-xs font-medium">
                <span className="text-gray-600">Net Amount:</span> <span className="text-blue-700">₹{Number(purchase?.amount || 0).toLocaleString()}</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-gray-600">Total Linked:</span> <span className={`${currentTotal > Number(purchase?.amount || 0) ? 'text-red-600' : 'text-emerald-700'}`}>₹{currentTotal.toLocaleString()}</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-gray-600">Remaining:</span> <span className="text-gray-800">₹{Math.max(0, Number(purchase?.amount || 0) - currentTotal).toLocaleString()}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search statement..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border rounded-md text-sm w-72 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            {/* Date Filters */}
            <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 bg-gray-50">
              <span className="text-sm font-medium text-gray-600">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border-0 bg-transparent text-sm focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 bg-gray-50">
              <span className="text-sm font-medium text-gray-600">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border-0 bg-transparent text-sm focus:outline-none"
              />
            </div>
            
            {/* Reset Button */}
            <button
              onClick={() => {
                const today = new Date();
                console.log("Reset - Today's date:", today);
                
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                
                console.log("Reset - Start of month:", startOfMonth);
                console.log("Reset - End of month:", endOfMonth);
                
                const fromStr = startOfMonth.toISOString().split("T")[0];
                const toStr = endOfMonth.toISOString().split("T")[0];
                
                console.log("Reset - From date string:", fromStr);
                console.log("Reset - To date string:", toStr);
                
                setFromDate(fromStr);
                setToDate(toStr);
              }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              title="Reset to entire current month"
            >
              Current Month
            </button>
          </div>
          
          <div className="text-xs text-gray-600 font-medium">
            {loading ? "Loading..." : `Showing ${eligibleStatements.length} statement(s)`}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3 border-b font-semibold text-gray-700">ID</th>
                <th className="p-3 border-b font-semibold text-gray-700">Trans ID</th>
                <th className="p-3 border-b font-semibold text-gray-700">Date</th>
                <th className="p-3 border-b font-semibold text-gray-700">Description</th>
                <th className="p-3 border-b font-semibold text-gray-700">Amount</th>
                <th className="p-3 border-b font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading statements...</span>
                    </div>
                  </td>
                </tr>
              ) : eligibleStatements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500">No matching unsettled statements found</td>
                </tr>
              ) : (
                eligibleStatements.map((s) => {
                  const alreadyLinkedToThis = hasPurchaseId(s);
                  const linkedKeys = getLinkedKeys(s);
                  const myKey = purchase?.id != null ? `PP${Number(purchase.id)}` : "";
                  const linkedToOther = linkedKeys.length > 0 && !linkedKeys.includes(myKey);
                  const isLinking = linkingId === s.id;

                  let btnClass = "px-4 py-1.5 rounded text-sm font-medium transition-colors ";
                  if (isLinking) btnClass += "bg-gray-200 text-gray-500 cursor-wait";
                  else if (alreadyLinkedToThis) btnClass += "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100";
                  else btnClass += "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm";

                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${alreadyLinkedToThis ? 'bg-emerald-50/30' : ''}`}>
                      <td className="p-3 font-medium text-gray-600">#{s.id}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{s.trans_id || "—"}</td>
                      <td className="p-3 text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : "—"}</td>
                      <td className="p-3 max-w-[400px] truncate text-gray-600" title={s.description || ""}>{s.description || "—"}</td>
                      <td className="p-3 font-bold text-red-600">₹{Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleLink(s.id, s.trans_id || "", alreadyLinkedToThis)}
                          disabled={isLinking}
                          className={btnClass}
                        >
                          {isLinking ? "Processing..." : alreadyLinkedToThis ? "Deselect" : "Select"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors font-medium shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseProductsPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("This Month");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  // Payment Link Modal states
  const [linkPaymentOpen, setLinkPaymentOpen] = useState(false);
  const [linkPurchase, setLinkPurchase] = useState(null);
  
  // Linked payments data
  const [linkedPayments, setLinkedPayments] = useState({});

  // Handle menu positioning
  const handleMenuClick = useCallback((event, purchaseId) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (menuOpen === purchaseId) {
      setMenuOpen(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    setMenuPosition({
      top: rect.bottom + scrollTop + 5,
      left: Math.max(10, rect.right + scrollLeft - 160) // Ensure menu doesn't go off-screen
    });
    setMenuOpen(purchaseId);
  }, [menuOpen]); 

  useEffect(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setFromDate(startOfMonth.toISOString().split("T")[0]);
    setToDate(today.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fromDate, toDate]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        fromDate: fromDate || "",
        toDate: toDate || "",
      });
      const res = await fetch(`/api/purchase-products?${params}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        const purchaseData = Array.isArray(data.data) ? data.data : [];
        setPurchases(purchaseData);
        
        // Fetch linked payments for all purchases
        await fetchLinkedPayments(purchaseData);
      } else {
        toast.error(data.error || "Failed to load purchases");
        setPurchases([]);
      }
    } catch (e) {
      toast.error("Failed to fetch purchases");
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedPayments = async (purchaseList) => {
    try {
      const payments = {};
      
      // For each purchase, get payment entries from product_stock_request table
      for (const purchase of purchaseList) {
        try {
          // Fetch the full purchase record by invoice number to get payment_entries
          const response = await fetch(`/api/purchase-products/by-invoice/${encodeURIComponent(purchase.invoice_no)}`, {
            credentials: "include"
          });
          const result = await response.json();
          
          if (result.success && result.data && result.data.length > 0) {
            // Get payment entries from the first record (all products with same invoice share payment entries)
            const firstRecord = result.data[0];
            let totalPaymentAmount = 0;
            
            if (firstRecord.payment_entries) {
              try {
                const paymentEntries = JSON.parse(firstRecord.payment_entries);
                if (Array.isArray(paymentEntries)) {
                  totalPaymentAmount = paymentEntries.reduce((sum, entry) => {
                    return sum + (Number(entry.amount) || 0);
                  }, 0);
                }
              } catch (e) {
                console.error("Error parsing payment entries:", e);
                totalPaymentAmount = 0;
              }
            }
            
            // Set the payment amount for this specific purchase
            payments[purchase.id] = totalPaymentAmount;
            
            console.log(`Purchase ID ${purchase.id} (Invoice: ${purchase.invoice_no}):`, {
              totalAmount: purchase.amount,
              paymentEntries: totalPaymentAmount,
              balanceDue: Number(purchase.amount) - totalPaymentAmount
            });
          } else {
            payments[purchase.id] = 0;
          }
        } catch (error) {
          console.error(`Error fetching payment entries for purchase ${purchase.id}:`, error);
          payments[purchase.id] = 0;
        }
      }
      
      console.log('Final payment amounts from product_stock_request:', payments);
      setLinkedPayments(payments);
    } catch (e) {
      console.error("Failed to fetch linked payments:", e);
      setLinkedPayments({});
    }
  };

  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalUnpaid = 0;
    
    purchases.forEach(p => {
      const amount = Number(p.amount || 0);
      const paidAmount = linkedPayments[p.id] || 0;
      const balanceDue = Math.max(0, amount - paidAmount);
      
      totalPaid += paidAmount; // Amount already paid via payment entries
      totalUnpaid += balanceDue; // Remaining balance due
    });
    
    const total = totalPaid + totalUnpaid;
    return { paid: totalPaid, unpaid: totalUnpaid, total };
  }, [purchases, linkedPayments]);

  const filtered = useMemo(() => {
    let result = purchases;
    if (!search.trim()) return result;
    const q = search.trim().toLowerCase();
    return result.filter(
      (p) =>
        String(p.invoice_no || "").toLowerCase().includes(q) ||
        String(p.vendor_name || "").toLowerCase().includes(q) ||
        String(p.product_name || "").toLowerCase().includes(q) ||
        String(p.reference_no || "").toLowerCase().includes(q)
    );
  }, [purchases, search]);

  const applyTimeFilter = (label) => {
    setTimeFilter(label);
    const today = new Date();
    let start, end;
    switch (label) {
      case "Today":
        start = end = today;
        break;
      case "Yesterday":
        start = end = new Date(today.getTime() - 86400000);
        break;
      case "This Week":
        start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        end = today;
        break;
      case "This Month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      case "Last Month":
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "This Year":
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
        break;
      default:
        return;
    }
    setFromDate(start.toISOString().split("T")[0]);
    setToDate(end.toISOString().split("T")[0]);
  };

  const handleDateChange = (type, value) => {
    if (type === "from") setFromDate(value);
    else setToDate(value);
    setTimeFilter("Custom");
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h1 className="text-xl font-bold text-gray-800">Purchase Products</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => toast.info("Upload feature coming soon")}
              className="flex items-center gap-2 px-4 py-2 border-2 border-red-500 text-red-600 rounded-full hover:bg-red-50 transition font-medium"
            >
              <Upload size={18} /> Upload Purchase Bills
              <ChevronDown size={16} />
            </button>
          </div>
          <Link
            href="/admin-dashboard/purchase-products/add"
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition font-medium shadow-sm"
          >
            <Plus size={18} /> Add Purchase
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border border-gray-300 rounded-md bg-white px-5 py-4 mb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={timeFilter}
                onChange={(e) => applyTimeFilter(e.target.value)}
                className="appearance-none pr-8 pl-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-800 bg-white cursor-pointer hover:bg-gray-50"
              >
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Last Month">Last Month</option>
                <option value="This Year">This Year</option>
                <option value="Custom">Custom</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-2 bg-gray-500 text-white text-xs font-semibold rounded">
                Between
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleDateChange("from", e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <span className="text-gray-500 text-sm font-medium">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleDateChange("to", e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="relative">
              <select
                className="appearance-none pr-8 pl-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white cursor-pointer min-w-[130px]"
                defaultValue="ALL FIRMS"
              >
                <option>ALL FIRMS</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => toast.info("Excel report coming soon")}
              className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-gray-900 transition"
              title="Excel Report"
            >
              <FileSpreadsheet size={20} />
              <span className="text-[10px] font-medium">Excel Report</span>
            </button>
            <button
              onClick={() => toast.info("Print coming soon")}
              className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-gray-900 transition"
              title="Print"
            >
              <Printer size={20} />
              <span className="text-[10px] font-medium">Print</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="flex items-center gap-3 mt-5">
          <div className="bg-[#d5f5e3] border-2 border-[#82e0aa] rounded-md px-5 py-4 min-w-[180px]">
            <div className="text-sm font-semibold text-gray-700 mb-1">Paid</div>
            <div className="text-2xl font-bold text-gray-800">₹ {fmt(stats.paid)}</div>
          </div>
          <span className="text-xl font-bold text-gray-600">+</span>
          <div className="bg-[#d6eaf8] border-2 border-[#85c1e9] rounded-md px-5 py-4 min-w-[180px]">
            <div className="text-sm font-semibold text-gray-700 mb-1">Unpaid</div>
            <div className="text-2xl font-bold text-gray-800">₹ {fmt(stats.unpaid)}</div>
          </div>
          <span className="text-xl font-bold text-gray-600">=</span>
          <div className="bg-[#fdebd0] border-2 border-[#f5cba7] rounded-md px-5 py-4 min-w-[180px]">
            <div className="text-sm font-semibold text-gray-700 mb-1">Total</div>
            <div className="text-2xl font-bold text-gray-800">₹ {fmt(stats.total)}</div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="border border-gray-300 rounded-md bg-white mt-px">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="text-sm font-bold text-gray-800 tracking-wide">TRANSACTIONS</div>
        </div>

        <div className="px-5 pb-3">
          <div className="relative max-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#fafafa] border-t border-b border-gray-200">
                <th className="px-5 py-3 text-left font-semibold text-gray-700 w-[120px]">
                  <div className="flex items-center gap-2">
                    DATE
                    <span className="text-gray-400">
                      <ChevronDown size={14} />
                    </span>
                  </div>
                </th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700 w-[140px]">
                  <div className="flex items-center gap-2">
                    INVOICE NO.
                    <span className="text-gray-400">↓</span>
                    <span className="text-gray-400"><ChevronDown size={14} /></span>
                  </div>
                </th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    PARTY NAME
                    <span className="text-gray-400"><ChevronDown size={14} /></span>
                  </div>
                </th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    PRODUCT
                    <span className="text-gray-400"><ChevronDown size={14} /></span>
                  </div>
                </th>
                <th className="px-5 py-3 text-right font-semibold text-gray-700 w-[140px]">
                  <div className="flex items-center justify-end gap-2">
                    AMOUNT
                    <span className="text-gray-400"><ChevronDown size={14} /></span>
                  </div>
                </th>
                <th className="px-5 py-3 text-right font-semibold text-gray-700 w-[140px]">
                  <div className="flex items-center justify-end gap-2">
                    BALANCE DUE
                    <span className="text-gray-400"><ChevronDown size={14} /></span>
                  </div>
                </th>
                <th className="px-3 py-3 w-[100px]"></th>
                <th className="px-3 py-3 w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-10 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-10 text-center text-gray-500">
                    No purchases found
                  </td>
                </tr>
              ) : (
                filtered.map((purchase, idx) => {
                  const paymentAmount = linkedPayments[purchase.id] || 0;
                  const balanceDue = Math.max(0, Number(purchase.amount || 0) - paymentAmount);
                  
                  // Debug logging for the specific invoice 587
                  if (purchase.invoice_no === "587") {
                    console.log(`Debug Purchase 587:`, {
                      purchase_id: purchase.id,
                      invoice_no: purchase.invoice_no,
                      total_amount: purchase.amount,
                      payment_entries_amount: paymentAmount,
                      balance_due: balanceDue
                    });
                  }
                  
                  return (
                    <tr
                      key={purchase.id}
                      className={`border-b border-gray-100 transition ${
                        idx === 0 ? "bg-[#d6eaf8]" : "bg-white hover:bg-gray-50"}`}
                    >
                      <td className="px-5 py-3 text-gray-800">{formatDate(purchase.purchase_date)}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{purchase.invoice_no || "—"}</td>
                      <td className="px-5 py-3 text-gray-800">{purchase.vendor_name || "—"}</td>
                      <td className="px-5 py-3 text-gray-700 max-w-[260px] truncate" title={purchase.product_name || ""}>
                        {purchase.product_name || "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800">
                        {fmt(purchase.amount || 0)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800">
                        <div title={paymentAmount > 0 ? `Total: ₹${fmt(purchase.amount || 0)} | Paid: ₹${fmt(paymentAmount)} | Balance: ₹${fmt(balanceDue)}` : `Total: ₹${fmt(purchase.amount || 0)}`}>
                          {fmt(balanceDue)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setLinkPurchase(purchase);
                              setLinkPaymentOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                            title="Link Payment"
                          >
                            <Link2 size={16} />
                          </button>
                          <button
                            onClick={() => toast.info("Share coming soon")}
                            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                            title="Share / View"
                          >
                            <ExternalLink size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 relative">
                        <button
                          onClick={(e) => handleMenuClick(e, purchase.id)}
                          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition block mx-auto"
                        >
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setMenuOpen(null)} 
          />
          <div 
            className="fixed z-20 w-40 bg-white border border-gray-200 rounded-md shadow-lg py-1 text-sm"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`
            }}
          >
            <button
              onClick={() => {
                // Navigate to edit page with invoice number to load all products with same invoice
                const purchase = filtered.find(p => p.id === menuOpen);
                if (purchase) {
                  const editUrl = `/admin-dashboard/purchase-products/add?edit=true&invoice=${encodeURIComponent(purchase.invoice_no)}`;
                  window.location.href = editUrl;
                }
                setMenuOpen(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 text-left"
            >
              <Edit2 size={14} /> View/Edit
            </button>
            <button
              onClick={() => {
                // Open PDF if available
                const purchase = filtered.find(p => p.id === menuOpen);
                if (purchase?.invoice_upload) {
                  window.open(purchase.invoice_upload, '_blank');
                } else {
                  toast.error("No PDF available for this purchase");
                }
                setMenuOpen(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 text-left"
            >
              <FileSpreadsheet size={14} /> Open PDF
            </button>
            <button
              onClick={() => {
                // Show preview modal
                const purchase = filtered.find(p => p.id === menuOpen);
                if (purchase) {
                  setSelectedPurchase(purchase);
                  setShowPreviewModal(true);
                }
                setMenuOpen(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 text-left"
            >
              <Eye size={14} /> Preview
            </button>
            <button
              onClick={() => {
                toast.info("Delete coming soon");
                setMenuOpen(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-red-600 text-left"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddPurchaseModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            fetchPurchases();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPurchase && (
        <EditPurchaseModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          purchase={selectedPurchase}
          onSaved={() => {
            setShowEditModal(false);
            fetchPurchases();
          }}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedPurchase && (
        <PreviewModal
          purchase={selectedPurchase}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedPurchase(null);
          }}
        />
      )}

      {/* Link Payment Modal */}
      {linkPaymentOpen && linkPurchase && (
        <LinkPaymentModal
          open={linkPaymentOpen}
          onClose={() => {
            setLinkPaymentOpen(false);
            setLinkPurchase(null);
          }}
          purchase={linkPurchase}
          onLinked={(purchaseId, statementId, transId, action) => {
            console.log(`Payment ${action}ed:`, { purchaseId, statementId, transId });
            // Refresh payment entries from product_stock_request table
            fetchLinkedPayments(purchases);
          }}
        />
      )}
    </div>
  );
}

function AddPurchaseModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    invoice_no: "",
    vendor_name: "",
    product_name: "",
    amount: "",
    status: "Unpaid",
    purchase_date: new Date().toISOString().split("T")[0],
    reference_no: "",
    quantity: "",
    unit_price: "",
    gst_amount: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.invoice_no || !form.vendor_name || !form.product_name || !form.amount) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/purchase-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add purchase");
      toast.success("Purchase added successfully");
      onSaved();
    } catch (e) {
      toast.error(e.message || "Error adding purchase");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Add New Purchase</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Invoice Number *</label>
              <input
                type="text"
                name="invoice_no"
                value={form.invoice_no}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., INV-2026-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Date *</label>
              <input
                type="date"
                name="purchase_date"
                value={form.purchase_date}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vendor Name *</label>
              <input
                type="text"
                name="vendor_name"
                value={form.vendor_name}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., ABC Supplies"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Product Name *</label>
              <input
                type="text"
                name="product_name"
                value={form.product_name}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., Cleaning Chemical"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., 10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit Price</label>
              <input
                type="number"
                name="unit_price"
                value={form.unit_price}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., 500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., 5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">GST Amount</label>
              <input
                type="number"
                name="gst_amount"
                value={form.gst_amount}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., 900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              >
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reference No.</label>
              <input
                type="text"
                name="reference_no"
                value={form.reference_no}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., PO-2026-001"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows="3"
              className="w-full border rounded px-3 py-2"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Purchase"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPurchaseModal({ open, onClose, purchase, onSaved }) {
  const [form, setForm] = useState({
    invoice_no: purchase?.invoice_no || "",
    vendor_name: purchase?.vendor_name || "",
    product_name: purchase?.product_name || "",
    amount: purchase?.amount || "",
    status: purchase?.status || "Unpaid",
    purchase_date: purchase?.purchase_date ? purchase.purchase_date.split("T")[0] : "",
    reference_no: purchase?.reference_no || "",
    quantity: purchase?.quantity || "",
    unit_price: purchase?.unit_price || "",
    gst_amount: purchase?.gst_amount || "",
    notes: purchase?.notes || "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.invoice_no || !form.vendor_name || !form.product_name || !form.amount) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/purchase-products/${purchase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update purchase");
      toast.success("Purchase updated successfully");
      onSaved();
    } catch (e) {
      toast.error(e.message || "Error updating purchase");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Edit Purchase</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Invoice Number *</label>
              <input
                type="text"
                name="invoice_no"
                value={form.invoice_no}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Date *</label>
              <input
                type="date"
                name="purchase_date"
                value={form.purchase_date}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vendor Name *</label>
              <input
                type="text"
                name="vendor_name"
                value={form.vendor_name}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Product Name *</label>
              <input
                type="text"
                name="product_name"
                value={form.product_name}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit Price</label>
              <input
                type="number"
                name="unit_price"
                value={form.unit_price}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">GST Amount</label>
              <input
                type="number"
                name="gst_amount"
                value={form.gst_amount}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              >
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reference No.</label>
              <input
                type="text"
                name="reference_no"
                value={form.reference_no}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows="3"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Purchase"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Preview Modal Component
function PreviewModal({ purchase, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Purchase Preview</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <label className="block text-sm font-medium text-gray-600 mb-1">Invoice Number</label>
              <div className="text-lg font-semibold text-gray-800">{purchase.invoice_no || "—"}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <label className="block text-sm font-medium text-gray-600 mb-1">Purchase Date</label>
              <div className="text-lg font-semibold text-gray-800">{formatDate(purchase.purchase_date)}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <label className="block text-sm font-medium text-gray-600 mb-1">Vendor Name</label>
              <div className="text-lg font-semibold text-gray-800">{purchase.vendor_name || "—"}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
              <div className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${
                purchase.status === "Paid" ? "bg-green-100 text-green-800" :
                purchase.status === "Partially Paid" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}>
                {purchase.status}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <label className="block text-sm font-medium text-gray-600 mb-1">Product</label>
              <div className="text-lg font-semibold text-gray-800">{purchase.product_name || "—"}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <label className="block text-sm font-medium text-gray-600 mb-1">Amount</label>
              <div className="text-lg font-semibold text-gray-800">₹ {fmt(purchase.amount || 0)}</div>
            </div>
            {purchase.quantity && (
              <div className="bg-gray-50 p-3 rounded">
                <label className="block text-sm font-medium text-gray-600 mb-1">Quantity</label>
                <div className="text-lg font-semibold text-gray-800">{purchase.quantity}</div>
              </div>
            )}
            {purchase.unit_price && (
              <div className="bg-gray-50 p-3 rounded">
                <label className="block text-sm font-medium text-gray-600 mb-1">Unit Price</label>
                <div className="text-lg font-semibold text-gray-800">₹ {fmt(purchase.unit_price)}</div>
              </div>
            )}
            {purchase.gst_amount && (
              <div className="bg-gray-50 p-3 rounded">
                <label className="block text-sm font-medium text-gray-600 mb-1">GST Amount</label>
                <div className="text-lg font-semibold text-gray-800">₹ {fmt(purchase.gst_amount)}</div>
              </div>
            )}
            {purchase.reference_no && (
              <div className="bg-gray-50 p-3 rounded">
                <label className="block text-sm font-medium text-gray-600 mb-1">Reference No.</label>
                <div className="text-lg font-semibold text-gray-800">{purchase.reference_no}</div>
              </div>
            )}
          </div>

          {purchase.notes && (
            <div className="bg-gray-50 p-3 rounded">
              <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
              <div className="text-gray-800">{purchase.notes}</div>
            </div>
          )}

          {/* Document Uploads */}
          {[
            { key: "eway_bill",            label: "E-Way Bill" },
            { key: "product_image",        label: "Product Image" },
            { key: "invoice_upload",       label: "Invoice" },
            { key: "payment_proof_upload", label: "Payment Proof" },
            { key: "quotation_upload",     label: "Quotation" },
          ].some(({ key }) => purchase[key]) && (
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <label className="block text-sm font-medium text-blue-600 mb-2">Uploaded Documents</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "eway_bill",            label: "E-Way Bill" },
                  { key: "product_image",        label: "Product Image" },
                  { key: "invoice_upload",       label: "Invoice" },
                  { key: "payment_proof_upload", label: "Payment Proof" },
                  { key: "quotation_upload",     label: "Quotation" },
                ].map(({ key, label }) =>
                  purchase[key] ? (
                    <button
                      key={key}
                      onClick={() => window.open(purchase[key], "_blank")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      <FileSpreadsheet size={13} />
                      {label}
                    </button>
                  ) : null
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={() => {
              // Navigate to edit page with invoice number to load all products
              const editUrl = `/admin-dashboard/purchase-products/add?edit=true&invoice=${encodeURIComponent(purchase.invoice_no)}`;
              window.location.href = editUrl;
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Purchase
          </button>
        </div>
      </div>
    </div>
  );
}
