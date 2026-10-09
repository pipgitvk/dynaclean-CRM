"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import {
  Search,
  Download,
  X,
  Loader2,
  MinusCircle,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

const DEDUCTION_TYPES = ["TDS", "LD", "SD", "Others"];

function defaultClaimable(type) {
  if (type === "TDS") return false;
  if (type === "LD" || type === "SD") return true;
  return false;
}

export default function PaymentDeductionsReport({ paymentPendingPath }) {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get("order_id") || "";

  const [deductions, setDeductions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deductionTypeFilter, setDeductionTypeFilter] = useState("all");
  const [claimableFilter, setClaimableFilter] = useState("all");
  const [claimStatusFilter, setClaimStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderIdFilter, setOrderIdFilter] = useState(initialOrderId);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const canManage = ["ACCOUNTANT", "PRODUCTION ACCOUNTANT", "ADMIN", "SUPERADMIN"].includes(userRole);
  const canViewSummary = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "PRODUCTION ACCOUNTANT"].includes(userRole);

  const fetchDeductions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (deductionTypeFilter !== "all") params.set("deduction_type", deductionTypeFilter);
      if (claimableFilter !== "all") params.set("claimable", claimableFilter);
      if (claimStatusFilter !== "all") params.set("claim_status", claimStatusFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (orderIdFilter.trim()) params.set("order_id", orderIdFilter.trim());

      const res = await fetch(`/api/payment-deduction?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to fetch deductions");
      }
      setDeductions(data.deductions || []);
      setSummary(data.summary || null);
      setUserRole(data.userRole || "");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to fetch deductions");
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    deductionTypeFilter,
    claimableFilter,
    claimStatusFilter,
    dateFrom,
    dateTo,
    orderIdFilter,
  ]);

  useEffect(() => {
    fetchDeductions();
  }, [fetchDeductions]);

  const exportToCSV = () => {
    const headers = [
      "Order Number",
      "Party Name",
      "Address",
      "Contact",
      "Amount",
      "Deduction Type",
      "Remark",
      "Claimable",
      "Claim Status",
      "Claim Received Date",
      "Recorded By",
      "Recorded Date",
    ];
    const rows = deductions.map((d) => [
      d.order_id,
      d.party_name,
      d.address,
      d.contact,
      Number(d.amount || 0).toFixed(2),
      d.deduction_type,
      d.remarks,
      d.claimable ? "Yes" : "No",
      d.claim_status,
      d.claim_received_date ? dayjs(d.claim_received_date).format("DD/MM/YYYY") : "",
      d.recorded_by,
      d.recorded_date ? dayjs(d.recorded_date).format("DD/MM/YYYY hh:mm A") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payment-deductions-${dayjs().format("YYYY-MM-DD")}.csv`;
    link.click();
  };

  const handleClaimStatusChange = async (deduction, nextStatus) => {
    if (!canManage) return;
    try {
      setUpdatingId(deduction.id);
      const res = await fetch(`/api/payment-deduction/record/${deduction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_status: nextStatus,
          claim_received_date:
            nextStatus === "received" ? dayjs().format("YYYY-MM-DD HH:mm:ss") : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update claim status");
      }
      fetchDeductions();
    } catch (error) {
      alert(error.message || "Failed to update claim status");
    } finally {
      setUpdatingId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDeductionTypeFilter("all");
    setClaimableFilter("all");
    setClaimStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setOrderIdFilter("");
  };

  return (
    <div className="w-full max-w-full p-3 overflow-hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={paymentPendingPath}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft size={14} />
            Payment Pending
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Payment Deductions</h1>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            <MinusCircle size={16} />
            Add Deduction
          </button>
        )}
      </div>

      {canViewSummary && summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <SummaryCard label="Total Deduction" value={summary.total_deduction} color="text-gray-800" />
          <SummaryCard label="Claimable" value={summary.claimable_amount} color="text-blue-700" />
          <SummaryCard label="Claimed" value={summary.claimed_amount} color="text-green-700" />
          <SummaryCard label="Pending Claim" value={summary.pending_claim_amount} color="text-orange-700" />
          <SummaryCard label="Not Claimable" value={summary.not_claimable_amount} color="text-purple-700" />
        </div>
      )}

      <div className="mb-4 rounded-lg bg-white p-3 shadow">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-8">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
            <input
              type="text"
              placeholder="Search order, party, contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-gray-300 py-1.5 pl-6 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <input
            type="text"
            placeholder="Order ID"
            value={orderIdFilter}
            onChange={(e) => setOrderIdFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
          <select
            value={deductionTypeFilter}
            onChange={(e) => setDeductionTypeFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="all">All Types</option>
            {DEDUCTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={claimableFilter}
            onChange={(e) => setClaimableFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="all">All Claimable</option>
            <option value="yes">Claimable</option>
            <option value="no">Not Claimable</option>
          </select>
          <select
            value={claimStatusFilter}
            onChange={(e) => setClaimStatusFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="all">All Claim Status</option>
            <option value="received">Received</option>
            <option value="not received">Not Received</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-xs"
            title="From Date"
          />
          <div className="flex gap-1">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
              title="To Date"
            />
            {(searchQuery ||
              deductionTypeFilter !== "all" ||
              claimableFilter !== "all" ||
              claimStatusFilter !== "all" ||
              dateFrom ||
              dateTo ||
              orderIdFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded bg-gray-500 px-2 py-1.5 text-white hover:bg-gray-600"
                title="Clear Filters"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={exportToCSV}
              className="rounded bg-green-600 px-2 py-1.5 text-white hover:bg-green-700"
              title="Export CSV"
            >
              <Download size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="max-h-[calc(100vh-280px)] overflow-x-auto overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-800 text-white">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Order No.</th>
                <th className="px-3 py-3 text-left font-semibold">Party Name</th>
                <th className="px-3 py-3 text-left font-semibold">Address</th>
                <th className="px-3 py-3 text-left font-semibold">Contact</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="px-3 py-3 text-center font-semibold">Type</th>
                <th className="px-3 py-3 text-left font-semibold">Remark</th>
                <th className="px-3 py-3 text-center font-semibold">Claimable</th>
                <th className="px-3 py-3 text-center font-semibold">Claim Status</th>
                <th className="px-3 py-3 text-center font-semibold">Claim Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-gray-500">
                    <Loader2 className="mx-auto mb-2 animate-spin" size={20} />
                    Loading deductions...
                  </td>
                </tr>
              ) : deductions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-gray-500">
                    No deductions found
                  </td>
                </tr>
              ) : (
                deductions.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-800">{item.order_id}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-800">{item.party_name || "-"}</div>
                      {item.company_name && item.company_name !== item.party_name && (
                        <div className="text-xs text-gray-500">{item.company_name}</div>
                      )}
                    </td>
                    <td className="max-w-[180px] px-3 py-3 text-xs text-gray-700">{item.address || "-"}</td>
                    <td className="px-3 py-3 text-gray-700">{item.contact || "-"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-orange-600">
                      ₹{Number(item.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TypeBadge type={item.deduction_type} />
                    </td>
                    <td className="max-w-[200px] px-3 py-3 text-xs text-gray-700">{item.remarks || "-"}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          item.claimable
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item.claimable ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {canManage && item.claimable ? (
                        <select
                          value={item.claim_status || "not received"}
                          disabled={updatingId === item.id}
                          onChange={(e) => handleClaimStatusChange(item, e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        >
                          <option value="not received">Not Received</option>
                          <option value="received">Received</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            String(item.claim_status).toLowerCase() === "received"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {item.claim_status || "not received"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-gray-700">
                      {item.claim_received_date
                        ? dayjs(item.claim_received_date).format("DD/MM/YYYY")
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddDeductionModal
        open={addModalOpen}
        initialOrderId={orderIdFilter || initialOrderId}
        onClose={() => setAddModalOpen(false)}
        onSaved={() => {
          setAddModalOpen(false);
          fetchDeductions();
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-lg border bg-gradient-to-r from-gray-50 to-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>₹{Number(value || 0).toLocaleString("en-IN")}</p>
    </div>
  );
}

function TypeBadge({ type }) {
  const cls =
    type === "LD"
      ? "bg-blue-100 text-blue-700"
      : type === "SD"
        ? "bg-green-100 text-green-700"
        : type === "TDS"
          ? "bg-purple-100 text-purple-700"
          : "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>
      {type}
    </span>
  );
}

function AddDeductionModal({ open, onClose, initialOrderId, onSaved }) {
  const [orderId, setOrderId] = useState("");
  const [deductionType, setDeductionType] = useState("TDS");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [claimable, setClaimable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrderId(initialOrderId || "");
    setDeductionType("TDS");
    setAmount("");
    setRemarks("");
    setClaimable(defaultClaimable("TDS"));
    setOrderInfo(null);
  }, [open, initialOrderId]);

  useEffect(() => {
    setClaimable(defaultClaimable(deductionType));
  }, [deductionType]);

  useEffect(() => {
    if (!open || !orderId.trim()) {
      setOrderInfo(null);
      return;
    }

    let cancelled = false;
    async function loadOrder() {
      try {
        setLoadingOrder(true);
        const res = await fetch(`/api/reports/payment-pending?completion=all`);
        const data = await res.json();
        if (!res.ok || !data?.success) return;
        const match = (data.orders || []).find((o) => o.order_id === orderId.trim());
        if (!cancelled) setOrderInfo(match || null);
      } catch {
        if (!cancelled) setOrderInfo(null);
      } finally {
        if (!cancelled) setLoadingOrder(false);
      }
    }

    const timer = setTimeout(loadOrder, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, orderId]);

  if (!open) return null;

  const remainingBeforeNew = Number(orderInfo?.remaining_amount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="text-lg font-bold text-gray-900">Add Deduction</div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-gray-700">Order Number</label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter order ID"
            />
          </div>

          {loadingOrder ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 size={14} className="animate-spin" />
              Loading order details...
            </div>
          ) : orderInfo ? (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <div>
                <div className="text-xs text-gray-500">Party</div>
                <div className="font-semibold">{orderInfo.client_name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Remaining</div>
                <div className="font-semibold text-red-600">₹{remainingBeforeNew.toFixed(2)}</div>
              </div>
            </div>
          ) : orderId.trim() ? (
            <div className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
              Order not found in payment pending list
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-gray-700">Deduction Type</label>
              <select
                value={deductionType}
                onChange={(e) => setDeductionType(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {DEDUCTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-gray-700">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={claimable}
              onChange={(e) => setClaimable(e.target.checked)}
              className="rounded border-gray-300"
            />
            Claimable deduction
          </label>

          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-gray-700">Remark</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Reason for deduction..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              const deductionAmount = Number(amount);
              if (!orderId.trim()) {
                alert("Order number is required");
                return;
              }
              if (!Number.isFinite(deductionAmount) || deductionAmount <= 0) {
                alert("Enter a valid deduction amount");
                return;
              }
              if (orderInfo && deductionAmount > remainingBeforeNew) {
                alert("Deduction cannot be more than remaining amount");
                return;
              }
              if (!remarks.trim()) {
                alert("Remark is required");
                return;
              }
              try {
                setSubmitting(true);
                const res = await fetch("/api/payment-deduction", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    order_id: orderId.trim(),
                    deduction_type: deductionType,
                    amount: deductionAmount,
                    remarks: remarks.trim(),
                    claimable,
                  }),
                });
                const data = await res.json();
                if (!res.ok || !data?.success) {
                  throw new Error(data?.error || "Failed to save deduction");
                }
                alert("Deduction saved");
                onSaved?.();
              } catch (e) {
                alert(e?.message || "Failed to save deduction");
              } finally {
                setSubmitting(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Save Deduction
          </button>
        </div>
      </div>
    </div>
  );
}
