"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function FollowKeywordModal({
  open,
  onClose,
  keyword,
  onSuccess,
}) {
  const [currentDate, setCurrentDate] = useState("");
  const [rank, setRank] = useState("");
  const [page, setPage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && keyword) {
      // Set current date to today (non-editable)
      const today = new Date().toISOString().split("T")[0];
      setCurrentDate(today);
      setRank("");
      // Auto-fill page from keyword record
      setPage(keyword.page || "");
    }
  }, [open, keyword]);

  const handleSubmit = async () => {
    if (!rank || rank === "") {
      return toast.error("Rank is required.");
    }

    const rankValue = parseInt(rank);
    if (rankValue < 0 || rankValue > 10) {
      return toast.error("Rank must be between 0 and 10.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/keywords-followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword_id: keyword.id,
          followup_date: currentDate,
          page: page || null,
          rank: rankValue,
          status: "completed",
          notes: null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Follow-up submitted successfully!");
        setRank("");
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(data.message || "Failed to submit follow-up.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Network error while submitting follow-up.");
    } finally {
      setLoading(false);
    }
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (!open || !keyword) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Add Follow-up</h2>
            <p className="text-sm text-gray-600 mt-1">Keyword: {keyword.keyword}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Current Date - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formatDateDisplay(currentDate)}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Today's date (auto-filled)</p>
          </div>

          {/* Page - Editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="Enter page"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Auto-filled, can be edited</p>
          </div>

          {/* Rank Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rank (0-10) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder="Enter rank between 0-10"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Enter a value between 0 and 10</p>
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
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
