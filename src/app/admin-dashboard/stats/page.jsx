"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Truck,
    CreditCard,
    Wrench,
    Package,
    AlertCircle,
    CheckCircle,
    Clock,
    Users,
    BarChart3,
    Calendar,
    BarChart2,
    X
} from "lucide-react";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from "chart.js";
import toast from "react-hot-toast";

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function AdminStatsDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState("thisMonth");
    const [topOrdersModalOpen, setTopOrdersModalOpen] = useState(false);
    const [topOrders, setTopOrders] = useState([]);
    const [topOrdersLoading, setTopOrdersLoading] = useState(false);

    useEffect(() => {
        fetchDashboardStats();
    }, [timeRange]);

    const fetchDashboardStats = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin-dashboard-stats?timeRange=${timeRange}`);
            const data = await response.json();

            if (data.success) {
                setStats(data.data);
            } else {
                toast.error(data.error || "Failed to fetch dashboard statistics");
            }
        } catch (error) {
            toast.error("Error loading dashboard data");
            console.error("Dashboard fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTopOrders = async () => {
        setTopOrdersLoading(true);
        try {
            const res = await fetch(`/api/admin-dashboard-stats/top-orders?timeRange=${timeRange}`);
            const data = await res.json();
            if (data.success) setTopOrders(data.data || []);
            else toast.error(data.error || "Failed to load top orders");
        } catch (err) {
            toast.error("Error loading top orders");
            setTopOrders([]);
        } finally {
            setTopOrdersLoading(false);
        }
    };

    const openTopOrdersModal = (e) => {
        e.stopPropagation();
        setTopOrdersModalOpen(true);
        fetchTopOrders();
    };

    // Format currency (NaN/undefined → 0)
    const formatCurrency = (amount) => {
        const val = parseFloat(amount);
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(isNaN(val) ? 0 : val);
    };

    // KPI Card Component
    const KPICard = ({ title, value, icon: Icon, color, trend, subtitle, onClick }) => (
        <div
            className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 cursor-pointer transform hover:-translate-y-1 ${onClick ? "cursor-pointer" : ""
                }`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
                    {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-lg ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
            {trend !== undefined && (
                <div className="mt-4 flex items-center">
                    {trend >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Math.abs(trend)}% {trend >= 0 ? "increase" : "decrease"}
                    </span>
                </div>
            )}
        </div>
    );

    // Sales Trend Chart
    const salesTrendData = stats?.trends?.sales || [];
    const salesChartData = {
        labels: salesTrendData.map((d) => new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
        datasets: [
            {
                label: "Revenue (₹)",
                data: salesTrendData.map((d) => d.revenue),
                borderColor: "rgb(59, 130, 246)",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                fill: true,
                tension: 0.4,
            },
        ],
    };

    const salesChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: "Sales Trend (Last 30 Days)",
                font: { size: 16, weight: "bold" },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => "₹" + (value / 1000).toFixed(0) + "K",
                },
            },
        },
    };

    // Payment Status Doughnut Chart
    const paymentChartData = stats
        ? {
            labels: ["Paid", "Pending", "Overdue", "Partial"],
            datasets: [
                {
                    data: [
                        stats.payments.paidCount,
                        stats.payments.pendingCount,
                        stats.payments.overdueCount,
                        stats.payments.partialCount,
                    ],
                    backgroundColor: [
                        "rgba(34, 197, 94, 0.8)",
                        "rgba(59, 130, 246, 0.8)",
                        "rgba(239, 68, 68, 0.8)",
                        "rgba(251, 191, 36, 0.8)",
                    ],
                    borderWidth: 2,
                    borderColor: "#fff",
                },
            ],
        }
        : null;

    const paymentChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom",
            },
            title: {
                display: true,
                text: "Payment Status Distribution",
                font: { size: 16, weight: "bold" },
            },
        },
    };

    // Service Status Bar Chart
    const serviceChartData = stats
        ? {
            labels: ["Completed", "Pending", "Pending for spare", "Pending by customer"],
            datasets: [
                {
                    label: "Services",
                    data: [
                        stats.services.completedServices,
                        stats.services.pendingServices,
                        stats.services.pendingForSpare,
                        stats.services.pendingByCustomer,
                    ],
                    backgroundColor: [
                        "rgba(34, 197, 94, 0.8)",
                        "rgba(251, 191, 36, 0.8)",
                        "rgba(59, 130, 246, 0.8)",
                        "rgba(239, 68, 68, 0.8)",
                    ],
                },
            ],
        }
        : null;

    const serviceChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: "Service Requests Status",
                font: { size: 16, weight: "bold" },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
            },
        },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                            Admin Dashboard
                        </h1>
                        <p className="text-gray-600">System Performance Overview</p>
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex items-center gap-2 bg-white rounded-lg shadow-md p-1">
                        {[
                            { label: "Today", value: "today" },
                            { label: "This Week", value: "thisWeek" },
                            { label: "This Month", value: "thisMonth" },
                            { label: "Last Month", value: "lastMonth" },
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setTimeRange(option.value)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${timeRange === option.value
                                    ? "bg-blue-600 text-white shadow-md"
                                    : "text-gray-600 hover:bg-gray-100"
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sales Statistics */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <ShoppingCart className="w-6 h-6 mr-2 text-blue-600" />
                    Sales Statistics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="relative">
                        <KPICard
                            title="Total Orders"
                            value={stats?.sales?.totalOrders || 0}
                            icon={ShoppingCart}
                            color="bg-gradient-to-br from-blue-500 to-blue-600"
                            subtitle="New orders received"
                            onClick={() => router.push("/admin-dashboard/order")}
                        />
                        <button
                            type="button"
                            onClick={openTopOrdersModal}
                            className="absolute top-3 right-14 p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors z-10"
                            title="Top 5 orders by sales"
                            aria-label="View top 5 orders by sales"
                        >
                            <BarChart2 className="w-5 h-5" />
                        </button>
                    </div>
                    <KPICard
                        title="Total Revenue"
                        value={formatCurrency(stats?.sales?.totalRevenue)}
                        icon={DollarSign}
                        color="bg-gradient-to-br from-green-500 to-green-600"
                        subtitle={
                            (stats?.sales?.totalGst != null || stats?.sales?.totalTax != null)
                                ? (() => {
                                    const totalRev = parseFloat(stats?.sales?.totalRevenue) || 0;
                                    const taxGst = (parseFloat(stats?.sales?.totalGst) || 0) + (parseFloat(stats?.sales?.totalTax) || 0);
                                    const base = Math.max(0, totalRev - taxGst);
                                    return `Base ${formatCurrency(base)} | Tax ${formatCurrency(taxGst)}`;
                                })()
                                : "Order total (totalamt)"
                        }
                        onClick={() => router.push("/admin-dashboard/order")}
                    />
                    <KPICard
                        title="Conversion Rate"
                        value={`${stats?.sales?.conversionRate || 0}%`}
                        icon={TrendingUp}
                        color="bg-gradient-to-br from-purple-500 to-purple-600"
                        subtitle="Quotation to order"
                        onClick={() => router.push("/admin-dashboard/quotations")}
                    />
                    <KPICard
                        title="Active Salespeople"
                        value={stats?.sales?.activeSalespeople || 0}
                        icon={Users}
                        color="bg-gradient-to-br from-indigo-500 to-indigo-600"
                        subtitle="Team members"
                        onClick={() => router.push("/admin-dashboard/assign-targets")}
                    />
                </div>
            </div>

            {/* Delivery Performance */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Truck className="w-6 h-6 mr-2 text-orange-600" />
                    Delivery Performance
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <KPICard
                        title="Total Deliveries"
                        value={stats?.delivery?.totalDeliveries || 0}
                        icon={Package}
                        color="bg-gradient-to-br from-gray-500 to-gray-600"
                        onClick={() => router.push("/admin-dashboard/order/delivery-status")}
                    />
                    <KPICard
                        title="Completed"
                        value={stats?.delivery?.completedDeliveries || 0}
                        icon={CheckCircle}
                        color="bg-gradient-to-br from-green-500 to-green-600"
                        onClick={() => router.push("/admin-dashboard/order/delivery-status")}
                    />
                    <KPICard
                        title="On-Time Rate"
                        value={`${stats?.delivery?.onTimeRate || 0}%`}
                        icon={Clock}
                        color="bg-gradient-to-br from-blue-500 to-blue-600"
                        onClick={() => router.push("/admin-dashboard/order/delivery-status")}
                    />
                    <KPICard
                        title="Delayed"
                        value={stats?.delivery?.delayedDeliveries || 0}
                        icon={AlertCircle}
                        color="bg-gradient-to-br from-red-500 to-red-600"
                        onClick={() => router.push("/admin-dashboard/order/delivery-status")}
                    />
                    <KPICard
                        title="Pending"
                        value={stats?.delivery?.pendingDeliveries || 0}
                        icon={Clock}
                        color="bg-gradient-to-br from-yellow-500 to-yellow-600"
                        onClick={() => router.push("/admin-dashboard/order/delivery-status")}
                    />
                </div>
            </div>

            {/* Payment Status */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <CreditCard className="w-6 h-6 mr-2 text-green-600" />
                    Payment Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard
                        title="Pending Payments"
                        value={stats?.payments?.pendingCount || 0}
                        icon={Clock}
                        color="bg-gradient-to-br from-yellow-500 to-yellow-600"
                        subtitle={formatCurrency(stats?.payments?.totalPendingAmount)}
                        onClick={() => router.push("/admin-dashboard/manual-payments")}
                    />
                    <KPICard
                        title="Overdue Payments"
                        value={stats?.payments?.overdueCount || 0}
                        icon={AlertCircle}
                        color="bg-gradient-to-br from-red-500 to-red-600"
                        subtitle={formatCurrency(stats?.payments?.overdueAmount)}
                        onClick={() => router.push("/admin-dashboard/manual-payments")}
                    />
                    <KPICard
                        title="Partially Paid"
                        value={stats?.payments?.partialCount || 0}
                        icon={CreditCard}
                        color="bg-gradient-to-br from-orange-500 to-orange-600"
                        onClick={() => router.push("/admin-dashboard/manual-payments")}
                    />
                    <KPICard
                        title="Paid Orders"
                        value={stats?.payments?.paidCount || 0}
                        icon={CheckCircle}
                        color="bg-gradient-to-br from-green-500 to-green-600"
                        onClick={() => router.push("/admin-dashboard/manual-payments")}
                    />
                </div>
            </div>

            {/* Service Statistics */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Wrench className="w-6 h-6 mr-2 text-purple-600" />
                    Service Statistics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard
                        title="Total Services"
                        value={stats?.services?.totalServices || 0}
                        icon={Wrench}
                        color="bg-gradient-to-br from-purple-500 to-purple-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports")}
                    />
                    <KPICard
                        title="Completed"
                        value={stats?.services?.completedServices || 0}
                        icon={CheckCircle}
                        color="bg-gradient-to-br from-green-500 to-green-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports")}
                    />
                    <KPICard
                        title="Pending"
                        value={stats?.services?.pendingServices || 0}
                        icon={Clock}
                        color="bg-gradient-to-br from-yellow-500 to-yellow-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports")}
                    />
                    <KPICard
                        title="Avg. Completion"
                        value={`${stats?.services?.avgCompletionDays || 0} days`}
                        icon={Calendar}
                        color="bg-gradient-to-br from-blue-500 to-blue-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports")}
                    />
                </div>
            </div>

            {/* Installation Statistics */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Package className="w-6 h-6 mr-2 text-teal-600" />
                    Installation Statistics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <KPICard
                        title="Total Installations"
                        value={stats?.installations?.totalInstallations || 0}
                        icon={Package}
                        color="bg-gradient-to-br from-teal-500 to-teal-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports/upcoming-installation")}
                    />
                    <KPICard
                        title="Completed"
                        value={stats?.installations?.completedInstallations || 0}
                        icon={CheckCircle}
                        color="bg-gradient-to-br from-green-500 to-green-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports/upcoming-installation")}
                    />
                    <KPICard
                        title="Upcoming (10 days)"
                        value={stats?.installations?.upcomingInstallations || 0}
                        icon={Clock}
                        color="bg-gradient-to-br from-blue-500 to-blue-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports/upcoming-installation")}
                    />
                    <KPICard
                        title="Pending"
                        value={stats?.installations?.pendingInstallations || 0}
                        icon={AlertCircle}
                        color="bg-gradient-to-br from-yellow-500 to-yellow-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports/upcoming-installation")}
                    />
                    <KPICard
                        title="Overdue"
                        value={stats?.installations?.overdueInstallations || 0}
                        icon={AlertCircle}
                        color="bg-gradient-to-br from-red-500 to-red-600"
                        onClick={() => router.push("/admin-dashboard/view_service_reports/upcoming-installation")}
                    />
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Sales Trend Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
                    <div className="h-80">
                        {salesTrendData.length > 0 ? (
                            <Line data={salesChartData} options={salesChartOptions} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                No sales data available
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Status Doughnut */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="h-80">
                        {paymentChartData ? (
                            <Doughnut data={paymentChartData} options={paymentChartOptions} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                No payment data available
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Service Status Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="h-80">
                        {serviceChartData ? (
                            <Bar data={serviceChartData} options={serviceChartOptions} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                No service data available
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Performers */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Sales Performers</h3>
                    <div className="space-y-3">
                        {stats?.sales?.topPerformers?.length > 0 ? (
                            stats.sales.topPerformers.map((performer, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{performer.salesperson}</p>
                                            <p className="text-sm text-gray-500">{performer.orders_count} orders</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-green-600">{formatCurrency(performer.revenue)}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-8">No sales data available</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Top 5 Orders by Sales - Modal */}
            {topOrdersModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    onClick={() => setTopOrdersModalOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="top-orders-title"
                >
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h2 id="top-orders-title" className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                <BarChart2 className="w-6 h-6 text-blue-600" />
                                Top 5 Orders by Sales
                            </h2>
                            <button
                                type="button"
                                onClick={() => setTopOrdersModalOpen(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto flex-1">
                            {topOrdersLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                                </div>
                            ) : topOrders.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No orders in this period.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 text-left text-gray-600">
                                                <th className="pb-2 pr-2">#</th>
                                                <th className="pb-2 pr-2">Order ID</th>
                                                <th className="pb-2 pr-2">Client</th>
                                                <th className="pb-2 pr-2">Company</th>
                                                <th className="pb-2 pr-2 text-right">Amount</th>
                                                <th className="pb-2">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topOrders.map((order, idx) => (
                                                <tr key={order.order_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    <td className="py-3 pr-2 font-medium text-gray-700">{idx + 1}</td>
                                                    <td className="py-3 pr-2">{order.order_id}</td>
                                                    <td className="py-3 pr-2">{order.client_name || "—"}</td>
                                                    <td className="py-3 pr-2">{order.company_name || "—"}</td>
                                                    <td className="py-3 pr-2 text-right font-medium text-green-700">
                                                        {formatCurrency(order.totalamt)}
                                                    </td>
                                                    <td className="py-3">
                                                        <a
                                                            href={`/admin-dashboard/order/view/${order.order_id}`}
                                                            className="text-blue-600 hover:underline font-medium"
                                                        >
                                                            View
                                                        </a>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setTopOrdersModalOpen(false)}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
