"use client";

import { useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function AddFollowupModal({
  open,
  onClose,
  keyword,
  onSuccess,
}) {
  const [followupDate, setFollowupDate] = useState("");
  const [page, setPage] = useState("");
  const [rank, setRank] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!followupDate) {
      return toast.error("Followup date is required.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/keywords-followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword_id: keyword.id,
          followup_date: followupDate,
          page: page.trim() || null,
          rank: rank ? parseInt(rank) : null,
          status: "pending",
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Followup added successfully!");
        setFollowupDate("");
        setPage("");
        setRank("");
        setNotes("");
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(data.message || "Failed to add followup.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Network error while adding followup.");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !keyword) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Add Followup</h2>
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
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
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
              value={page}
              onChange={(e) => setPage(e.target.value)}
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
              min="0"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder="Enter rank (e.g. 1, 50, 300)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this followup..."
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
            {loading ? "Adding..." : "Add Followup"}
          </button>
        </div>
      </div>
    </div>
  );
}
