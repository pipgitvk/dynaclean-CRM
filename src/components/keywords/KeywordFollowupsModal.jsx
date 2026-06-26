"use client";

import { useState, useEffect } from "react";
import { X, Plus, Edit, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AddFollowupModal from "./AddFollowupModal";
import EditFollowupModal from "./EditFollowupModal";
import RankChart from "./RankChart";

export default function KeywordFollowupsModal({ open, onClose, keyword }) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddFollowupOpen, setIsAddFollowupOpen] = useState(false);
  const [isEditFollowupOpen, setIsEditFollowupOpen] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [keywordRank, setKeywordRank] = useState(0);
  const [keywordPage, setKeywordPage] = useState("");

  useEffect(() => {
    if (open && keyword) {
      fetchFollowups();
      setKeywordRank(keyword.rank || 0);
      setKeywordPage(keyword.page || "");
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
        toast.error("Failed to load followups");
      }
    } catch (error) {
      console.error("Error fetching followups:", error);
      toast.error("Network error while fetching followups");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFollowup = async (id) => {
    if (!confirm("Are you sure you want to delete this followup?")) return;

    try {
      const res = await fetch("/api/keywords-followups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Followup deleted successfully!");
        fetchFollowups();
      } else {
        toast.error(data.message || "Failed to delete followup");
      }
    } catch (error) {
      console.error("Error deleting followup:", error);
      toast.error("Network error while deleting followup");
    }
  };

  const openEditFollowupModal = (followup) => {
    setSelectedFollowup(followup);
    setIsEditFollowupOpen(true);
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

  if (!open || !keyword) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Followups</h2>
            <p className="text-sm text-gray-600">Keyword: {keyword.keyword}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Add Followup Button */}
        <button
          onClick={() => setIsAddFollowupOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition mb-4"
        >
          <Plus size={18} />
          Add Followup
        </button>

        {/* Rank Progress Chart */}
        {!loading && followups.length > 0 && <RankChart followups={followups} keywordRank={keywordRank} keywordPage={keywordPage} />}

        {/* Followups Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading followups...</p>
            </div>
          </div>
        ) : followups.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
            No followups found for this keyword.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {followups.map((followup) => (
                  <tr key={followup.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">
                      {formatDate(followup.followup_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {followup.rank || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {followup.notes || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditFollowupModal(followup)}
                          title="Edit"
                          className="text-green-600 hover:text-green-800"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteFollowup(followup.id)}
                          title="Delete"
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modals */}
        <AddFollowupModal
          open={isAddFollowupOpen}
          onClose={() => setIsAddFollowupOpen(false)}
          keyword={keyword}
          onSuccess={fetchFollowups}
        />
        <EditFollowupModal
          open={isEditFollowupOpen}
          onClose={() => {
            setIsEditFollowupOpen(false);
            setSelectedFollowup(null);
          }}
          followup={selectedFollowup}
          onSuccess={fetchFollowups}
        />
      </div>
    </div>
  );
}
