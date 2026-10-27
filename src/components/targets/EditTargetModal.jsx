"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

const EditTargetModal = ({ isOpen, onClose, targetData, onSuccess }) => {
  const [formData, setFormData] = useState({
    target: "",
    target_start_date: "",
    target_end_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && targetData) {
      setFormData({
        target: targetData.target || "",
        target_start_date: targetData.target_start_date
          ? new Date(targetData.target_start_date).toISOString().split("T")[0]
          : "",
        target_end_date: targetData.target_end_date
          ? new Date(targetData.target_end_date).toISOString().split("T")[0]
          : "",
      });
      setError(null);
      setMessage("");
    }
  }, [isOpen, targetData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage("");

    try {
      const response = await fetch(`/api/monitor-target`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetData.id,
          target: formData.target,
          target_start_date: formData.target_start_date,
          target_end_date: formData.target_end_date,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Target updated successfully!");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(data.message || "Failed to update target");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Update error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Edit Target</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Messages */}
          {message && (
            <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-green-800 text-sm text-center">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-3 text-red-800 text-sm text-center">
              {error}
            </div>
          )}

          {/* Username (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={targetData?.username || ""}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* Target Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Amount
            </label>
            <input
              type="number"
              name="target"
              value={formData.target}
              onChange={handleChange}
              min="1"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="target_start_date"
              value={formData.target_start_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="target_end_date"
              value={formData.target_end_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Assigned By (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned By
            </label>
            <input
              type="text"
              value={targetData?.created_by || ""}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? "Updating..." : "Update Target"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTargetModal;
