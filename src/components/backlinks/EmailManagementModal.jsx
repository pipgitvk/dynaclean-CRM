"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function EmailManagementModal({
  open,
  onClose,
}) {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchEmails();
    }
  }, [open]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backlink-emails");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEmails(data);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
      toast.error("Failed to fetch emails");
    } finally {
      setLoading(false);
    }
  };

  const addEmail = async () => {
    if (!newEmail.trim()) {
      toast.error("Please enter an email");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error("Please enter a valid email");
      return;
    }

    // Check for duplicate
    if (emails.some(e => e.email.toLowerCase() === newEmail.trim().toLowerCase())) {
      toast.error("This email already exists");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/backlink-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      if (res.ok) {
        toast.success("Email added successfully");
        setNewEmail("");
        await fetchEmails();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to add email");
      }
    } catch (error) {
      console.error("Error adding email:", error);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const deleteEmail = async (emailId) => {
    if (!confirm("Are you sure you want to delete this email?")) return;

    try {
      setLoading(true);
      const res = await fetch("/api/backlink-emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emailId }),
      });

      if (res.ok) {
        toast.success("Email deleted successfully");
        await fetchEmails();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to delete email");
      }
    } catch (error) {
      console.error("Error deleting email:", error);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Manage Emails</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Add Email Form */}
        <div className="mb-6 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Add New Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addEmail()}
                placeholder="example@domain.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                disabled={loading}
              />
              <button
                onClick={addEmail}
                disabled={loading || !newEmail.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Email List */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Saved Emails</h3>
          {loading && emails.length === 0 ? (
            <p className="text-center text-gray-500 py-4">Loading emails...</p>
          ) : emails.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No emails added yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {emails.map((emailItem) => (
                <div
                  key={emailItem.id}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                >
                  <span className="text-sm text-gray-800 truncate">
                    {emailItem.email}
                  </span>
                  <button
                    onClick={() => deleteEmail(emailItem.id)}
                    disabled={loading}
                    className="text-red-600 hover:text-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Delete email"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="flex gap-3 mt-6 sticky bottom-0 bg-white pt-4 border-t">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
