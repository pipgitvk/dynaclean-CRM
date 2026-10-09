"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function EditFollowupModal({
  open,
  onClose,
  followup,
  onSuccess,
}) {
  const [formData, setFormData] = useState({
    followup_date: "",
    page: "",
    rank: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (followup) {
      setFormData({
        followup_date: followup.followup_date || "",
        page: followup.page || "",
        rank: followup.rank || "",
      });
    }
  }, [followup]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async () => {
    if (!formData.followup_date) {
      return toast.error("Followup date is required.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/keywords-followups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: followup.id,
          followup_date: formData.followup_date,
          page: formData.page.trim() || null,
          rank: formData.rank ? parseInt(formData.rank) : null,
          status: "pending",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Followup updated successfully!");
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(data.message || "Failed to update followup.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Network error while updating followup.");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !followup) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Edit Followup</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Followup Date Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Followup Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="followup_date"
              value={formData.followup_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Page Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page
            </label>
            <input
              type="text"
              name="page"
              value={formData.page}
              onChange={handleChange}
              placeholder="Enter page"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Rank Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rank
            </label>
            <input
              type="number"
              name="rank"
              min="0"
              value={formData.rank}
              onChange={handleChange}
              placeholder="Enter rank (e.g. 1, 50, 300)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Followup"}
          </button>
        </div>
      </div>
    </div>
  );
}
