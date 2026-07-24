"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

export default function PreBookingListClient({
  preBookings,
  total,
  currentPage,
  pageSize,
  search: initialSearch,
  modelFilter: initialModelFilter,
  leadSourceFilter: initialLeadSourceFilter,
  expectedDateFrom: initialExpectedDateFrom,
  expectedDateTo: initialExpectedDateTo,
  leadSources,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialSearch);
  const [modelFilter, setModelFilter] = useState(initialModelFilter);
  const [leadSourceFilter, setLeadSourceFilter] = useState(initialLeadSourceFilter);
  const [expectedDateFrom, setExpectedDateFrom] = useState(initialExpectedDateFrom);
  const [expectedDateTo, setExpectedDateTo] = useState(initialExpectedDateTo);
  const [showFilters, setShowFilters] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (modelFilter) params.set("modelFilter", modelFilter);
    if (leadSourceFilter) params.set("leadSourceFilter", leadSourceFilter);
    if (expectedDateFrom) params.set("expectedDateFrom", expectedDateFrom);
    if (expectedDateTo) params.set("expectedDateTo", expectedDateTo);
    params.set("page", "1");

    router.push(`/admin-dashboard/tl-customers/pre-booking?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch("");
    setModelFilter("");
    setLeadSourceFilter("");
    setExpectedDateFrom("");
    setExpectedDateTo("");
    router.push("/admin-dashboard/tl-customers/pre-booking");
  };

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    router.push(`/admin-dashboard/tl-customers/pre-booking?${params.toString()}`);
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      setUpdatingId(bookingId);
      const response = await fetch("/api/pre-booking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookingId, status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Status updated to ${newStatus}`);
        // Refresh the page to show updated status
        router.refresh();
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const hasActiveFilters = search || modelFilter || leadSourceFilter || expectedDateFrom || expectedDateTo;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Pre-Bookings</h1>
        <p className="text-gray-600">
          Total: <span className="font-semibold text-blue-600">{total}</span> pre-bookings
        </p>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by Customer ID, Name, Email, Phone, or Product..."
              value={search}
              onChange={handleSearch}
              onKeyPress={(e) => e.key === "Enter" && applyFilters()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={applyFilters}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Search
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              showFilters
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Filter size={18} />
            Filters
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            {/* Lead Source Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lead Source
              </label>
              <select
                value={leadSourceFilter}
                onChange={(e) => setLeadSourceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Lead Sources</option>
                {leadSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            {/* Expected Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={expectedDateFrom}
                onChange={(e) => setExpectedDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Expected Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={expectedDateTo}
                onChange={(e) => setExpectedDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Apply Button */}
            <div className="flex items-end">
              <button
                onClick={applyFilters}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {preBookings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No pre-bookings found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Customer ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Lead Source
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Item Code
                    </th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Expected Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Received Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {booking.customer_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="font-medium">
                          {booking.first_name} {booking.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{booking.company}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {booking.lead_source || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {booking.product_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {booking.item_code || "N/A"}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-sm text-center font-semibold text-gray-900">
                        {booking.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {booking.expected_date
                          ? dayjs(booking.expected_date).format("DD MMM YYYY")
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded text-sm font-medium border-2 ${
                          (booking.status || 'pending') === 'pending'
                            ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                            : (booking.status || 'pending') === 'partial'
                            ? 'bg-orange-100 border-orange-400 text-orange-800'
                            : 'bg-green-100 border-green-400 text-green-800'
                        }`}>
                          {(booking.status || 'pending').charAt(0).toUpperCase() + (booking.status || 'pending').slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {booking.order_id ? (
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {booking.order_id}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {booking.received_date
                          ? dayjs(booking.received_date).format("DD MMM YYYY")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Page <span className="font-semibold">{currentPage}</span> of{" "}
                  <span className="font-semibold">{totalPages}</span> (
                  <span className="font-semibold">{total}</span> total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
