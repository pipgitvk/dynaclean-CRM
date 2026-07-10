"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Filter, Mail } from "lucide-react";
import toast from "react-hot-toast";
import EmailManagementModal from "@/components/backlinks/EmailManagementModal";

// Read persisted filters once at module level (before any render)
const getPersistedFilters = () => {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem("backlinksExcelFilters_persistent");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const BacklinksExcelTable = () => {
  const persistedFilters = getPersistedFilters();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [savingIds, setSavingIds] = useState(new Set());
  const [keywords, setKeywords] = useState([]);
  const [emails, setEmails] = useState([]);
  const [filterKeyword, setFilterKeyword] = useState(persistedFilters.keyword || "");
  const [filterEmail, setFilterEmail] = useState(persistedFilters.email || "");
  const [filterDate, setFilterDate] = useState(persistedFilters.date || "");
  const [filterStatus, setFilterStatus] = useState(persistedFilters.status || "");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const saveTimeoutRef = useRef({});

  // Default empty rows to show at start
  const DEFAULT_EMPTY_ROWS = 50;

  // Save filters to localStorage whenever they change (persists across logout & page navigation)
  useEffect(() => {
    const filters = {
      keyword: filterKeyword,
      email: filterEmail,
      date: filterDate,
      status: filterStatus,
    };
    localStorage.setItem("backlinksExcelFilters_persistent", JSON.stringify(filters));
  }, [filterKeyword, filterEmail, filterDate, filterStatus]);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
      fetchKeywords();
    }
  }, [currentUser, currentRole, filterKeyword, filterEmail, filterDate, filterStatus]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/current-user");
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.username);
        setCurrentRole(data.role || "");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // If filters are applied, show blank rows for new entry with those filter values pre-filled
      const hasFilters = filterKeyword || filterEmail || filterDate || filterStatus;
      
      if (!hasFilters) {
        // No filters - show blank rows like Excel
        const emptyRowsNeeded = DEFAULT_EMPTY_ROWS;
        const emptyRows = Array.from({ length: emptyRowsNeeded }, (_, i) => ({
          id: `empty-${Date.now()}-${i}`,
          website: "",
          keyword: filterKeyword || "",
          email: filterEmail || "",
          followup_date: filterDate || new Date().toISOString().split("T")[0],
          status: filterStatus || "pending",
          assigned_to: currentUser || "",
          isNew: true,
          isEmpty: true,
        }));
        
        setRows(emptyRows);
        return;
      }
      
      // If filters are applied, show 50 blank rows with pre-filled filter values
      // User can just copy-paste websites and add new entries
      const emptyRowsNeeded = 50;
      const emptyRows = Array.from({ length: emptyRowsNeeded }, (_, i) => ({
        id: `empty-${Date.now()}-${i}`,
        website: "",
        keyword: filterKeyword || "",
        email: filterEmail || "",
        followup_date: filterDate || new Date().toISOString().split("T")[0],
        status: filterStatus || "pending",
        assigned_to: currentUser || "",
        isNew: true,
        isEmpty: true,
      }));
      
      setRows(emptyRows);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch keywords and emails from keywords table for dropdown filters
  const fetchKeywords = async () => {
    try {
      // Fetch keywords
      const keywordsRes = await fetch("/api/keywords");
      const keywordsData = await keywordsRes.json();
      if (keywordsRes.ok) {
        let userKeywords = [];
        
        // If SuperAdmin or EA, show all keywords. Otherwise show only assigned keywords
        const roleUpper = String(currentRole).trim().toUpperCase();
        if (roleUpper === "SUPERADMIN" || roleUpper === "EA") {
          userKeywords = keywordsData
            .map(kw => kw.keyword)
            .filter(Boolean);
        } else {
          userKeywords = keywordsData
            .filter(kw => kw.assigned_to === currentUser)
            .map(kw => kw.keyword)
            .filter(Boolean);
        }
        
        const uniqueKeywords = [...new Set(userKeywords)];
        setKeywords(uniqueKeywords.sort());
      }

      // Fetch emails from backlinks
      const emailsRes = await fetch(`/api/digital-market-excel?username=${encodeURIComponent(currentUser)}`);
      const emailsData = await emailsRes.json();
      if (emailsRes.ok) {
        const userEmails = emailsData
          .filter(row => row.email && row.email.trim())
          .map(row => row.email)
          .filter(Boolean);
        
        const uniqueEmails = [...new Set(userEmails)];
        setEmails(uniqueEmails.sort());
      }
    } catch (error) {
      console.error("Error fetching keywords and emails:", error);
    }
  };

  const handleFieldChange = (id, field, value) => {
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id === id) {
          const updatedRow = { ...row, [field]: value };
          
          // If any field is filled, mark as not empty
          if (value && row.isEmpty) {
            updatedRow.isEmpty = false;
          }
          
          // Auto-save with debounce
          if (saveTimeoutRef.current[id]) {
            clearTimeout(saveTimeoutRef.current[id]);
          }
          
          setSavingIds((prev) => new Set([...prev, id]));
          
          saveTimeoutRef.current[id] = setTimeout(() => {
            handleAutoSave(updatedRow);
          }, 1000);
          
          return updatedRow;
        }
        return row;
      })
    );
  };

  const handleAutoSave = async (row) => {
    const id = row.id;
    
    // Don't save empty rows
    if (!row.website && !row.keyword && !row.email) {
      setSavingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }

    // Require website and keyword
    if (!row.website || !row.keyword) {
      setSavingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }

    try {
      if (row.isNew) {
        // Create new entry
        const res = await fetch("/api/digital-market-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            website: row.website,
            keyword: row.keyword,
            email: row.email,
            date_added: row.followup_date,
            status: row.status,
            assigned_to: currentUser, // Always use current user
            created_by: currentUser,
          }),
        });

        const result = await res.json();
        if (res.ok) {
          // Update row with actual ID and remove isNew flag
          setRows((prevRows) =>
            prevRows.map((r) =>
              r.id === id
                ? { 
                    ...row, 
                    id: result.id, 
                    isNew: false,
                    isEmpty: false 
                  }
                : r
            )
          );
          toast.success("Entry saved");
          
          // Add new empty row at bottom
          const newEmptyRow = {
            id: `empty-${Date.now()}`,
            website: "",
            keyword: "",
            email: "",
            followup_date: new Date().toISOString().split("T")[0],
            status: "pending",
            assigned_to: currentUser || "",
            isNew: true,
            isEmpty: true,
          };
          setRows((prevRows) => [...prevRows, newEmptyRow]);
        } else if (res.status === 409 && result.isDuplicate) {
          // Handle duplicate entry error
          toast.error(result.message, { duration: 3000 });
          // Remove the row that caused the duplicate
          setRows((prevRows) => prevRows.filter((r) => r.id !== id));
        } else {
          toast.error(result.message || "Failed to save");
        }
      } else {
        // Update existing entry
        const res = await fetch("/api/digital-market-excel", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            website: row.website,
            keyword: row.keyword,
            email: row.email,
            date_added: row.followup_date,
            status: row.status,
            assigned_to: currentUser, // Always use current user
          }),
        });

        if (res.ok) {
          toast.success("Entry updated", { duration: 1000 });
        } else {
          const result = await res.json();
          toast.error(result.message || "Failed to update");
        }
      }
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Network error while saving");
    } finally {
      setSavingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;

    try {
      const res = await fetch("/api/digital-market-excel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setRows((prevRows) => prevRows.filter((r) => r.id !== id));
        toast.success("Entry deleted");
      } else {
        const result = await res.json();
        toast.error(result.message || "Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Network error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-gray-800">Backlinks Excel Data</h2>
          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Mail size={20} />
            Manage Emails
          </button>
        </div>
        <p className="text-gray-500 text-sm">Edit directly - saves automatically as you type</p>
      </div>

      {/* Filters */}
      <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-gray-600" />
          <h3 className="font-semibold text-gray-800">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
            <select
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Keywords</option>
              {keywords.map((kw) => (
                <option key={kw} value={kw}>
                  {kw}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <select
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Emails</option>
              {emails.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg shadow-sm bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50 border-b sticky top-0">
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-32">Website</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-40">Keyword</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-32">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-28">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-28">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-32">Assigned To</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr 
                key={row.id} 
                className={`border-b hover:bg-blue-50 transition ${
                  savingIds.has(row.id) ? "bg-yellow-50" : ""
                } ${row.isEmpty ? "bg-gray-50" : ""}`}
              >
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={row.website}
                    onChange={(e) => handleFieldChange(row.id, "website", e.target.value)}
                    placeholder="website.com"
                    className="w-full px-2 py-1 border rounded outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={row.keyword}
                    onChange={(e) => handleFieldChange(row.id, "keyword", e.target.value)}
                    placeholder="Enter keyword"
                    className="w-full px-2 py-1 border rounded outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => handleFieldChange(row.id, "email", e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-2 py-1 border rounded outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="date"
                    value={row.followup_date}
                    onChange={(e) => handleFieldChange(row.id, "followup_date", e.target.value)}
                    className="w-full px-2 py-1 border rounded outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={row.status}
                    onChange={(e) => handleFieldChange(row.id, "status", e.target.value)}
                    className="w-full px-2 py-1 border rounded outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={row.assigned_to}
                    disabled
                    placeholder="Username"
                    className="w-full px-2 py-1 border rounded bg-gray-100 text-gray-600 cursor-not-allowed"
                    title="Automatically set to current user"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  {!row.isEmpty && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-red-600 hover:text-red-800 transition inline-block"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  {savingIds.has(row.id) && (
                    <div className="inline-block">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Email Management Modal */}
      <EmailManagementModal
        open={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
    </div>
  );
};

export default BacklinksExcelTable;
