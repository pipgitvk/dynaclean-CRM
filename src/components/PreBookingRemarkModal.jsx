"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function PreBookingRemarkModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}) {
  const [remarkType, setRemarkType] = useState("");
  const [remarkReason, setRemarkReason] = useState("");
  const [postponedDate, setPostponedDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && booking) {
      setRemarkType(booking.remark_type || "");
      setRemarkReason(booking.remark_reason || "");
      setPostponedDate(
        booking.postponed_date
          ? new Date(booking.postponed_date).toISOString().split("T")[0]
          : "",
      );
    }
  }, [isOpen, booking]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!remarkType) {
      toast.error("Please select remark type");
      return;
    }

    if (!remarkReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    if (remarkType === "postponed" && !postponedDate) {
      toast.error("Please select a new date for postponed order");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/pre-booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: booking.id,
          remark_type: remarkType,
          remark_reason: remarkReason.trim(),
          postponed_date: remarkType === "postponed" ? postponedDate : null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          remarkType === "cancelled"
            ? "Order marked as cancelled"
            : "Order marked as postponed",
        );
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.error || "Failed to save remark");
      }
    } catch (error) {
      console.error("Error saving remark:", error);
      toast.error("Failed to save remark");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !booking) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Add Remark</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {booking.product_name} — {booking.customer_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Remark Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-red-400 has-[:checked]:bg-red-50">
                <input
                  type="radio"
                  name="remarkType"
                  value="cancelled"
                  checked={remarkType === "cancelled"}
                  onChange={(e) => setRemarkType(e.target.value)}
                  className="text-red-600"
                />
                <div>
                  <span className="font-medium text-gray-800">Order Cancelled</span>
                  <p className="text-xs text-gray-500">Mark this pre-booking as cancelled</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
                <input
                  type="radio"
                  name="remarkType"
                  value="postponed"
                  checked={remarkType === "postponed"}
                  onChange={(e) => setRemarkType(e.target.value)}
                  className="text-orange-600"
                />
                <div>
                  <span className="font-medium text-gray-800">Order Postponed</span>
                  <p className="text-xs text-gray-500">Reschedule with a new expected date</p>
                </div>
              </label>
            </div>
          </div>

          {remarkType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={remarkReason}
                onChange={(e) => setRemarkReason(e.target.value)}
                rows={3}
                placeholder="Write the reason here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                required
              />
            </div>
          )}

          {remarkType === "postponed" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Expected Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={postponedDate}
                onChange={(e) => setPostponedDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !remarkType}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Save Remark
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
