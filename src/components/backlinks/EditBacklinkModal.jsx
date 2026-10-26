"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function EditBacklinkModal({
  open,
  onClose,
  backlink,
  onSuccess,
}) {
  const [website, setWebsite] = useState("");
  const [keyword, setKeyword] = useState("");
  const [email, setEmail] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [digitalMarketers, setDigitalMarketers] = useState([]);
  const [currentRole, setCurrentRole] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetchDigitalMarketers();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/current-user");
      const data = await res.json();
      if (res.ok && data.username) {
        const role = (data.role || data.userRole || "").toUpperCase();
        setCurrentRole(role);
        setIsSuperAdmin(role === "SUPERADMIN");
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
      setIsSuperAdmin(false);
    }
  };

  useEffect(() => {
    if (open && backlink) {
      setWebsite(backlink.website || "");
      setKeyword(backlink.keyword || "");
      setEmail(backlink.email || "");
      setFollowupDate(backlink.followup_date || "");
      setStatus(backlink.status || "pending");
      setAssignedTo(backlink.assigned_to || "");
    }
  }, [open, backlink]);

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

  const handleSubmit = async () => {
    if (!website) {
      return toast.error("Website is required.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/backlinks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: backlink.id,
          website: website.trim(),
          keyword: keyword.trim() || null,
          email: email.trim() || null,
          followup_date: followupDate || null,
          status: status || "pending",
          assigned_to: assignedTo || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Backlink updated successfully!");
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(data.message || "Failed to update backlink.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Network error while updating backlink.");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !backlink) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Edit Backlink</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Website Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Keyword Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keyword
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Enter keyword"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>

          {/* Submitted By / Assign To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSuperAdmin ? "Assign To" : "Submitted By"}
            </label>
            {isSuperAdmin ? (
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a user</option>
                {digitalMarketers.map((dm) => (
                  <option key={dm.username} value={dm.username}>
                    {dm.username}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={assignedTo}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            )}
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
            {loading ? "Updating..." : "Update Backlink"}
          </button>
        </div>
      </div>
    </div>
  );
}
