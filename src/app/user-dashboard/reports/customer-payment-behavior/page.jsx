"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Download, Search, Calendar, DollarSign, AlertTriangle, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";

export default function CustomerPaymentBehaviorReport() {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [paginatedOrders, setPaginatedOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [userRole, setUserRole] = useState("");
    const [summary, setSummary] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filterStatus, setFilterStatus] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/reports/customer-payment-behavior");
            const data = await res.json();

            if (data.success) {
                setOrders(data.orders || []);
                setFilteredOrders(data.orders || []);
                setUserRole(data.userRole || "");
                setSummary(data.summary || {});
            } else {
                alert(data.error || "Failed to fetch report");
            }
        } catch (error) {
            console.error("Error fetching report:", error);
            alert("Failed to fetch customer payment behavior report");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let filtered = orders;

        if (filterStatus !== 'all') {
            if (filterStatus === 'late') {
                filtered = filtered.filter(o => o.payment_behavior === 'late_payment');
            } else if (filterStatus === 'missing') {
                filtered = filtered.filter(o =>
                    o.payment_behavior === 'missing_payment' ||
                    o.payment_behavior === 'partial_overdue'
                );
            } else if (filterStatus === 'on_time') {
                filtered = filtered.filter(o => o.payment_behavior === 'on_time');
            }
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(order =>
                order.order_id?.toLowerCase().includes(query) ||
                order.client_name?.toLowerCase().includes(query) ||
                order.company_name?.toLowerCase().includes(query) ||
                order.contact?.toLowerCase().includes(query) ||
                order.created_by?.toLowerCase().includes(query)
            );
        }

        if (sortConfig.key) {
            filtered = [...filtered].sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (['due_date', 'payment_date'].includes(sortConfig.key)) {
                    aVal = aVal ? dayjs(aVal).unix() : 0;
                    bVal = bVal ? dayjs(bVal).unix() : 0;
                } else if (['total_amount', 'paid_amount', 'remaining_amount', 'days_overdue'].includes(sortConfig.key)) {
                    aVal = parseFloat(aVal) || 0;
                    bVal = parseFloat(bVal) || 0;
                } else {
                    aVal = (aVal || '').toString().toLowerCase();
                    bVal = (bVal || '').toString().toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        setFilteredOrders(filtered);
        setCurrentPage(1);
    }, [searchQuery, orders, sortConfig, filterStatus]);

    useEffect(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        setPaginatedOrders(filteredOrders.slice(startIndex, endIndex));
    }, [filteredOrders, currentPage]);

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'asc' ?
            <ArrowUp size={14} className="inline ml-1" /> :
            <ArrowDown size={14} className="inline ml-1" />;
    };

    const getPaymentBehaviorBadge = (behavior) => {
        const badges = {
            'late_payment': { text: '🟡 Late Payment', color: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
            'missing_payment': { text: '🔴 Missing Payment', color: 'bg-red-100 text-red-800 border border-red-300' },
            'partial_overdue': { text: '🔴 Partial (Overdue)', color: 'bg-red-100 text-red-800 border border-red-300' },
            'on_time': { text: '🟢 On Time', color: 'bg-green-100 text-green-800 border border-green-300' },
            'partial_payment': { text: '🔵 Partial Payment', color: 'bg-blue-100 text-blue-800 border border-blue-300' },
            'pending': { text: '⚪ Pending', color: 'bg-gray-100 text-gray-800 border border-gray-300' },
            'paid_no_date': { text: 'Paid (No Date)', color: 'bg-gray-100 text-gray-600 border border-gray-300' },
            'no_due_date': { text: 'No Due Date', color: 'bg-gray-100 text-gray-600 border border-gray-300' },
            'paid_no_due_date': { text: 'Paid (No Due Date)', color: 'bg-gray-100 text-gray-600 border border-gray-300' },
        };
        const badge = badges[behavior] || { text: behavior, color: 'bg-gray-100 text-gray-800' };
        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                {badge.text}
            </span>
        );
    };

    const exportToCSV = () => {
        const headers = [
            "Order ID", "Customer Name", "Company", "Contact", "Employee",
            "Total Amount", "Paid Amount", "Remaining Amount",
            "Due Date", "Payment Date", "Days Overdue", "Payment Behavior"
        ];

        const csvData = filteredOrders.map(order => [
            order.order_id,
            order.client_name,
            order.company_name,
            order.contact,
            order.created_by,
            order.total_amount.toFixed(2),
            order.paid_amount.toFixed(2),
            order.remaining_amount.toFixed(2),
            order.due_date ? dayjs(order.due_date).format("DD/MM/YYYY") : "N/A",
            order.payment_date ? dayjs(order.payment_date).format("DD/MM/YYYY") : "N/A",
            order.days_overdue,
            order.payment_behavior
        ]);

        const csvContent = [
            headers.join(","),
            ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `customer-payment-behavior-${dayjs().format("YYYY-MM-DD")}.csv`;
        link.click();
    };

    const MobileCard = ({ order }) => (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <p className="font-bold text-gray-800 text-lg">{order.order_id}</p>
                    <p className="text-sm text-gray-600">{order.client_name}</p>
                    <p className="text-xs text-gray-500">{order.company_name}</p>
                </div>
                <div>
                    {getPaymentBehaviorBadge(order.payment_behavior)}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-gray-500 text-xs">Contact</p>
                    <p className="font-medium text-gray-800">{order.contact}</p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs">Employee</p>
                    <p className="font-medium text-gray-800">{order.created_by}</p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs">Total Amount</p>
                    <p className="font-bold text-gray-800">₹{order.total_amount.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs">Paid Amount</p>
                    <p className="font-bold text-green-600">₹{order.paid_amount.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs">Remaining</p>
                    <p className="font-bold text-red-600">₹{order.remaining_amount.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs">Days Overdue</p>
                    <p className="font-bold text-red-600">{order.days_overdue > 0 ? order.days_overdue : '-'}</p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs">Due Date</p>
                    <p className="font-medium text-gray-800">
                        {order.due_date ? dayjs(order.due_date).format("DD/MM/YYYY") : "N/A"}
                    </p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs">Payment Date</p>
                    <p className="font-medium text-gray-800">
                        {order.payment_date ? dayjs(order.payment_date).format("DD/MM/YYYY") : "N/A"}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-full p-3 md:p-6 overflow-hidden">
            <div className="mb-4 md:mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Customer Payment Behavior Analysis</h1>
                <p className="text-sm md:text-base text-gray-600">
                    Track customer payment patterns and identify late or missing payments
                    {userRole === "SALES" && " (Your orders only)"}
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="bg-white rounded-lg shadow p-3 md:p-4 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-gray-600">Total Orders</p>
                            <p className="text-xl md:text-2xl font-bold text-gray-800">{summary.total_orders || 0}</p>
                        </div>
                        <div className="bg-blue-100 p-2 md:p-3 rounded-full">
                            <Calendar className="text-blue-600" size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-3 md:p-4 border-l-4 border-red-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-gray-600">Overdue</p>
                            <p className="text-lg md:text-2xl font-bold text-red-600">₹{(summary.total_overdue_amount || 0).toFixed(0)}</p>
                        </div>
                        <div className="bg-red-100 p-2 md:p-3 rounded-full">
                            <DollarSign className="text-red-600" size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-3 md:p-4 border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-gray-600">Late Payments</p>
                            <p className="text-xl md:text-2xl font-bold text-yellow-600">{summary.late_payments_count || 0}</p>
                        </div>
                        <div className="bg-yellow-100 p-2 md:p-3 rounded-full">
                            <AlertTriangle className="text-yellow-600" size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-3 md:p-4 border-l-4 border-orange-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-gray-600">Missing Payments</p>
                            <p className="text-xl md:text-2xl font-bold text-orange-600">{summary.missing_payments_count || 0}</p>
                        </div>
                        <div className="bg-orange-100 p-2 md:p-3 rounded-full">
                            <AlertTriangle className="text-orange-600" size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters and Actions */}
            <div className="bg-white rounded-lg shadow p-3 md:p-4 mb-4">
                <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="flex-1 md:flex-none px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Status</option>
                            <option value="late">Late Payment</option>
                            <option value="missing">Missing Payment</option>
                            <option value="on_time">On Time</option>
                        </select>

                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 md:px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                            <Download size={16} />
                            <span className="hidden md:inline">Export CSV</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden">
                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                                <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>
                                <div className="h-3 bg-gray-300 rounded w-48 mb-4"></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="h-10 bg-gray-300 rounded"></div>
                                    <div className="h-10 bg-gray-300 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : paginatedOrders.length > 0 ? (
                    <div>
                        {paginatedOrders.map((order, index) => (
                            <MobileCard key={index} order={order} />))}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                        No orders found
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 420px)', minHeight: '600px' }}>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-800 text-white sticky top-0 z-10">
                            <tr>
                                <th
                                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('order_id')}
                                >
                                    Order ID <SortIcon columnKey="order_id" />
                                </th>
                                <th
                                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('client_name')}
                                >
                                    Customer <SortIcon columnKey="client_name" />
                                </th>
                                <th
                                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('contact')}
                                >
                                    Contact <SortIcon columnKey="contact" />
                                </th>
                                <th
                                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('created_by')}
                                >
                                    Employee <SortIcon columnKey="created_by" />
                                </th>
                                <th
                                    className="px-4 py-3 text-right font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('total_amount')}
                                >
                                    Total <SortIcon columnKey="total_amount" />
                                </th>
                                <th
                                    className="px-4 py-3 text-right font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('paid_amount')}
                                >
                                    Paid <SortIcon columnKey="paid_amount" />
                                </th>
                                <th
                                    className="px-4 py-3 text-right font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('remaining_amount')}
                                >
                                    Remaining <SortIcon columnKey="remaining_amount" />
                                </th>
                                <th
                                    className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('due_date')}
                                >
                                    Due Date <SortIcon columnKey="due_date" />
                                </th>
                                <th
                                    className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('payment_date')}
                                >
                                    Payment Date <SortIcon columnKey="payment_date" />
                                </th>
                                <th
                                    className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                                    onClick={() => handleSort('days_overdue')}
                                >
                                    Days <SortIcon columnKey="days_overdue" />
                                </th>
                                <th className="px-4 py-3 text-center font-semibold">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                Array.from({ length: 10 }).map((_, idx) => (
                                    <tr key={idx} className="animate-pulse">
                                        {Array.from({ length: 11 }).map((_, cellIdx) => (
                                            <td key={cellIdx} className="px-4 py-3">
                                                <div className="h-4 bg-gray-300 rounded"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : paginatedOrders.length > 0 ? (
                                paginatedOrders.map((order, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800">{order.order_id}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs">
                                                <div className="font-semibold text-gray-800">{order.client_name}</div>
                                                <div className="text-gray-600">{order.company_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{order.contact}</td>
                                        <td className="px-4 py-3 text-gray-700">{order.created_by}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                                            ₹{order.total_amount.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-green-600">
                                            ₹{order.paid_amount.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                                            ₹{order.remaining_amount.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-700">
                                            {order.due_date ? dayjs(order.due_date).format("DD/MM/YYYY") : "N/A"}
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-700">
                                            {order.payment_date ? dayjs(order.payment_date).format("DD/MM/YYYY") : "N/A"}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {order.days_overdue > 0 ? (
                                                <span className="text-red-600 font-semibold">{order.days_overdue}</span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getPaymentBehaviorBadge(order.payment_behavior)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                                        No orders found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {filteredOrders.length > 0 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 md:p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-600">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} entries
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                        >
                            <ChevronLeft size={16} />
                            <span className="hidden sm:inline">Previous</span>
                        </button>

                        <div className="flex gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`px-3 py-2 border rounded-lg text-sm ${currentPage === pageNum
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
