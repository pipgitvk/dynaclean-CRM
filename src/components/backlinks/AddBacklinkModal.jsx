"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Download } from "lucide-react";
import toast from "react-hot-toast";

export default function AddBacklinkModal({
  open,
  onClose,
  onSuccess,
}) {
  const [rows, setRows] = useState([
    { website: "", keyword: "", email: "", followup_date: "", status: "submitted", assigned_to: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [digitalMarketers, setDigitalMarketers] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [emails, setEmails] = useState([]);
  const [currentUser, setCurrentUser] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    fetchDigitalMarketers();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    // Fetch keywords after currentUser is set
    if (currentUser) {
      fetchKeywords();
      fetchEmails();
    }
  }, [currentUser, isSuperAdmin]);

  useEffect(() => {
    if (open) {
      // Reset when modal opens
      const today = new Date().toISOString().split("T")[0];
      setRows([
        { website: "", keyword: "", email: "", followup_date: today, status: "submitted", assigned_to: "" }
      ]);
      setSavedCount(0);
    }
  }, [open]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/current-user");
      const data = await res.json();
      if (res.ok && data.username) {
        setCurrentUser(data.username);
        const role = (data.role || data.userRole || "").toUpperCase();
        setCurrentRole(role);
        setIsSuperAdmin(role === "SUPERADMIN");
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
      setIsSuperAdmin(false);
    }
  };

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
      const res = await fetch("/api/keywords");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        // Filter keywords: if isSuperAdmin show all, otherwise only show assigned to current user
        const filtered = isSuperAdmin 
          ? data 
          : data.filter(kw => kw.assigned_to === currentUser);
        setKeywords(filtered);
      }
    } catch (error) {
      console.error("Error fetching keywords:", error);
    }
  };

  const fetchEmails = async () => {
    try {
      const res = await fetch("/api/backlink-emails");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEmails(data);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const addRow = () => {
    const today = new Date().toISOString().split("T")[0];
    setRows([
      ...rows,
      { website: "", keyword: "", email: "", followup_date: today, status: "submitted", assigned_to: currentUser || "" }
    ]);
  };

  const removeRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const saveRow = async (row) => {
    if (!row.website) {
      toast.error("Website is required for saving.");
      return false;
    }

    try {
      const res = await fetch("/api/backlinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: row.website.trim(),
          keyword: row.keyword.trim() || null,
          email: row.email.trim() || null,
          followup_date: row.followup_date || null,
          status: row.status || "submitted",
          assigned_to: row.assigned_to || currentUser || null,
        }),
      });

      if (res.ok) {
        return true;
      } else {
        const data = await res.json();
        toast.error(`Failed to save: ${data.message || "Unknown error"}`);
        return false;
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Network error while saving.");
      return false;
    }
  };

  const handleSaveAll = async () => {
    const validRows = rows.filter(r => r.website && r.website.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in at least one backlink with website information.");
      return;
    }

    setLoading(true);
    let successCount = 0;

    for (const row of validRows) {
      const saved = await saveRow(row);
      if (saved) {
        successCount++;
      }
    }

    setLoading(false);
    setSavedCount(successCount);
    
    if (successCount > 0) {
      toast.success(`${successCount} backlink(s) saved successfully!`);
      if (onSuccess) {
        onSuccess();
      }
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const downloadTemplate = () => {
    const headers = ["Website", "Keyword", "Email", "Date", "Status", "Assigned To"];
    const template = [headers.join(",")].join("\n");
    
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(template));
    element.setAttribute("download", "backlinks_template.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Template downloaded!");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-4 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Bulk Add Backlinks</h2>
            <p className="text-sm text-gray-600 mt-1">Add multiple backlinks at once. They will be saved automatically.</p>
            {savedCount > 0 && <p className="text-sm text-green-600 mt-1">✓ {savedCount} backlink(s) saved</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Download Template Button */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
          >
            <Download size={16} />
            Download Template
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-300 rounded-lg mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-300 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Website*</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Keyword</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Assigned To</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <input
                      type="url"
                      value={row.website}
                      onChange={(e) => handleRowChange(index, "website", e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.keyword}
                      onChange={(e) => handleRowChange(index, "keyword", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    >
                      <option value="">Select Keyword</option>
                      {keywords.map((kw) => (
                        <option key={kw.id} value={kw.keyword}>
                          {kw.keyword}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.email}
                      onChange={(e) => handleRowChange(index, "email", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    >
                      <option value="">Select Email</option>
                      {emails.map((emailItem) => (
                        <option key={emailItem.id} value={emailItem.email}>
                          {emailItem.email}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={row.followup_date}
                      onChange={(e) => handleRowChange(index, "followup_date", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.status}
                      onChange={(e) => handleRowChange(index, "status", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="deleted">Deleted</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {isSuperAdmin ? (
                      <select
                        value={row.assigned_to}
                        onChange={(e) => handleRowChange(index, "assigned_to", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                      >
                        <option value="">Select user</option>
                        {digitalMarketers.map((dm) => (
                          <option key={dm.username} value={dm.username}>
                            {dm.username}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={currentUser}
                        disabled
                        className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-100 text-gray-600 cursor-not-allowed text-xs"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1}
                      className="text-red-600 hover:text-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Row Button */}
        <div className="mb-6">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
          >
            <Plus size={18} />
            Add Row
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 sticky bottom-0 bg-white pt-4 border-t">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={loading || rows.every(r => !r.website)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Saving..." : `Save All (${rows.filter(r => r.website).length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
