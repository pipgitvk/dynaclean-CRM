"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function KeywordHistoryModal({
  open,
  onClose,
  keyword,
}) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && keyword) {
      fetchFollowups();
    }
  }, [open, keyword]);

  const fetchFollowups = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/keywords-followups?keyword_id=${keyword.id}`
      );
      const data = await res.json();

      if (res.ok) {
        setFollowups(data);
      } else {
        toast.error("Failed to load follow history");
      }
    } catch (error) {
      console.error("Error fetching followups:", error);
      toast.error("Network error while fetching follow history");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getRankColor = (rank) => {
    if (rank <= 2) return "text-red-600";
    if (rank <= 5) return "text-yellow-600";
    if (rank <= 7) return "text-blue-600";
    return "text-green-600";
  };

  if (!open || !keyword) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Follow History</h2>
            <p className="text-sm text-gray-600 mt-1">Keyword: {keyword.keyword}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading history...</p>
            </div>
          </div>
        ) : followups.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
            No follow-up history found for this keyword.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Timeline View */}
            {followups.map((followup, index) => (
              <div
                key={followup.id}
                className="relative pb-6 last:pb-0"
              >
                {/* Timeline line */}
                {index !== followups.length - 1 && (
                  <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200"></div>
                )}

                {/* Timeline item */}
                <div className="flex gap-4">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-4 h-4 rounded-full bg-blue-600 ring-4 ring-white shadow-md"></div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(followup.followup_date)}
                        </p>
                        <p className={`text-lg font-bold ${getRankColor(followup.rank)}`}>
                          Rank: {followup.rank !== null ? followup.rank : "-"}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold
                          ${
                            followup.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : followup.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                          }
                        `}
                      >
                        {followup.status}
                      </span>
                    </div>
                    {followup.notes && (
                      <p className="text-sm text-gray-600">
                        Notes: {followup.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Section */}
        {!loading && followups.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600">Total Entries</p>
                <p className="text-2xl font-bold text-blue-600">{followups.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600">Latest Rank</p>
                <p className="text-2xl font-bold text-green-600">
                  {followups[0]?.rank !== null ? followups[0]?.rank : "-"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
