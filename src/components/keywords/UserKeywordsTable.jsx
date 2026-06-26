"use client";

import { useState, useEffect } from "react";
import { Search, Plus, History } from "lucide-react";
import toast from "react-hot-toast";
import FollowKeywordModal from "./FollowKeywordModal";
import KeywordHistoryModal from "./KeywordHistoryModal";

const UserKeywordsTable = () => {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [currentUsername, setCurrentUsername] = useState("");

  useEffect(() => {
    fetchCurrentUser();
    fetchUserKeywords();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/current-user");
      const data = await res.json();
      if (res.ok) {
        setCurrentUsername(data.username);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchUserKeywords = async () => {
    try {
      setLoading(true);
      // Fetch all keywords, then filter for current user on client side
      const res = await fetch("/api/keywords");
      const data = await res.json();

      if (res.ok) {
        // Filter keywords assigned to current user
        // We'll refine this after getting the username
        setKeywords(data);
        setError(null);
      } else {
        setError("Failed to load keywords");
        toast.error("Failed to load keywords");
      }
    } catch (error) {
      console.error("Error fetching keywords:", error);
      setError("Network error");
      toast.error("Network error while fetching keywords");
    } finally {
      setLoading(false);
    }
  };

  const openFollowModal = (keyword) => {
    setSelectedKeyword(keyword);
    setIsFollowModalOpen(true);
  };

  const openHistoryModal = (keyword) => {
    setSelectedKeyword(keyword);
    setIsHistoryModalOpen(true);
  };

  // Filter keywords assigned to current user
  const userKeywords = keywords.filter(
    (kw) => kw.assigned_to === currentUsername
  );

  const filteredKeywords = userKeywords.filter((kw) =>
    kw.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading keywords...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Keywords Tracking</h1>
      </div>

      {/* Search Box */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search keywords..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Keyword
              </th>
              {/* <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Page
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Current Rank
              </th> */}
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Rank
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Page
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Updated Date
              </th>
              <th className="px-6 py-3 text-center font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredKeywords.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No keywords assigned to you yet.
                </td>
              </tr>
            ) : (
              filteredKeywords.map((keyword) => (
                <tr key={keyword.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-3 font-medium text-gray-800">
                    {keyword.keyword}
                  </td>
                  {/* <td className="px-6 py-3 text-gray-700">{keyword.page || "-"}</td>
                  <td className="px-6 py-3 text-gray-700">{keyword.rank || "-"}</td> */}
                  <td className="px-6 py-3 font-semibold text-blue-700">
                    {keyword.latest_followup_rank != null ? Number(keyword.latest_followup_rank) : (keyword.rank || "-")}
                  </td>
                  <td className="px-6 py-3 text-gray-700">
                    {keyword.latest_followup_page || keyword.page || "-"}
                  </td>
                  <td className="px-6 py-3 text-gray-700">
                    {formatDate(keyword.updated_at)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openFollowModal(keyword)}
                        title="Add Follow-up"
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                      >
                        <Plus size={14} />
                        Follow
                      </button>
                      <button
                        onClick={() => openHistoryModal(keyword)}
                        title="View History"
                        className="text-green-600 hover:text-green-800 transition"
                      >
                        <History size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {filteredKeywords.length === 0 ? (
          <div className="bg-white rounded-lg p-6 text-center text-gray-500">
            No keywords assigned to you yet.
          </div>
        ) : (
          filteredKeywords.map((keyword) => (
            <div
              key={keyword.id}
              className="bg-white rounded-lg shadow p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">{keyword.keyword}</h3>
                  {/* <p className="text-sm text-gray-600">
                    Page: {keyword.page || "-"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Current Rank: {keyword.rank || "-"}
                  </p> */}
                  <p className="text-sm font-semibold text-blue-700">
                    Latest Rank: {keyword.latest_followup_rank != null ? Number(keyword.latest_followup_rank) : "-"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Latest Page: {keyword.latest_followup_page || "-"}
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>Updated: {formatDate(keyword.updated_at)}</p>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => openFollowModal(keyword)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                >
                  <Plus size={16} />
                  Follow
                </button>
                <button
                  onClick={() => openHistoryModal(keyword)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                >
                  <History size={16} />
                  History
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <FollowKeywordModal
        open={isFollowModalOpen}
        onClose={() => {
          setIsFollowModalOpen(false);
          setSelectedKeyword(null);
        }}
        keyword={selectedKeyword}
        onSuccess={fetchUserKeywords}
      />
      <KeywordHistoryModal
        open={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedKeyword(null);
        }}
        keyword={selectedKeyword}
      />
    </div>
  );
};

export default UserKeywordsTable;
