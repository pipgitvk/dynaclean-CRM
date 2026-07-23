"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

export default function PreBookingTableView({ basePath }) {
  const [preBookings, setPreBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreBookings();
  }, []);

  const fetchPreBookings = async () => {
    setLoading(true);
    try {
      // Fetch from database directly with customer details
      const response = await fetch("/api/pre-booking-with-details");
      const data = await response.json();
      
      if (data.success) {
        setPreBookings(data.bookings || []);
      } else {
        toast.error("Failed to load pre-bookings");
      }
    } catch (error) {
      console.error("Error fetching pre-bookings:", error);
      // Fallback to regular API if new endpoint doesn't exist
      try {
        const response = await fetch("/api/pre-booking?limit=500");
        const data = await response.json();
        if (data.success) {
          setPreBookings(data.bookings || []);
        }
      } catch (e) {
        toast.error("Failed to load pre-bookings");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={40} className="animate-spin text-blue-600" />
          <p className="text-sm text-gray-600 font-medium">Loading pre-bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-amber-600 text-white">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Customer ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Customer Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Lead Source
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Product Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Item Code
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
              Qty
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Expected Date
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {preBookings.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                No pre-bookings found
              </td>
            </tr>
          ) : (
            preBookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {booking.customer_id}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <div className="font-medium">
                    {booking.first_name} {booking.last_name}
                  </div>
                  <div className="text-xs text-gray-500">{booking.company}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {booking.lead_source || "N/A"}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  {booking.product_name}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {booking.item_code || "N/A"}
                  </code>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                  {booking.quantity}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                  {booking.expected_date
                    ? dayjs(booking.expected_date).format("DD MMM YYYY")
                    : "N/A"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
        Total: <span className="font-semibold">{preBookings.length}</span> pre-bookings
      </div>
    </div>
  );
}
