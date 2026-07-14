"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit } from "lucide-react";
import toast from "react-hot-toast";
import AddBacklinkModal from "./AddBacklinkModal";
import EditBacklinkModal from "./EditBacklinkModal";

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

  useEffect(() => {
    fetchBacklinks();
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

  const fetchBacklinks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backlinks");
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
  };

  const openEditModal = (backlink) => {
    setSelectedBacklink(backlink);
    setIsEditModalOpen(true);
  };

  // Filter backlinks based on search term and filters
  const filteredBacklinks = backlinks.filter((bl) => {
    const matchesSearch =
      bl.website.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bl.keyword.toLowerCase().includes(searchTerm.toLowerCase());

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
        toDate.setHours(23, 59, 59, 999); // Include entire day
        matchesDateRange = matchesDateRange && blDate <= toDate;
      }
    }

    return matchesSearch && matchesStatus && matchesAssignedTo && matchesDateRange;
  });

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
      case "submitted":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "deleted":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
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
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="deleted">Deleted</option>
          </select>
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
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Website
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Keyword
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Email
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Date
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Status
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
            {filteredBacklinks.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                  No backlinks found. Add one to get started!
                </td>
              </tr>
            ) : (
              filteredBacklinks.map((backlink) => (
                <tr key={backlink.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-3 font-medium text-gray-800">
                    <a href={backlink.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {backlink.website}
                    </a>
                  </td>
                  <td className="px-6 py-3 text-gray-700">{backlink.keyword || "-"}</td>
                  <td className="px-6 py-3 text-gray-700">{backlink.email || "-"}</td>
                  <td className="px-6 py-3 text-gray-700">
                    {formatDate(backlink.followup_date)}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                        backlink.status
                      )}`}
                    >
                      {backlink.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-700">
                    {backlink.assigned_to || "-"}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(backlink)}
                        title="Edit"
                        className="text-green-600 hover:text-green-800 transition"
                      >
                        <Edit size={18} />
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
