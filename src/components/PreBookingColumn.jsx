"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import dayjs from "dayjs";

export default function PreBookingColumn({ customerId }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Fetch data on component mount
    if (!hasChecked) {
      fetchBookings();
    }
  }, [customerId]);

  const fetchBookings = async () => {
    if (!customerId || hasChecked) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/pre-booking-by-customer?customer_id=${encodeURIComponent(customerId)}`
      );
      const data = await response.json();

      if (data.success) {
        setBookings(data.bookings || []);
        setHasChecked(true);
      }
    } catch (error) {
      console.error("Error fetching pre-bookings:", error);
      setBookings([]);
      setHasChecked(true);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total quantity
  const totalQuantity = bookings.reduce((sum, b) => sum + (b.quantity || 0), 0);

  // Show circle if we have bookings or if we've checked and found none
  if (totalQuantity === 0 && hasChecked) {
    return (
      <span className="text-gray-400 text-sm">-</span>
    );
  }

  return (
    <div className="relative inline-block">
      {/* Circle with Quantity - always show if bookings exist or loading */}
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold flex items-center justify-center hover:shadow-lg transition-shadow duration-200 cursor-pointer"
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <span className="text-sm">{totalQuantity || "0"}</span>
        )}
      </button>

      {/* Hover Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white rounded-lg shadow-xl z-50 min-w-max">
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>

          {/* Content */}
          <div className="px-4 py-3">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Loading...</span>
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-gray-300">No pre-bookings</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="text-xs">
                    <div className="font-semibold text-purple-300">
                      {booking.product_name}
                    </div>
                    <div className="text-gray-300">
                      Qty: <span className="font-medium">{booking.quantity}</span>
                    </div>
                    {booking.expected_date && (
                      <div className="text-gray-300">
                        Expected:{" "}
                        <span className="font-medium">
                          {dayjs(booking.expected_date).format("DD/MM/YYYY")}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
