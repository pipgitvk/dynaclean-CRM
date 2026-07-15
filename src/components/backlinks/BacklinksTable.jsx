"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Edit } from "lucide-react";
import toast from "react-hot-toast";
import AddBacklinkModal from "./AddBacklinkModal";
import EditBacklinkModal from "./EditBacklinkModal";
import BacklinksStatsCards from "./BacklinksStatsCards";

const BacklinksTable = () => {
  const [backlinks, setBacklinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBacklink, setSelectedBacklink] = useState(null);
  const [digitalMarketers, setDigitalMarketers] = useState([]);

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

  const fetchBacklinks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterAssignedTo) params.set("assigned_to", filterAssignedTo);
      if (filterStatus) params.set("status", filterStatus);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/backlinks?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setBacklinks(data);
        setError(null);
      } else {
        setError("Failed to load backlinks");
        toast.error("Failed to load backlinks");
      }
    } catch (error) {
      console.error("Error fetching backlinks:", error);
      setError("Network error");
      toast.error("Network error while fetching backlinks");
    } finally {
      setLoading(false);
    }
  }, [filterAssignedTo, filterStatus, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    fetchDigitalMarketers();
  }, []);

  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);

  const openEditModal = (backlink) => {
    setSelectedBacklink(backlink);
    setIsEditModalOpen(true);
  };

  // Data is already filtered server-side
  const filteredBacklinks = backlinks;

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "on_hold":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeColorStyle = (status) => {
    switch (status) {
      case "completed":
        return { backgroundColor: "#dcfce7", color: "#166534" };
      case "in_progress":
        return { backgroundColor: "#dbeafe", color: "#1e40af" };
      case "on_hold":
        return { backgroundColor: "#fef3c7", color: "#92400e" };
      case "pending":
        return { backgroundColor: "#f3f4f6", color: "#374151" };
      default:
        return { backgroundColor: "#f3f4f6", color: "#374151" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading backlinks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Backlinks Management</h1>
        {/* 
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Add Backlink
        </button>
        */}
      </div>

      {/* Stats Cards */}
      <BacklinksStatsCards backlinks={filteredBacklinks} />

      {/* Search Box */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search website or keyword..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Filter by Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>

        {/* Filter by Assigned To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Submitted By
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

        {/* Filter by Date From */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter by Date To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full text-sm" style={{ tableLayout: "auto", minWidth: "100%" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #d1d5db" }}>
              <th style={{ padding: "12px 24px", textAlign: "center", fontWeight: "600", color: "#374151", width: "5%" }}>
                Sr No
              </th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontWeight: "600", color: "#374151", width: "20%" }}>
                Website
              </th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontWeight: "600", color: "#374151", width: "15%" }}>
                Keyword
              </th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontWeight: "600", color: "#374151", width: "18%" }}>
                Email
              </th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontWeight: "600", color: "#374151", width: "12%" }}>
                Date
              </th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontWeight: "600", color: "#374151", width: "12%" }}>
                Status
              </th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontWeight: "600", color: "#374151", width: "12%" }}>
                Submitted By
              </th>
              <th style={{ padding: "12px 24px", textAlign: "center", fontWeight: "600", color: "#374151", width: "6%" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredBacklinks.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: "32px 24px", textAlign: "center", color: "#6b7280" }}>
                  No backlinks found. Add one to get started!
                </td>
              </tr>
            ) : (
              filteredBacklinks.map((backlink, index) => (
                <tr key={backlink.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 24px", fontWeight: "600", color: "#374151", textAlign: "center" }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: "12px 24px", fontWeight: "500", color: "#1f2937", wordBreak: "break-all" }}>
                    <a href={backlink.website} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none" }} onMouseOver={(e) => e.target.style.textDecoration = "underline"} onMouseOut={(e) => e.target.style.textDecoration = "none"}>
                      {backlink.website}
                    </a>
                  </td>
                  <td style={{ padding: "12px 24px", color: "#374151" }}>{backlink.keyword || "-"}</td>
                  <td style={{ padding: "12px 24px", color: "#374151" }}>{backlink.email || "-"}</td>
                  <td style={{ padding: "12px 24px", color: "#374151" }}>
                    {formatDate(backlink.followup_date)}
                  </td>
                  <td style={{ padding: "12px 24px" }}>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: "600",
                        ...getStatusBadgeColorStyle(backlink.status)
                      }}
                    >
                      {backlink.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 24px", color: "#374151" }}>
                    {backlink.assigned_to || "-"}
                  </td>
                  <td style={{ padding: "12px 24px", textAlign: "center" }}>
                    <button
                      onClick={() => openEditModal(backlink)}
                      title="Edit"
                      style={{ color: "#16a34a", cursor: "pointer", border: "none", background: "none" }}
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {filteredBacklinks.length === 0 ? (
          <div className="bg-white rounded-lg p-6 text-center text-gray-500">
            No backlinks found. Add one to get started!
          </div>
        ) : (
          filteredBacklinks.map((backlink) => (
            <div
              key={backlink.id}
              className="bg-white rounded-lg shadow p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">
                    <a href={backlink.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {backlink.website}
                    </a>
                  </h3>
                  <p className="text-sm text-gray-600">
                    Keyword: {backlink.keyword || "-"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Email: {backlink.email || "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(backlink)}
                    className="text-green-600"
                  >
                    <Edit size={18} />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1 border-t pt-3">
                <p>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(backlink.status)}`}>
                    {backlink.status}
                  </span>
                </p>
                <p>Date: {formatDate(backlink.followup_date)}</p>
                <p>Assigned To: {backlink.assigned_to || "-"}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <AddBacklinkModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchBacklinks}
      />
      <EditBacklinkModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedBacklink(null);
        }}
        backlink={selectedBacklink}
        onSuccess={fetchBacklinks}
      />
    </div>
  );
};

export default BacklinksTable;
