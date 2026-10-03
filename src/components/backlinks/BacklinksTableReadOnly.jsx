"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Edit, Plus, Mail } from "lucide-react";
import toast from "react-hot-toast";
import EditBacklinkModal from "./EditBacklinkModal";
import AddBacklinkModal from "./AddBacklinkModal";
import EmailManagementModal from "./EmailManagementModal";
import BacklinksStatsCards from "./BacklinksStatsCards";

const PAGE_SIZE = 20;

const BacklinksTableReadOnly = () => {
  const [backlinks, setBacklinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBacklink, setSelectedBacklink] = useState(null);
  const [digitalMarketers, setDigitalMarketers] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchBacklinks();
    fetchDigitalMarketers();
    fetchCurrentUser();
  }, []);

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

  const fetchBacklinks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backlinks");
      const data = await res.json();

      if (res.ok) {
        console.log("Fetched backlinks:", data);
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
  };

  const openEditModal = (backlink) => {
    setSelectedBacklink(backlink);
    setIsEditModalOpen(true);
  };

  // Filter backlinks based on search term and filters
  // Users see only their own backlinks, superadmin sees all
  const filteredBacklinks = useMemo(
    () =>
      backlinks.filter((bl) => {
        const matchesSearch =
          bl.website.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (bl.keyword &&
            bl.keyword.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = filterStatus === "" || bl.status === filterStatus;
        const matchesAssignedTo =
          filterAssignedTo === "" || bl.assigned_to === filterAssignedTo;

        // Date range filter
        let matchesDateRange = true;
        if (dateFrom || dateTo) {
          const blDate = new Date(bl.followup_date);
          if (dateFrom) {
            const fromDate = new Date(dateFrom);
            matchesDateRange = matchesDateRange && blDate >= fromDate;
          }
          if (dateTo) {
            const toDate = new Date(dateTo);
            matchesDateRange = matchesDateRange && blDate <= toDate;
          }
        }

        // If superadmin, show all; otherwise show only current user's backlinks
        const matchesUser = isSuperAdmin || bl.assigned_to === currentUser;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesAssignedTo &&
          matchesUser &&
          matchesDateRange
        );
      }),
    [
      backlinks,
      searchTerm,
      filterStatus,
      filterAssignedTo,
      dateFrom,
      dateTo,
      isSuperAdmin,
      currentUser,
    ]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBacklinks.length / PAGE_SIZE)
  );

  const paginatedBacklinks = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredBacklinks.slice(start, start + PAGE_SIZE);
  }, [filteredBacklinks, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterAssignedTo, dateFrom, dateTo]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
        <div className="flex gap-2">
          {/* 
          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Mail size={20} />
            Manage Emails
          </button>
          */}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        {/* Filter by Submitted By */}
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
                  No backlinks found.
                </td>
              </tr>
            ) : (
              paginatedBacklinks.map((backlink, index) => (
                <tr key={backlink.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 24px", fontWeight: "600", color: "#374151", textAlign: "center" }}>
                    {(currentPage - 1) * PAGE_SIZE + index + 1}
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
            No backlinks found.
          </div>
        ) : (
          paginatedBacklinks.map((backlink) => (
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

      {filteredBacklinks.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, filteredBacklinks.length)} of{" "}
            {filteredBacklinks.length} backlinks
          </p>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, index, pages) => {
                  const prevPage = pages[index - 1];
                  const showEllipsis = prevPage && page - prevPage > 1;

                  return (
                    <span key={page} className="flex items-center gap-2">
                      {showEllipsis ? (
                        <span className="px-1 text-gray-400">...</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                          page === currentPage
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  );
                })}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(page + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

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
      <EmailManagementModal
        open={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
    </div>
  );
};

export default BacklinksTableReadOnly;
