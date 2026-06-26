"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, Eye } from "lucide-react";
import toast from "react-hot-toast";
import AddKeywordModal from "./AddKeywordModal";
import EditKeywordModal from "./EditKeywordModal";
import KeywordFollowupsModal from "./KeywordFollowupsModal";

const KeywordsTable = () => {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPage, setFilterPage] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFollowupsModalOpen, setIsFollowupsModalOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [digitalMarketers, setDigitalMarketers] = useState([]);

  useEffect(() => {
    fetchKeywords();
    fetchDigitalMarketers();
  }, []);

  const fetchDigitalMarketers = async () => {
    try {
      const res = await fetch("/api/digital-marketers");
      const data = await res.json();
      if (res.ok) {
        setDigitalMarketers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching digital marketers:", error);
    }
  };

  const fetchKeywords = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/keywords");
      const data = await res.json();

      if (res.ok) {
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

  const handleDeleteKeyword = async (id) => {
    if (!confirm("Are you sure you want to delete this keyword?")) return;

    try {
      const res = await fetch("/api/keywords", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Keyword deleted successfully!");
        fetchKeywords();
      } else {
        toast.error(data.message || "Failed to delete keyword");
      }
    } catch (error) {
      console.error("Error deleting keyword:", error);
      toast.error("Network error while deleting keyword");
    }
  };

  const openEditModal = (keyword) => {
    setSelectedKeyword(keyword);
    setIsEditModalOpen(true);
  };

  const openFollowupsModal = (keyword) => {
    setSelectedKeyword(keyword);
    setIsFollowupsModalOpen(true);
  };

  // Filter keywords based on search term and filters
  const filteredKeywords = keywords.filter(
    (kw) =>
      kw.keyword.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterPage === "" || (kw.page && kw.page.toLowerCase().includes(filterPage.toLowerCase()))) &&
      (filterRank === "" || kw.rank === parseInt(filterRank)) &&
      (filterAssignedTo === "" || kw.assigned_to === filterAssignedTo)
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
        <h1 className="text-3xl font-bold text-gray-800">Keywords Management</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Add Keyword
        </button>
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

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Filter by Page */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Page
          </label>
          <input
            type="text"
            placeholder="Search page..."
            value={filterPage}
            onChange={(e) => setFilterPage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter by Rank */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Rank
          </label>
          <input
            type="number"
            placeholder="Search rank..."
            value={filterRank}
            onChange={(e) => setFilterRank(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter by Assigned To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Assigned To
          </label>
          <select
            value={filterAssignedTo}
            onChange={(e) => setFilterAssignedTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Users</option>
            {digitalMarketers.map((dm) => (
              <option key={dm.username} value={dm.username}>
                {dm.username}
              </option>
            ))}
          </select>
        </div>
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
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Page
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Rank
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Updated Date
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Assigned To
              </th>
              <th className="px-6 py-3 text-center font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredKeywords.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No keywords found. Add one to get started!
                </td>
              </tr>
            ) : (
              filteredKeywords.map((keyword) => (
                <tr key={keyword.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-3 font-medium text-gray-800">
                    {keyword.keyword}
                  </td>
                  <td className="px-6 py-3 text-gray-700">{keyword.page || "-"}</td>
                  <td className="px-6 py-3 text-gray-700">{keyword.rank || "-"}</td>
                  <td className="px-6 py-3 text-gray-700">
                    {formatDate(keyword.updated_at)}
                  </td>
                  <td className="px-6 py-3 text-gray-700">
                    {keyword.assigned_to || "-"}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openFollowupsModal(keyword)}
                        title="View Followups"
                        className="text-blue-600 hover:text-blue-800 transition"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => openEditModal(keyword)}
                        title="Edit"
                        className="text-green-600 hover:text-green-800 transition"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteKeyword(keyword.id)}
                        title="Delete"
                        className="text-red-600 hover:text-red-800 transition"
                      >
                        <Trash2 size={18} />
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
            No keywords found. Add one to get started!
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
                  <p className="text-sm text-gray-600">
                    Page: {keyword.page || "-"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Rank: {keyword.rank || "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openFollowupsModal(keyword)}
                    className="text-blue-600"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => openEditModal(keyword)}
                    className="text-green-600"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteKeyword(keyword.id)}
                    className="text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>Updated: {formatDate(keyword.updated_at)}</p>
                <p>Assigned To: {keyword.assigned_to || "-"}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <AddKeywordModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchKeywords}
      />
      <EditKeywordModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedKeyword(null);
        }}
        keyword={selectedKeyword}
        onSuccess={fetchKeywords}
      />
      <KeywordFollowupsModal
        open={isFollowupsModalOpen}
        onClose={() => {
          setIsFollowupsModalOpen(false);
          setSelectedKeyword(null);
        }}
        keyword={selectedKeyword}
      />
    </div>
  );
};

export default KeywordsTable;
