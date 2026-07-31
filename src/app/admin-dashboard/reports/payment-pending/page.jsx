"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Download, Search, Calendar, DollarSign, ArrowUp, ArrowDown, Trash2, X, PhoneCall, History, Loader2 } from "lucide-react";

export default function PaymentPendingReport() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userRole, setUserRole] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [deletingAll, setDeletingAll] = useState(false);
  const [totalOrdersCardClicks, setTotalOrdersCardClicks] = useState(0);
  
  // New filter states
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, due, no-due
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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

    // Apply due date range filter
    if (dueDateFrom) {
      filtered = filtered.filter(order =>
        dayjs(order.due_date).isAfter(dayjs(dueDateFrom).subtract(1, 'day'), 'day')
      );
    }
    if (dueDateTo) {
      filtered = filtered.filter(order =>
        dayjs(order.due_date).isBefore(dayjs(dueDateTo).add(1, 'day'), 'day')
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      const today = dayjs().startOf('day');
      if (statusFilter === "due") {
        // Due: due_date has passed (is before today)
        filtered = filtered.filter(order =>
          dayjs(order.due_date).isBefore(today, 'day')
        );
      } else if (statusFilter === "no-due") {
        // No Due: due_date is in future (is same or after today)
        filtered = filtered.filter(order => {
          const orderDate = dayjs(order.due_date).startOf('day');
          return !orderDate.isBefore(today, 'day');
        });
      }
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle date sorting
        if (sortConfig.key === 'due_date' || sortConfig.key === 'next_followup_date') {
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
  }, [searchQuery, orders, sortConfig, dueDateFrom, dueDateTo, statusFilter]);

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
    const headers = ["Order ID", "Customer Name", "Company", "Contact", "Employee", "Total Amount", "Paid Amount", "Remaining Amount", "Due Date", "Tag", "Next Followup"];
    const csvData = filteredOrders.map(order => [
      order.order_id,
      order.client_name,
      order.company_name,
      order.contact,
      order.created_by,
      order.total_amount.toFixed(2),
      order.paid_amount.toFixed(2),
      order.remaining_amount.toFixed(2),
      dayjs(order.due_date).format("DD/MM/YYYY"),
      order.latest_deduction || "",
      order.next_followup_date ? dayjs(order.next_followup_date).format("DD/MM/YYYY hh:mm A") : ""
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

  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      "Delete all database data? This action cannot be undone."
    );
    if (!confirmed) return;

    const confirmText = window.prompt('Type "DELETE ALL" to confirm full database deletion.');
    if (confirmText !== "DELETE ALL") {
      alert("Delete cancelled. Confirmation text did not match.");
      return;
    }

    try {
      setDeletingAll(true);
      const res = await fetch("/api/admin/nuke-database", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmText }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete data");
      }

      alert("All data deleted successfully.");
      setOrders([]);
      setFilteredOrders([]);
    } catch (error) {
      console.error("Error deleting all data:", error);
      alert(error.message || "Failed to delete all data");
    } finally {
      setDeletingAll(false);
    }
  };

  const handleTotalOrdersCardClick = () => {
    setTotalOrdersCardClicks((clicks) => Math.min(clicks + 1, 8));
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
      <td className="px-4 py-3 border-b"><div className="h-8 bg-gray-300 rounded w-28"></div></td>
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
        <div
          className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500"
          onClick={handleTotalOrdersCardClick}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800">{filteredOrders.length}</p>
              {totalOrdersCardClicks >= 8 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteAllData();
                  }}
                  disabled={deletingAll}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  {deletingAll ? "Deleting..." : "Delete All Data"}
                </button>
              )}
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
        <div className="space-y-4">
          {/* Search and Export Row */}
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
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap"
            >
              <Download size={18} />
              Export CSV
            </button>
          </div>

          {/* Date Range and Status Filters Row */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Due Date From */}
            <div className="flex flex-col w-full md:w-auto">
              <label className="text-xs font-semibold text-gray-700 mb-1">Due Date From</label>
              <input
                type="date"
                value={dueDateFrom}
                onChange={(e) => setDueDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Due Date To */}
            <div className="flex flex-col w-full md:w-auto">
              <label className="text-xs font-semibold text-gray-700 mb-1">Due Date To</label>
              <input
                type="date"
                value={dueDateTo}
                onChange={(e) => setDueDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex flex-col w-full md:w-auto">
              <label className="text-xs font-semibold text-gray-700 mb-1">Payment Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Orders</option>
                <option value="due">Due (Overdue)</option>
                <option value="no-due">Not Due</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(dueDateFrom || dueDateTo || statusFilter !== "all" || searchQuery) && (
              <button
                onClick={() => {
                  setDueDateFrom("");
                  setDueDateTo("");
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap mt-5 md:mt-0"
              >
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>
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
                <th
                  className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => handleSort('latest_deduction')}
                >
                  Tag <SortIcon columnKey="latest_deduction" />
                </th>
                <th
                  className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => handleSort('next_followup_date')}
                >
                  Next Followup <SortIcon columnKey="next_followup_date" />
                </th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
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
                      <td className="px-4 py-3 border-b text-center text-gray-700">
                        {order.next_followup_date
                          ? dayjs(order.next_followup_date).format("DD/MM/YYYY hh:mm A")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 border-b">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(order);
                              setFollowupModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <PhoneCall size={14} />
                            Followup
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(order);
                              setHistoryModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                          >
                            <History size={14} />
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                    No pending payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FollowupModal
        open={followupModalOpen}
        onClose={() => {
          setFollowupModalOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onSaved={() => {
          setFollowupModalOpen(false);
          setSelectedOrder(null);
        }}
      />

      <HistoryModal
        open={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
      />
    </div>
  );
}

function FollowupModal({ open, onClose, order, onSaved }) {
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
  }, [open, order?.order_id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-bold text-gray-900">Add Followup</div>
            <div className="text-xs text-gray-600">
              {order?.order_id ? `Order: ${order.order_id}` : ""}
              {order?.client_name ? ` | ${order.client_name}` : ""}
              {order?.company_name ? ` | ${order.company_name}` : ""}
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
                Pending Amount
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-red-600">
                ₹{Number(order?.remaining_amount || 0).toFixed(2)}
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
              if (!order?.order_id) return;
              if (!notes.trim()) {
                alert("Notes required");
                return;
              }
              try {
                setSubmitting(true);
                const res = await fetch("/api/reports/payment-pending/followups", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    order_id: order.order_id,
                    customer_id: order.customer_id || null,
                    client_name: order.client_name || null,
                    company_name: order.company_name || null,
                    contact: order.contact || null,
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

function HistoryModal({ open, onClose, order }) {
  const [loading, setLoading] = useState(false);
  const [followups, setFollowups] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !order?.order_id) return;
    let cancelled = false;

    async function run() {
      try {
        setError("");
        setLoading(true);
        const res = await fetch(
          `/api/reports/payment-pending/followups?order_id=${encodeURIComponent(order.order_id)}`,
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
  }, [open, order?.order_id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-bold text-gray-900">Followup History</div>
            <div className="text-xs text-gray-600">
              {order?.order_id ? `Order: ${order.order_id}` : ""}
              {order?.client_name ? ` | ${order.client_name}` : ""}
              {order?.company_name ? ` | ${order.company_name}` : ""}
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
