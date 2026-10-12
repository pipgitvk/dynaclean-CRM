"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  filterPaymentPendingOrders,
  sortPaymentPendingOrders,
} from "@/lib/filterPaymentPendingOrders";
import ManualFilterSearchButton, {
  MANUAL_FILTER_HINT,
} from "@/components/ui/ManualFilterSearchButton";
import dayjs from "dayjs";
import { Download, Search, Calendar, DollarSign, ArrowUp, ArrowDown } from "lucide-react";

export default function PaymentPendingReport() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [userRole, setUserRole] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reports/payment-pending");
      const data = await res.json();
      
      if (data.success) {
        setOrders(data.orders || []);
        setUserRole(data.userRole || "");
      } else {
        alert(data.error || "Failed to fetch report");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      alert("Failed to fetch payment pending report");
    } finally {
      setLoading(false);
    }
  };

  const handleApplySearch = useCallback(() => {
    setAppliedSearchQuery(searchQuery);
  }, [searchQuery]);

  const filteredOrders = useMemo(() => {
    const filtered = filterPaymentPendingOrders(orders, {
      searchQuery: appliedSearchQuery,
      dueDateFrom: "",
      dueDateTo: "",
      statusFilter: "all",
    });
    return sortPaymentPendingOrders(filtered, sortConfig);
  }, [orders, appliedSearchQuery, sortConfig]);

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

  const exportToCSV = () => {
    const headers = ["Order ID", "Customer Name", "Company", "Contact", "Employee", "Total Amount", "Paid Amount", "Remaining Amount", "Due Date"];
    const csvData = filteredOrders.map(order => [
      order.order_id,
      order.client_name,
      order.company_name,
      order.contact,
      order.created_by,
      order.total_amount.toFixed(2),
      order.paid_amount.toFixed(2),
      order.remaining_amount.toFixed(2),
      dayjs(order.due_date).format("DD/MM/YYYY")
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payment-pending-${dayjs().format("YYYY-MM-DD")}.csv`;
    link.click();
  };

  const totalPending = filteredOrders.reduce((sum, order) => sum + order.remaining_amount, 0);
  const totalAmount = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);

  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-20"></div></td>
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-32"></div></td>
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-24"></div></td>
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-24"></div></td>
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-20"></div></td>
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-16"></div></td>
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-16"></div></td>
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-20"></div></td>
    </tr>
  );

  return (
    <div className="w-full max-w-full p-6 overflow-hidden">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Pending Report</h1>
        <p className="text-gray-600">
          Track orders with pending payments
          {userRole === "SALES" && " (Your orders only)"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800">{filteredOrders.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Calendar className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-800">₹{totalAmount.toFixed(2)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Amount</p>
              <p className="text-2xl font-bold text-red-600">₹{totalPending.toFixed(2)}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <DollarSign className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by order ID, customer, company, contact, or employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplySearch();
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ManualFilterSearchButton onClick={handleApplySearch} />
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">{MANUAL_FILTER_HINT}</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-450px)]">
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
                  Total Amount <SortIcon columnKey="total_amount" />
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 10 }).map((_, idx) => <SkeletonRow key={idx} />)
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order, index) => {
                  const isOverdue = dayjs(order.due_date).isBefore(dayjs(), 'day');
                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 border-b font-medium text-gray-800">
                        {order.order_id}
                      </td>
                      <td className="px-4 py-3 border-b">
                        <div className="text-xs">
                          <div className="font-semibold text-gray-800">{order.client_name}</div>
                          <div className="text-gray-600">{order.company_name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b text-gray-700">{order.contact}</td>
                      <td className="px-4 py-3 border-b text-gray-700">{order.created_by}</td>
                      <td className="px-4 py-3 border-b text-right font-medium text-gray-800">
                        ₹{order.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 border-b text-right text-green-600">
                        ₹{order.paid_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 border-b text-right font-semibold text-red-600">
                        ₹{order.remaining_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 border-b text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {dayjs(order.due_date).format("DD/MM/YYYY")}
                          {isOverdue && " ⚠️"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No pending payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
