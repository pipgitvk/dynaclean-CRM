"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const StatusBadge = ({ status }) => {
  const styles = {
    new: "bg-blue-100 text-blue-700 border-blue-200",
    under_review: "bg-yellow-100 text-yellow-700 border-yellow-200",
    technical_preparation: "bg-purple-100 text-purple-700 border-purple-200",
    submitted: "bg-indigo-100 text-indigo-700 border-indigo-200",
    technical_qualified: "bg-teal-100 text-teal-700 border-teal-200",
    ra_participated: "bg-orange-100 text-orange-700 border-orange-200",
    won: "bg-green-100 text-green-700 border-green-200",
    lost: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status] || "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {status.replace(/_/g, " ").toUpperCase()}
    </span>
  );
};

export default function GemCrmBidsPage() {
  const router = useRouter();
  const [bids, setBids] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [technicalStatusFilter, setTechnicalStatusFilter] = useState("");
  const [financialStatusFilter, setFinancialStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState({ total: 0, won: 0, lost: 0 });

  useEffect(() => {
    fetchBids();
    fetchStats();
  }, [pagination.page, statusFilter, technicalStatusFilter, financialStatusFilter, platformFilter, dateFrom, dateTo]);

  const fetchBids = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(technicalStatusFilter && { technicalStatus: technicalStatusFilter }),
        ...(financialStatusFilter && { financialStatus: financialStatusFilter }),
        ...(platformFilter && { platform: platformFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });

      const res = await fetch(`/api/gem-crm/bids?${params}`);
      const result = await res.json();
      if (result.success) {
        setBids(result.data);
        setPagination(result.pagination);
      } else {
        toast.error("Failed to fetch bids");
      }
    } catch (error) {
      console.error("Error fetching bids:", error);
      toast.error("Error fetching bids");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchBids();
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/gem-crm/bids/stats");
      const result = await res.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Government Bids</h1>
          <p className="text-gray-600 mt-1">Manage government tenders and bids</p>
        </div>
        <button
          onClick={() => router.push("/gem-dashboard/gem-crm/bids/new")}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Bid
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Bids</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Bids Won</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.won}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Bids Lost</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.lost}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by bid number, GEM bid no, or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="under_review">Under Review</option>
              <option value="technical_preparation">Technical Preparation</option>
              <option value="submitted">Submitted</option>
              <option value="technical_qualified">Technical Qualified</option>
              <option value="ra_participated">RA Participated</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={technicalStatusFilter}
              onChange={(e) => setTechnicalStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Technical Status</option>
              <option value="pending">Pending</option>
              <option value="qualified">Qualified</option>
              <option value="disqualified">Disqualified</option>
            </select>

            <select
              value={financialStatusFilter}
              onChange={(e) => setFinancialStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Financial Status</option>
              <option value="pending">Pending</option>
              <option value="qualified">Qualified</option>
              <option value="disqualified">Disqualified</option>
            </select>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Platforms</option>
              <option value="GEM">GEM</option>
              <option value="E Procurement">E Procurement</option>
              <option value="Other">Other</option>
            </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bids Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Bid Number
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  GEM Bid No
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Title
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Platform
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Employee
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Estimated Bid Value
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Publish Date
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Submission Date
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Opening Date
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Status
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="11" className="py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : bids.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-8 text-center text-gray-500">
                    No bids found
                  </td>
                </tr>
              ) : (
                bids.map((bid) => (
                  <tr key={bid.bid_id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-blue-600">
                      {bid.bid_number || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {bid.gem_bid_no || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 max-w-xs truncate">
                      {bid.bid_title || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {bid.bidding_platform || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {bid.assigned_employee_name || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 text-right">
                      {bid.estimated_bid_value
                        ? `₹${Number(bid.estimated_bid_value).toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {bid.bid_start_date ? new Date(bid.bid_start_date).toLocaleDateString('en-IN') : "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {bid.bid_end_date ? new Date(bid.bid_end_date).toLocaleDateString('en-IN') : "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {bid.bid_open_date ? new Date(bid.bid_open_date).toLocaleDateString('en-IN') : "-"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={bid.bid_status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/gem-dashboard/gem-crm/bids/${bid.bid_id}`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/gem-dashboard/gem-crm/bids/${bid.bid_id}/edit`)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} bids
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

