"use client";
import { useState, useEffect } from "react";
import { Search, Truck, Clock, CheckCircle, AlertCircle } from "lucide-react";
import dayjs from "dayjs";

export default function DeliveryStatusTable({ orders }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState(""); // '', timely, delayed
  const [createdByFilter, setCreatedByFilter] = useState("");

  // Calculate delivery statistics
  const deliveryStats = orders.reduce(
    (acc, order) => {
      if (order.delivery_status === 1 && order.delivered_on && order.delivery_date) {
        const expectedDate = new Date(order.delivery_date);
        const actualDate = new Date(order.delivered_on);
        
        if (actualDate > expectedDate) {
          acc.delayed++;
        } else {
          acc.timely++;
        }
      }
      return acc;
    },
    { timely: 0, delayed: 0 }
  );

  // Filter orders based on search and status
  useEffect(() => {
    if (!orders) return;

    const lowercasedQuery = searchQuery.toLowerCase();
    const result = orders.filter((order) => {
      // Only show delivered orders
      if (order.delivery_status !== 1) return false;
      if (!order.delivered_on || !order.delivery_date) return false;

      // Filter by delivery status (timely/delayed)
      if (statusFilter) {
        const expectedDate = new Date(order.delivery_date);
        const actualDate = new Date(order.delivered_on);
        const isDelayed = actualDate > expectedDate;

        if (statusFilter === "delayed" && !isDelayed) return false;
        if (statusFilter === "timely" && isDelayed) return false;
      }

      // Filter by created_by
      if (createdByFilter && order.created_by !== createdByFilter) {
        return false;
      }

      // Search filter
      return (
        order.order_id?.toLowerCase().includes(lowercasedQuery) ||
        order.client_name?.toLowerCase().includes(lowercasedQuery) ||
        order.company_name?.toLowerCase().includes(lowercasedQuery) ||
        order.created_by?.toLowerCase().includes(lowercasedQuery) ||
        order.booking_by?.toLowerCase().includes(lowercasedQuery)
      );
    });

    setFilteredOrders(result);
  }, [searchQuery, orders, statusFilter, createdByFilter]);

  const getDeliveryStatus = (order) => {
    const expectedDate = new Date(order.delivery_date);
    const actualDate = new Date(order.delivered_on);
    const delayDays = Math.ceil((actualDate - expectedDate) / (1000 * 60 * 60 * 24));

    if (actualDate > expectedDate) {
      return {
        status: "Delayed",
        days: delayDays,
        bg: "bg-red-100",
        textCol: "text-red-800",
        icon: <AlertCircle size={14} className="mr-1" />,
      };
    } else {
      return {
        status: "On Time",
        days: 0,
        bg: "bg-green-100",
        textCol: "text-green-800",
        icon: <CheckCircle size={14} className="mr-1" />,
      };
    }
  };

  if (!orders || orders.length === 0) {
    return <p className="text-gray-600">No delivered orders found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Timely Delivery</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{deliveryStats.timely}</p>
            </div>
            <div className="bg-green-200 p-3 rounded-full">
              <CheckCircle size={28} className="text-green-700" />
            </div>
          </div>
        </div>

        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Delayed Delivery</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{deliveryStats.delayed}</p>
            </div>
            <div className="bg-red-200 p-3 rounded-full">
              <AlertCircle size={28} className="text-red-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by Order ID, Client, Company, etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ease-in-out"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Delivery Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Deliveries</option>
              <option value="timely">Timely Delivery</option>
              <option value="delayed">Delayed Delivery</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Created By</label>
            <select
              value={createdByFilter}
              onChange={(e) => setCreatedByFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Users</option>
              {[...new Set(orders?.map(o => o.created_by).filter(Boolean))].sort().map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] bg-white rounded-xl shadow-lg">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-gray-800 text-white sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 font-semibold text-center">#</th>
              <th className="px-3 py-3 font-semibold text-left">Order ID</th>
              <th className="px-3 py-3 font-semibold text-left">Client Details</th>
              <th className="px-3 py-3 font-semibold text-left">Created By</th>
              <th className="px-3 py-3 font-semibold text-left">Booking By</th>
              <th className="px-3 py-3 font-semibold text-center">Expected Delivery</th>
              <th className="px-3 py-3 font-semibold text-center">Actual Delivery</th>
              <th className="px-3 py-3 font-semibold text-center">Status</th>
              <th className="px-3 py-3 font-semibold text-center">Delay (Days)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order, i) => {
                const deliveryStatus = getDeliveryStatus(order);
                return (
                  <tr
                    key={order.order_id}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-3 py-3 text-center">{i + 1}</td>
                    <td className="px-3 py-3 font-medium text-gray-800">
                      {order.order_id}
                    </td>
                    <td className="px-3 py-3 text-left">
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-semibold">Client:</span> {order.client_name}
                        </div>
                        <div>
                          <span className="font-semibold">Company:</span> {order.company_name}
                        </div>
                        <div>
                          <span className="font-semibold">Contact:</span> {order.contact}
                        </div>
                        <div>
                          <span className="font-semibold">Location:</span> {order.state}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700">
                      {order.created_by || "-"}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700">
                      {order.booking_by || "-"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {order.delivery_date ? dayjs(order.delivery_date).format("DD/MM/YYYY") : "-"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {order.delivered_on ? dayjs(order.delivered_on).format("DD/MM/YYYY") : "-"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${deliveryStatus.bg} ${deliveryStatus.textCol}`}
                      >
                        {deliveryStatus.icon} {deliveryStatus.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {deliveryStatus.days > 0 ? (
                        <span className="font-semibold text-red-600">
                          +{deliveryStatus.days} days
                        </span>
                      ) : (
                        <span className="text-green-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                  No delivered orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order, i) => {
            const deliveryStatus = getDeliveryStatus(order);
            return (
              <div
                key={order.order_id}
                className="bg-white border border-gray-200 rounded-xl shadow-md p-4 space-y-3 text-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-gray-500">#{i + 1}</span>
                    <p className="font-bold text-gray-800">{order.order_id}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${deliveryStatus.bg} ${deliveryStatus.textCol}`}
                  >
                    {deliveryStatus.icon} {deliveryStatus.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <strong>Client:</strong> {order.client_name}
                  </div>
                  <div>
                    <strong>Company:</strong> {order.company_name}
                  </div>
                  <div>
                    <strong>Created By:</strong> {order.created_by || "-"}
                  </div>
                  <div>
                    <strong>Booking By:</strong> {order.booking_by || "-"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div>
                      <span className="text-xs text-gray-600">Expected:</span>
                      <p className="font-medium">
                        {order.delivery_date ? dayjs(order.delivery_date).format("DD/MM/YYYY") : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Actual:</span>
                      <p className="font-medium">
                        {order.delivered_on ? dayjs(order.delivered_on).format("DD/MM/YYYY") : "-"}
                      </p>
                    </div>
                  </div>
                  {deliveryStatus.days > 0 && (
                    <div className="bg-red-50 p-2 rounded text-center">
                      <span className="font-semibold text-red-600">
                        Delayed by {deliveryStatus.days} days
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-gray-500">No delivered orders found.</p>
        )}
      </div>
    </div>
  );
}
