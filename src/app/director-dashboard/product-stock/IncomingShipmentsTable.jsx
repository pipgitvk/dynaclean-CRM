"use client";

import { useState, useMemo } from "react";
import { Search, Edit, Trash2, Eye } from "lucide-react";

export default function IncomingShipmentsTable({
  shipments = [],
  onEdit,
  onDelete,
  onView,
  loading = false
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [sortBy, setSortBy] = useState("created_at");

  const statusOptions = [
    "Order Preparing",
    "Paid",
    "Sailed",
    "Arrived at Port",
    "Rail Out",
    "Delivered"
  ];

  const statusColors = {
    "Order Preparing": "bg-blue-100 text-blue-800",
    "Paid": "bg-purple-100 text-purple-800",
    "Sailed": "bg-cyan-100 text-cyan-800",
    "Arrived at Port": "bg-yellow-100 text-yellow-800",
    "Rail Out": "bg-orange-100 text-orange-800",
    "Delivered": "bg-green-100 text-green-800"
  };

  // Filter and sort shipments
  const filteredShipments = useMemo(() => {
    let filtered = Array.isArray(shipments) ? [...shipments] : [];

    // Apply search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(ship =>
        (ship.shipment_id || "").toLowerCase().includes(lowerSearch) ||
        (ship.supplier_name || "").toLowerCase().includes(lowerSearch) ||
        (ship.item_name || "").toLowerCase().includes(lowerSearch) ||
        (ship.product_code || "").toLowerCase().includes(lowerSearch) ||
        (ship.transporter_name || "").toLowerCase().includes(lowerSearch)
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(ship => ship.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === "created_at") {
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (sortBy === "expected_arrival_date") {
        if (!a.expected_arrival_date || !b.expected_arrival_date) return 0;
        return new Date(a.expected_arrival_date) - new Date(b.expected_arrival_date);
      }
      return 0;
    });

    return filtered;
  }, [shipments, searchTerm, statusFilter, sortBy]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const handleDeleteClick = (shipment) => {
    if (window.confirm(`Delete shipment ${shipment.shipment_id}?`)) {
      onDelete(shipment.id);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with Search and Filters */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Incoming Shipments</h2>

        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by Shipment ID, Supplier, Item Name, or Transporter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Status Filter */}
            <select
              value={statusFilter || ""}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_at">Latest First</option>
              <option value="expected_arrival_date">Expected Arrival Date</option>
            </select>

            {/* Results Count */}
            <div className="text-sm text-gray-600 ml-auto">
              Showing {filteredShipments.length} of {shipments.length} shipments
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-500">Loading shipments...</div>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-500">No shipments found</div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shipment ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product / Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transporter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected Arrival
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredShipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {shipment.shipment_id}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {shipment.item_name || "—"}
                    </div>
                    {shipment.product_code && (
                      <div className="text-xs text-gray-500">
                        Code: {shipment.product_code}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {shipment.qty}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">
                      {shipment.supplier_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">
                      {shipment.transporter_name || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">
                      {formatDate(shipment.expected_arrival_date)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[shipment.status] || "bg-gray-100 text-gray-800"}`}>
                      {shipment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onView && onView(shipment)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => onEdit && onEdit(shipment)}
                        className="p-1 text-amber-600 hover:bg-amber-100 rounded transition-colors"
                        title="Edit shipment"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with summary */}
      {filteredShipments.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>
              Total Quantity: <span className="font-semibold text-gray-900">{filteredShipments.reduce((sum, s) => sum + (s.qty || 0), 0)}</span>
            </span>
            <span>
              {statusFilter && `Status: ${statusFilter}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
