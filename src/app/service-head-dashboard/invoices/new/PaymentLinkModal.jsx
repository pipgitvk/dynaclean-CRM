"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";

function PaymentStatusBadge({ deductedTotal, totalAmount }) {
  if (totalAmount <= 0) return null;

  let label, cls;
  if (deductedTotal <= 0) {
    label = "Unsettled";
    cls = "bg-red-100 text-red-700 border-red-300";
  } else if (deductedTotal >= totalAmount) {
    label = "Settled";
    cls = "bg-green-100 text-green-700 border-green-300";
  } else {
    label = "Partial Paid";
    cls = "bg-yellow-100 text-yellow-700 border-yellow-300";
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function normalizeTransId(t) {
  return t != null ? String(t).trim() : "";
}

/** Row cannot be newly selected: already on ANOTHER invoice or linked in DB to another invoice. */
function isStatementRowLocked(statement, lockedTransIds, currentInvoiceNumber) {
  const tid = normalizeTransId(statement.trans_id);
  
  // If it's already in our locked list (meaning it's linked to THIS invoice in the parent state)
  // it is NOT locked for unlinking.
  if (
    tid &&
    Array.isArray(lockedTransIds) &&
    lockedTransIds.some((x) => normalizeTransId(x) === tid)
  ) {
    return false;
  }

  const inv =
    statement.invoice_number != null
      ? String(statement.invoice_number).trim()
      : "";
  
  // If it's linked to THIS invoice, it's NOT locked.
  if (currentInvoiceNumber && inv === String(currentInvoiceNumber).trim()) {
    return false;
  }

  return inv.length > 0;
}

export default function PaymentLinkModal({
  open,
  onClose,
  defaultCustomerId = "",
  defaultAmount = 0,
  onApply,
  lockedTransIds = [],
  currentInvoiceNumber = "",
}) {
  const customerId = defaultCustomerId;
  const totalAmount = defaultAmount;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statements, setStatements] = useState([]);
  const [filteredStatements, setFilteredStatements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deductedIds, setDeductedIds] = useState(new Set());

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/statements");
      const data = await res.json();
      if (data.statements) {
        setStatements(data.statements);
        setFetched(true);
      } else {
        toast.error("Failed to load statements");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching statements");
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter to credit only + date range
  useEffect(() => {
    if (!fetched) return;
    let result = statements.filter((s) => s.type?.toLowerCase() === "credit");

    // We MUST include statements that are already linked to this invoice, 
    // even if they are outside the selected date range, so they can be unlinked.
    const alreadyLinkedTids = new Set(lockedTransIds.map(normalizeTransId));
    const currentInvTrim = String(currentInvoiceNumber || "").trim();

    if (fromDate || toDate) {
      result = result.filter((s) => {
        const tid = normalizeTransId(s.trans_id);
        const inv = String(s.invoice_number || "").trim();
        
        // Keep if linked to this invoice or in lockedTransIds
        if (tid && alreadyLinkedTids.has(tid)) return true;
        if (currentInvTrim && inv === currentInvTrim) return true;

        const d = s.date || s.txn_dated_deb || s.txn_posted_date;
        let ok = true;
        if (fromDate && (!d || d < fromDate)) ok = false;
        if (toDate && (!d || d > toDate)) ok = false;
        return ok;
      });
    }

    setFilteredStatements(result);
    
    // Initialize deductedIds with already linked statements
    const initialDeducted = new Set();
    result.forEach(s => {
      const tid = normalizeTransId(s.trans_id);
      const inv = String(s.invoice_number || "").trim();
      if ((tid && alreadyLinkedTids.has(tid)) || (currentInvTrim && inv === currentInvTrim)) {
        initialDeducted.add(s.id);
      }
    });
    setDeductedIds(initialDeducted);
  }, [statements, fromDate, toDate, fetched, lockedTransIds, currentInvoiceNumber]);

  const handleApplyFilter = () => {
    if (!fetched) fetchStatements();
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    // deductedIds will be reset by the useEffect above
  };

  const toggleDeduct = (id) => {
    setDeductedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const row = filteredStatements.find((s) => s.id === id);
        if (row && isStatementRowLocked(row, lockedTransIds, currentInvoiceNumber)) {
          toast.error(
            "This statement is already linked to another invoice and cannot be selected",
          );
          return prev;
        }
        const rowAmount = Number(row?.amount || 0);
        const currentDeducted = filteredStatements
          .filter((s) => next.has(s.id))
          .reduce((sum, s) => sum + Number(s.amount || 0), 0);
        if (currentDeducted + rowAmount > totalAmount) {
          toast.error("Deducted amount cannot exceed total amount");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const totalCredit = filteredStatements.reduce(
    (sum, s) => sum + Number(s.amount || 0),
    0
  );

  const deductedTotal = filteredStatements
    .filter((s) => deductedIds.has(s.id))
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const remainingAmount = totalAmount - deductedTotal;

  const generatePaymentLink = () => {
    const params = new URLSearchParams({
      customer_id: customerId,
      amount: remainingAmount > 0 ? remainingAmount : totalAmount,
      ...(fromDate && { from: fromDate }),
      ...(toDate && { to: toDate }),
    });
    const link = `${window.location.origin}/payment?${params.toString()}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success("Payment link copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-blue-600 rounded-t-lg">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Payment Link Generator</h2>
            <PaymentStatusBadge deductedTotal={deductedTotal} totalAmount={totalAmount} />
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Customer ID + Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer ID
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
                value={customerId || "-"}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount (₹)
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed font-medium"
                value={`₹${Number(totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                readOnly
              />
            </div>
          </div>

          {/* Date Filter */}
          <div className="bg-gray-50 border rounded p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Filter Statements by Date
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">From Date</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">To Date</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyFilter}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? "Loading..." : "Apply Filter"}
                </button>
                {fetched && (
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Statements Table */}
          {fetched && (
            <div>
              {/* Summary chips */}
              <div className="flex flex-wrap gap-3 mb-3 items-center">
                <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-sm">
                  <span className="text-gray-500">Total Credit: </span>
                  <span className="font-semibold text-green-700">
                    ₹{totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded px-4 py-2 text-sm">
                  <span className="text-gray-500">Records: </span>
                  <span className="font-semibold text-blue-700">{filteredStatements.length}</span>
                </div>
                {deductedIds.size > 0 && (
                  <>
                    <div className="bg-orange-50 border border-orange-200 rounded px-4 py-2 text-sm">
                      <span className="text-gray-500">Deducted: </span>
                      <span className="font-semibold text-orange-700">
                        ₹{deductedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-sm">
                      <span className="text-gray-500">Remaining: </span>
                      <span className="font-semibold text-red-700">
                        ₹{remainingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <PaymentStatusBadge deductedTotal={deductedTotal} totalAmount={totalAmount} />
                  </>
                )}
              </div>

              <div className="overflow-x-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Trans ID</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Invoice No</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Amount (₹)</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Select</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-gray-400">
                          No statements found for the selected date range
                        </td>
                      </tr>
                    ) : (
                      filteredStatements.map((s, idx) => {
                        const isDeducted = deductedIds.has(s.id);
                        const rowLocked = isStatementRowLocked(s, lockedTransIds, currentInvoiceNumber);
                        const displayDate = s.date || s.txn_dated_deb || s.txn_posted_date || "-";
                        const invoiceNo = s.invoice_number || null;
                        
                        // If it's already linked to THIS invoice, we show a special badge
                        const isLinkedToThis = (invoiceNo && currentInvoiceNumber && String(invoiceNo).trim() === String(currentInvoiceNumber).trim()) ||
                                               (normalizeTransId(s.trans_id) && lockedTransIds.some(ltid => normalizeTransId(ltid) === normalizeTransId(s.trans_id)));

                        return (
                          <tr
                            key={s.id}
                            className={`border-t transition-colors ${
                              isDeducted
                                ? isLinkedToThis ? "bg-blue-50" : "bg-green-50"
                                : rowLocked
                                  ? "bg-gray-50/80 opacity-90"
                                  : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs">{s.trans_id || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {displayDate
                                ? new Date(displayDate).toLocaleDateString("en-IN")
                                : "-"}
                            </td>
                            <td className="px-3 py-2 max-w-[180px] truncate text-gray-600">
                              {s.description || "-"}
                            </td>
                            <td className="px-3 py-2">
                              {isLinkedToThis ? (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                                  Current Invoice
                                </span>
                              ) : invoiceNo ? (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded">
                                  {invoiceNo}
                                </span>
                              ) : isDeducted ? (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                                  Selected
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-green-700">
                              +{Number(s.amount || 0).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleDeduct(s.id)}
                                disabled={rowLocked && !isDeducted}
                                title={
                                  rowLocked && !isDeducted
                                    ? `Already linked to invoice ${invoiceNo}`
                                    : isDeducted
                                      ? isLinkedToThis ? "Unlink from invoice" : "Undo selection"
                                      : "Select this statement"
                                }
                                className={`w-7 h-7 rounded-full text-lg font-bold leading-none transition-all ${
                                  rowLocked && !isDeducted
                                    ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                    : isDeducted
                                      ? isLinkedToThis ? "bg-red-500 text-white hover:bg-red-600" : "bg-green-500 text-white hover:bg-red-400"
                                      : "bg-gray-200 text-gray-600 hover:bg-green-500 hover:text-white"
                                }`}
                              >
                                {isDeducted ? (isLinkedToThis ? "×" : "✓") : rowLocked ? "—" : "+"}
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
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-lg flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-sm text-gray-700 flex flex-wrap items-center gap-4">
            {customerId && (
              <span>
                Customer: <strong>{customerId}</strong>
              </span>
            )}
            {totalAmount > 0 && (
              <span>
                Total:{" "}
                <strong className="text-gray-800">
                  ₹{Number(totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </strong>
              </span>
            )}
            {deductedIds.size > 0 && (
              <span>
                Amount Due:{" "}
                <strong className={remainingAmount <= 0 ? "text-green-600" : "text-red-600"}>
                  ₹{remainingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </strong>
              </span>
            )}
            <PaymentStatusBadge deductedTotal={deductedTotal} totalAmount={totalAmount} />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm hover:bg-gray-100"
            >
              Close
            </button>
            <button
              onClick={generatePaymentLink}
              disabled={!customerId || totalAmount <= 0}
              className="px-5 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {copied ? "Copied!" : "Copy Payment Link"}
            </button>
            {onApply && (
              <button
                onClick={() => {
                  const selectedTransIds = filteredStatements
                    .filter((s) => deductedIds.has(s.id))
                    .map((s) => s.trans_id)
                    .filter(Boolean);
                  const paymentStatus =
                      deductedTotal >= totalAmount
                        ? "Settled"
                        : deductedTotal > 0
                        ? "Partial Paid"
                        : "Unsettled";
                  onApply(selectedTransIds, paymentStatus, deductedTotal);
                  toast.success(`${selectedTransIds.length} Trans ID(s) linked to invoice`);
                  onClose();
                }}
                className="px-5 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium"
              >
                Apply to Invoice ({deductedIds.size})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
