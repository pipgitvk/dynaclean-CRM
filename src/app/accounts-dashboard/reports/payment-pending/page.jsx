"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Download, Search, Calendar, DollarSign, ArrowUp, ArrowDown, X, History, Tag } from "lucide-react";
import toast from "react-hot-toast";

export default function PaymentPendingReport() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userRole, setUserRole] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // History modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyOrder, setHistoryOrder] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [deductionHistoryData, setDeductionHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Deduction modal state
  const [isDeductionOpen, setIsDeductionOpen] = useState(false);
  const [deductionOrder, setDeductionOrder] = useState(null);
  const [deductionForm, setDeductionForm] = useState({
    deduction_type: "",
    remarks: ""
  });
  const [isDeductionSubmitting, setIsDeductionSubmitting] = useState(false);

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
        setFilteredOrders(data.orders || []);
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

  useEffect(() => {
    let filtered = orders;
    
    // Apply search filter
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

    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle date sorting
        if (sortConfig.key === 'due_date') {
          aVal = dayjs(aVal).unix();
          bVal = dayjs(bVal).unix();
        }
        // Handle numeric sorting
        else if (['total_amount', 'paid_amount', 'remaining_amount'].includes(sortConfig.key)) {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }
        // Handle string sorting
        else {
          aVal = (aVal || '').toString().toLowerCase();
          bVal = (bVal || '').toString().toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredOrders(filtered);
  }, [searchQuery, orders, sortConfig]);

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

  const handleOpenHistory = async (order) => {
    setHistoryOrder(order);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryData([]);
    setDeductionHistoryData([]);
    try {
      // Fetch follow-up history
      const res1 = await fetch(`/api/followup/${order.customer_id}`);
      const data1 = await res1.json();
      if (data1.success) {
        setHistoryData(data1.history || []);
      }

      // Fetch deduction history
      const res2 = await fetch(`/api/payment-deduction/${order.order_id}`);
      const data2 = await res2.json();
      if (data2.success) {
        setDeductionHistoryData(data2.deductions || []);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Error loading history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistory = () => {
    setIsHistoryOpen(false);
    setHistoryOrder(null);
    setHistoryData([]);
    setDeductionHistoryData([]);
  };

  const handleOpenDeduction = (order) => {
    setDeductionOrder(order);
    setDeductionForm({
      deduction_type: "",
      remarks: ""
    });
    setIsDeductionOpen(true);
  };

  const handleCloseDeduction = () => {
    setIsDeductionOpen(false);
    setDeductionOrder(null);
    setDeductionForm({
      deduction_type: "",
      remarks: ""
    });
  };

  const handleDeductionChange = (e) => {
    setDeductionForm({ ...deductionForm, [e.target.name]: e.target.value });
  };

  const handleDeductionSubmit = async (e) => {
    e.preventDefault();
    if (!deductionForm.deduction_type.trim()) {
      toast.error("Please select a deduction type");
      return;
    }
    if (!deductionForm.remarks.trim()) {
      toast.error("Please add remarks");
      return;
    }

    setIsDeductionSubmitting(true);
    try {
      const res = await fetch("/api/payment-deduction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: deductionOrder.order_id,
          deduction_type: deductionForm.deduction_type,
          remarks: deductionForm.remarks,
          amount: deductionOrder.remaining_amount
        })
      });

      if (res.ok) {
        toast.success("Deduction recorded successfully!");
        handleCloseDeduction();
      } else {
        toast.error("Failed to save deduction");
      }
    } catch {
      toast.error("Error saving deduction");
    } finally {
      setIsDeductionSubmitting(false);
    }
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
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-16"></div></td>
      <td className="px-4 py-3 border-b"><div className="h-4 bg-gray-300 rounded w-24"></div></td>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
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
                <th className="px-4 py-3 text-center font-semibold">
                  Tag
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  Actions
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
                      <td className="px-4 py-3 border-b text-center">
                        {order.latest_deduction ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            order.latest_deduction === "LD" ? "bg-blue-100 text-blue-700" :
                            order.latest_deduction === "SD" ? "bg-green-100 text-green-700" :
                            order.latest_deduction === "TDS" ? "bg-purple-100 text-purple-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {order.latest_deduction}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenHistory(order)}
                            disabled={!order.customer_id}
                            title="View Follow-up History"
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                              order.customer_id
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <History size={12} />
                            History
                          </button>
                          <button
                            onClick={() => handleOpenDeduction(order)}
                            title="Add Deduction"
                            className="px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            <Tag size={12} />
                            Deduction
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    No pending payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Modal */}
      {isHistoryOpen && historyOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <History size={20} className="text-purple-600" />
                  Follow-up History
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {historyOrder.client_name} — {historyOrder.order_id}
                </p>
              </div>
              <button
                onClick={handleCloseHistory}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-gray-500">Loading history...</span>
                </div>
              ) : historyData.length === 0 && deductionHistoryData.length === 0 ? (
                <div className="text-center py-12 text-gray-400 italic">
                  No history found for this order.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Follow-up History Section */}
                  {historyData.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-300">
                        Follow-up History ({historyData.length})
                      </h3>
                      <div className="space-y-3">
                        {historyData.map((item, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-blue-50 hover:bg-blue-100 transition-colors">
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.comm_mode === "Call" ? "bg-blue-100 text-blue-700" :
                                  item.comm_mode === "WhatsApp" ? "bg-green-100 text-green-700" :
                                  item.comm_mode === "Visit" ? "bg-orange-100 text-orange-700" :
                                  item.comm_mode === "Email" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {item.comm_mode || "—"}
                                </span>
                                <span className="text-xs text-gray-600">
                                  by <span className="font-medium">{item.followed_by || "Unknown"}</span>
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {dayjs(item.followed_date).format("DD MMM YYYY, hh:mm A")}
                              </div>
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed">
                              {item.notes || <span className="italic text-gray-400">No notes</span>}
                            </p>
                            <div className="mt-2 text-xs text-gray-600">
                              Next follow-up:{" "}
                              <span className="font-medium">
                                {item.next_followup_date
                                  ? dayjs(item.next_followup_date).format("DD MMM YYYY, hh:mm A")
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deduction History Section */}
                  {deductionHistoryData.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-300">
                        Deduction History ({deductionHistoryData.length})
                      </h3>
                      <div className="space-y-3">
                        {deductionHistoryData.map((item, idx) => (
                          <div key={idx} className="border border-orange-200 rounded-lg p-4 bg-orange-50 hover:bg-orange-100 transition-colors">
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-200 text-orange-800">
                                  {item.deduction_type}
                                </span>
                                <span className="text-xs text-gray-600">
                                  by <span className="font-medium">{item.recorded_by || "Unknown"}</span>
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {dayjs(item.recorded_date).format("DD MMM YYYY, hh:mm A")}
                              </div>
                            </div>
                            <div className="mb-2">
                              <span className="text-xs text-gray-600">Amount: </span>
                              <span className="text-sm font-semibold text-orange-700">
                                ₹{item.amount ? parseFloat(item.amount).toFixed(2) : "0.00"}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed">
                              {item.remarks || <span className="italic text-gray-400">No remarks</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 flex-shrink-0 rounded-b-lg">
              <span className="text-xs text-gray-500">
                {historyData.length + deductionHistoryData.length} record{historyData.length + deductionHistoryData.length !== 1 ? "s" : ""} found
              </span>
              <button
                onClick={handleCloseHistory}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction Modal */}
      {isDeductionOpen && deductionOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Tag size={20} className="text-orange-600" />
                Record Deduction
              </h2>
              <button
                onClick={handleCloseDeduction}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleDeductionSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Order:</strong> {deductionOrder.order_id} — {deductionOrder.client_name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Amount:</strong> ₹{deductionOrder.remaining_amount.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deduction Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="deduction_type"
                  value={deductionForm.deduction_type}
                  onChange={handleDeductionChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Select deduction type</option>
                  <option value="LD">LD - Late Deduction</option>
                  <option value="SD">SD - Standard Deduction</option>
                  <option value="TDS">TDS - Tax Deducted at Source</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="remarks"
                  rows={4}
                  value={deductionForm.remarks}
                  onChange={handleDeductionChange}
                  placeholder="Enter deduction remarks..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseDeduction}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeductionSubmitting}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${
                    isDeductionSubmitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-orange-600 hover:bg-orange-700"
                  }`}
                >
                  {isDeductionSubmitting ? "Saving..." : "Save Deduction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
