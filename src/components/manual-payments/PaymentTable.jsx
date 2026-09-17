"use client";

import { useState, useMemo, useEffect } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { History, Loader2, PhoneCall, X } from "lucide-react";

dayjs.extend(utc);

export default function PaymentTable({ rows, role, editBasePath = "/admin-dashboard/manual-payments" }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortField, setSortField] = useState("created_at");
    const [sortOrder, setSortOrder] = useState("desc");
    const [currentPage, setCurrentPage] = useState(1);
    const [followupModalOpen, setFollowupModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const rowsPerPage = 20;

    const filteredData = useMemo(() => {
        let filtered = rows.filter((row) => {
            const matchesSearch =
                row.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.customer_phone?.includes(searchTerm) ||
                row.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === "all" || row.status === statusFilter;

            return matchesSearch && matchesStatus;
        });

        filtered.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            if (sortField === "amount") {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
            if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [rows, searchTerm, statusFilter, sortField, sortOrder]);

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this payment entry?")) {
            return;
        }

        try {
            const res = await fetch(`/api/manual-payment-pending/${id}`, {
                method: "DELETE",
            });

            const data = await res.json();

            if (data.success) {
                alert("Payment entry deleted successfully");
                window.location.reload();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete payment entry");
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
            received: "bg-green-100 text-green-800 border-green-300",
            cancelled: "bg-red-100 text-red-800 border-red-300",
        };
        return badges[status] || "bg-gray-100 text-gray-800 border-gray-300";
    };

    const getPaymentTypeBadge = (type) => {
        const badges = {
            advance: "bg-blue-100 text-blue-800",
            full: "bg-green-100 text-green-800",
            partial: "bg-yellow-100 text-yellow-800",
            balance: "bg-purple-100 text-purple-800",
        };
        return badges[type] || "bg-gray-100 text-gray-800";
    };

    const editHref = (id) => `${editBasePath}/edit/${id}`;

    return (
        <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Search
                        </label>
                        <input
                            type="text"
                            placeholder="Customer name, phone, reference..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status Filter
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="received">Received</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Results
                        </label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                            Showing {paginatedData.length} of {filteredData.length} entries
                        </div>
                    </div>
                </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th
                                onClick={() => handleSort("customer_name")}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            >
                                Customer {sortField === "customer_name" && (sortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                                onClick={() => handleSort("amount")}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            >
                                Amount {sortField === "amount" && (sortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Payment Type
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Method
                            </th>
                            <th
                                onClick={() => handleSort("payment_date")}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            >
                                Payment Date {sortField === "payment_date" && (sortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                                onClick={() => handleSort("status")}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            >
                                Status {sortField === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Invoice
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedData.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="text-sm font-medium text-gray-900">
                                        {row.customer_name}
                                    </div>
                                    {row.customer_phone && (
                                        <div className="text-sm text-gray-500">{row.customer_phone}</div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                    ₹{parseFloat(row.amount).toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentTypeBadge(row.payment_type)}`}>
                                        {row.payment_type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                                    {row.payment_method}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                    {row.payment_date ? dayjs.utc(row.payment_date).format("DD MMM YYYY") : "-"}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(row.status)}`}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    {row.invoice_file ? (
                                        <a
                                            href={row.invoice_file}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 underline"
                                        >
                                            View
                                        </a>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPayment(row);
                                                setFollowupModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            <PhoneCall size={14} />
                                            Followup
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPayment(row);
                                                setHistoryModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900 font-medium"
                                        >
                                            <History size={14} />
                                            History
                                        </button>
                                        <a
                                            href={editHref(row.id)}
                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Edit
                                        </a>
                                        {["ADMIN", "SUPERADMIN"].includes(role) && (
                                            <button
                                                onClick={() => handleDelete(row.id)}
                                                className="text-red-600 hover:text-red-800 font-medium"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden">
                {paginatedData.map((row) => (
                    <div key={row.id} className="border-b border-gray-200 p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-semibold text-gray-900">{row.customer_name}</h3>
                                {row.customer_phone && (
                                    <p className="text-sm text-gray-600">{row.customer_phone}</p>
                                )}
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(row.status)}`}>
                                {row.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                                <span className="text-gray-600">Amount:</span>
                                <p className="font-semibold text-gray-900">
                                    ₹{parseFloat(row.amount).toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-600">Type:</span>
                                <p className="capitalize">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPaymentTypeBadge(row.payment_type)}`}>
                                        {row.payment_type}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-600">Method:</span>
                                <p className="capitalize text-gray-900">{row.payment_method}</p>
                            </div>
                            <div>
                                <span className="text-gray-600">Date:</span>
                                <p className="text-gray-900">
                                    {row.payment_date ? dayjs.utc(row.payment_date).format("DD MMM YYYY") : "-"}
                                </p>
                            </div>
                        </div>

                        {row.invoice_file && (
                            <div className="mb-3">
                                <a
                                    href={row.invoice_file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                                >
                                    View Invoice
                                </a>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPayment(row);
                                    setFollowupModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                            >
                                <PhoneCall size={14} />
                                Followup
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPayment(row);
                                    setHistoryModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900 font-medium text-sm"
                            >
                                <History size={14} />
                                History
                            </button>
                            <a
                                href={editHref(row.id)}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                            >
                                Edit
                            </a>
                            {["ADMIN", "SUPERADMIN"].includes(role) && (
                                <button
                                    onClick={() => handleDelete(row.id)}
                                    className="text-red-600 hover:text-red-800 font-medium text-sm"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-700">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}

            {paginatedData.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                    No payment entries found
                </div>
            )}

            <FollowupModal
                open={followupModalOpen}
                payment={selectedPayment}
                onClose={() => {
                    setFollowupModalOpen(false);
                    setSelectedPayment(null);
                }}
                onSaved={() => {
                    setFollowupModalOpen(false);
                    setSelectedPayment(null);
                }}
            />

            <HistoryModal
                open={historyModalOpen}
                payment={selectedPayment}
                onClose={() => {
                    setHistoryModalOpen(false);
                    setSelectedPayment(null);
                }}
            />
        </div>
    );
}

function FollowupModal({ open, onClose, payment, onSaved }) {
    const [followedDate, setFollowedDate] = useState("");
    const [communicationMode, setCommunicationMode] = useState("Call");
    const [nextFollowupDate, setNextFollowupDate] = useState("");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFollowedDate(dayjs().format("YYYY-MM-DDTHH:mm"));
        setCommunicationMode("Call");
        setNextFollowupDate("");
        setNotes("");
    }, [open, payment?.id]);

    if (!open || !payment) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <div>
                        <div className="text-lg font-bold text-gray-900">Add Followup</div>
                        <div className="text-xs text-gray-600">
                            Payment #{payment.id}
                            {payment.customer_name ? ` | ${payment.customer_name}` : ""}
                            {payment.customer_phone ? ` | ${payment.customer_phone}` : ""}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex flex-col">
                            <label className="mb-1 text-xs font-semibold text-gray-700">
                                Followed Date
                            </label>
                            <input
                                type="datetime-local"
                                value={followedDate}
                                readOnly
                                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="mb-1 text-xs font-semibold text-gray-700">
                                Communication Mode
                            </label>
                            <select
                                value={communicationMode}
                                onChange={(e) => setCommunicationMode(e.target.value)}
                                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Call">Call</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Email">Email</option>
                                <option value="Visit">Visit</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex flex-col">
                            <label className="mb-1 text-xs font-semibold text-gray-700">
                                Next Followup Date
                            </label>
                            <input
                                type="datetime-local"
                                value={nextFollowupDate}
                                onChange={(e) => setNextFollowupDate(e.target.value)}
                                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="mb-1 text-xs font-semibold text-gray-700">
                                Amount
                            </label>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                                ₹{Number(payment.amount || 0).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="mb-1 text-xs font-semibold text-gray-700">Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={4}
                            className="resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Call details / customer response / payment plan..."
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
                            if (!notes.trim()) {
                                alert("Notes required");
                                return;
                            }
                            try {
                                setSubmitting(true);
                                const res = await fetch("/api/manual-payment-pending/followups", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        payment_id: payment.id,
                                        customer_name: payment.customer_name || null,
                                        customer_phone: payment.customer_phone || null,
                                        followed_date: followedDate || null,
                                        communication_mode: communicationMode || null,
                                        next_followup_date: nextFollowupDate || null,
                                        notes: notes.trim(),
                                    }),
                                });

                                const data = await res.json();
                                if (!res.ok || !data?.success) {
                                    throw new Error(data?.error || "Failed to save followup");
                                }

                                alert("Followup saved");
                                onSaved?.();
                            } catch (e) {
                                alert(e?.message || "Failed to save followup");
                            } finally {
                                setSubmitting(false);
                            }
                        }}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <PhoneCall size={16} />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

function HistoryModal({ open, onClose, payment }) {
    const [loading, setLoading] = useState(false);
    const [followups, setFollowups] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open || !payment?.id) return;
        let cancelled = false;

        async function run() {
            try {
                setError("");
                setLoading(true);
                const res = await fetch(
                    `/api/manual-payment-pending/followups?payment_id=${encodeURIComponent(payment.id)}`,
                );
                const data = await res.json();
                if (!res.ok || !data?.success) {
                    throw new Error(data?.error || "Failed to fetch history");
                }
                if (cancelled) return;
                setFollowups(data.followups || []);
            } catch (e) {
                if (cancelled) return;
                setError(e?.message || "Failed to fetch history");
                setFollowups([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [open, payment?.id]);

    if (!open || !payment) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <div>
                        <div className="text-lg font-bold text-gray-900">Followup History</div>
                        <div className="text-xs text-gray-600">
                            Payment #{payment.id}
                            {payment.customer_name ? ` | ${payment.customer_name}` : ""}
                            {payment.customer_phone ? ` | ${payment.customer_phone}` : ""}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-700">
                            <Loader2 size={18} className="animate-spin" />
                            Loading...
                        </div>
                    ) : error ? (
                        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                    ) : followups.length === 0 ? (
                        <div className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                            No followups yet
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {followups.map((f) => (
                                <div key={f.id} className="rounded-md border border-gray-200 p-4">
                                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {f.created_by || "Unknown"}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            {f.created_at ? dayjs(f.created_at).format("DD/MM/YYYY hh:mm A") : ""}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{f.notes}</div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {f.followed_date && (
                                            <div className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                                                Followed: {dayjs(f.followed_date).format("DD/MM/YYYY hh:mm A")}
                                            </div>
                                        )}
                                        {f.communication_mode && (
                                            <div className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800">
                                                Mode: {String(f.communication_mode)}
                                            </div>
                                        )}
                                        {f.next_followup_date && (
                                            <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                                                Next: {dayjs(f.next_followup_date).format("DD/MM/YYYY hh:mm A")}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end border-t px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
