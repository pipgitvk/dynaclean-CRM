"use client";

import { useState, useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export default function PaymentTable({ rows, role }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortField, setSortField] = useState("created_at");
    const [sortOrder, setSortOrder] = useState("desc");
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;

    // Filter and sort data
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

        // Sort
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

    // Pagination
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

    return (
        <div className="bg-white rounded-lg shadow-md">
            {/* Filters */}
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

            {/* Desktop Table View */}
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
                                    <div className="flex gap-2">
                                        <a
                                            href={`/admin-dashboard/manual-payments/edit/${row.id}`}
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

            {/* Mobile Card View */}
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
                                    📄 View Invoice
                                </a>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2 border-t border-gray-100">
                            <a
                                href={`/admin-dashboard/manual-payments/edit/${row.id}`}
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

            {/* Pagination */}
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
        </div>
    );
}
