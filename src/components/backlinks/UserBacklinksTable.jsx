"use client";

import { useState, useEffect } from "react";
import { Search, Mail, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

const UserBacklinksTable = () => {
  const [backlinks, setBacklinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");

  useEffect(() => {
    fetchCurrentUser();
    fetchBacklinks();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/current-user");
      const data = await res.json();
      if (res.ok) {
        setCurrentUsername(data.username);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
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

  // Filter backlinks assigned to current user
  const userBacklinks = backlinks.filter(
    (bl) => bl.assigned_to === currentUsername
  );

  const filteredBacklinks = userBacklinks.filter(
    (bl) =>
      (bl.website.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bl.keyword.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStatus === "" || bl.status === filterStatus)
  );

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
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
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
        <h1 className="text-3xl font-bold text-gray-800">Backlinks Tracking</h1>
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

      {/* Filter by Status */}
      <div className="w-full md:w-64">
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
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
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
                Followup Date
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Status
              </th>
              <th className="px-6 py-3 text-center font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredBacklinks.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No backlinks assigned to you yet.
                </td>
              </tr>
            ) : (
              filteredBacklinks.map((backlink) => (
                <tr key={backlink.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-3 font-medium text-gray-800">
                    <a
                      href={backlink.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-2"
                    >
                      {backlink.website}
                      <ExternalLink size={14} />
                    </a>
                  </td>
                  <td className="px-6 py-3 text-gray-700">{backlink.keyword || "-"}</td>
                  <td className="px-6 py-3 text-gray-700">
                    {backlink.email ? (
                      <a href={`mailto:${backlink.email}`} className="text-blue-600 hover:underline flex items-center gap-2">
                        {backlink.email}
                        <Mail size={14} />
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
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
                  <td className="px-6 py-3 text-center">
                    <span className="text-sm text-gray-500">View Only</span>
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
            No backlinks assigned to you yet.
          </div>
        ) : (
          filteredBacklinks.map((backlink) => (
            <div
              key={backlink.id}
              className="bg-white rounded-lg shadow p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <a
                    href={backlink.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-bold break-all"
                  >
                    {backlink.website}
                  </a>
                  <p className="text-sm text-gray-600 mt-1">
                    Keyword: {backlink.keyword || "-"}
                  </p>
                </div>
              </div>

              {backlink.email && (
                <div className="text-sm">
                  <a href={`mailto:${backlink.email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                    <Mail size={14} />
                    {backlink.email}
                  </a>
                </div>
              )}

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(backlink.status)}`}>
                    {backlink.status}
                  </span>
                </p>
                <p>Followup Date: {formatDate(backlink.followup_date)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserBacklinksTable;
