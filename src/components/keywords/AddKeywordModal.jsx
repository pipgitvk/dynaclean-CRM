"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function AddKeywordModal({ open, onClose, onSuccess }) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState("");
  const [rank, setRank] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Fetch digital marketers for dropdown
  useEffect(() => {
    if (showUserDropdown && searchQuery && searchQuery.length > 0) {
      const timeoutId = setTimeout(() => {
        fetchDigitalMarketers(searchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (!showUserDropdown || !searchQuery) {
      setUsers([]);
    }
  }, [searchQuery, showUserDropdown]);

  const fetchDigitalMarketers = async (query) => {
    try {
      const res = await fetch(`/api/digital-marketers?search=${query}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch digital marketers:", error);
      setUsers([]);
    }
  };

  const handleSelectUser = (username) => {
    setAssignedTo(username);
    setShowUserDropdown(false);
  };

  const handleSubmit = async () => {
    if (!keyword.trim()) {
      return toast.error("Keyword is required.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          page: page.trim() || null,
          rank: rank ? parseInt(rank) : 0,
          assigned_to: assignedTo || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Keyword added successfully!");
        setKeyword("");
        setPage("");
        setRank("");
        setAssignedTo("");
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(data.message || "Failed to add keyword.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Network error while adding keyword.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Add Keyword</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Keyword Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keyword <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Enter keyword..."
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
              placeholder="Enter page No..."
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
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder="Enter rank..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Assigned To Input with Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned To
            </label>
            <div className="relative">
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => {
                  setAssignedTo(e.target.value);
                  setSearchQuery(e.target.value);
                  setShowUserDropdown(true);
                }}
                onFocus={() => setShowUserDropdown(true)}
                placeholder="Search and select user..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showUserDropdown && users.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {users.map((user) => (
                    <button
                      key={user.username}
                      onClick={() => handleSelectUser(user.username)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-100 transition"
                    >
                      {user.username}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            {loading ? "Adding..." : "Add Keyword"}
          </button>
        </div>
      </div>
    </div>
  );
}
