"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function EditKeywordModal({ open, onClose, keyword, onSuccess }) {
  const [formData, setFormData] = useState({
    keyword: "",
    page: "",
    rank: "",
    assigned_to: "",
  });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    if (keyword) {
      setFormData({
        keyword: keyword.keyword || "",
        page: keyword.page || "",
        rank: keyword.rank || "",
        assigned_to: keyword.assigned_to || "",
      });
    }
  }, [keyword]);

  // Fetch digital marketers for dropdown
  useEffect(() => {
    if (showUserDropdown && searchQuery) {
      fetchDigitalMarketers(searchQuery);
    } else if (!showUserDropdown) {
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
    setFormData({ ...formData, assigned_to: username });
    setShowUserDropdown(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async () => {
    if (!formData.keyword.trim()) {
      return toast.error("Keyword is required.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: keyword.id,
          keyword: formData.keyword.trim(),
          page: formData.page.trim() || null,
          rank: formData.rank ? parseInt(formData.rank) : 0,
          assigned_to: formData.assigned_to || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Keyword updated successfully!");
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(data.message || "Failed to update keyword.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Network error while updating keyword.");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !keyword) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Edit Keyword</h2>
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
              name="keyword"
              value={formData.keyword}
              onChange={handleChange}
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
              name="page"
              value={formData.page}
              onChange={handleChange}
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
              name="rank"
              value={formData.rank}
              onChange={handleChange}
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
                value={formData.assigned_to}
                onChange={(e) => {
                  setFormData({ ...formData, assigned_to: e.target.value });
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
            {loading ? "Updating..." : "Update Keyword"}
          </button>
        </div>
      </div>
    </div>
  );
}
