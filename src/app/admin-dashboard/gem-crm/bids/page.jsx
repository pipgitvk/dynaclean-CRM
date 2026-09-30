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
  X,
  AlertTriangle,
  Timer,
  Edit3,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const [bids, setBids] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [technicalStatusFilter, setTechnicalStatusFilter] = useState("");
  const [financialStatusFilter, setFinancialStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [raFilter, setRaFilter] = useState("");
  const [endingSoonFilter, setEndingSoonFilter] = useState(searchParams.get('endingSoon') === 'true');
  const [activeRAFilter, setActiveRAFilter] = useState(searchParams.get('activeRA') === 'true');
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState({ total: 0, won: 0, lost: 0 });
  const [showModal, setShowModal] = useState(false);
  const [selectedBid, setSelectedBid] = useState(null);
  const [bidForm, setBidForm] = useState({
    selected_level: "",
    l1_level: "",
    l1_price: "",
    l2_level: "",
    l2_price: "",
    l3_level: "",
    l3_price: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchBids();
    fetchStats();
  }, [pagination.page, statusFilter, technicalStatusFilter, financialStatusFilter, platformFilter, dateFrom, dateTo, endingSoonFilter, activeRAFilter, raFilter]);

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
        ...(raFilter && { raParticipated: raFilter }),
        ...(endingSoonFilter && { endingSoon: 'true' }),
        ...(activeRAFilter && { activeRA: 'true' }),
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

  const clearEndingSoonFilter = () => {
    setEndingSoonFilter(false);
    router.push('/admin-dashboard/gem-crm/bids');
  };

  const clearActiveRAFilter = () => {
    setActiveRAFilter(false);
    router.push('/admin-dashboard/gem-crm/bids');
  };

  const openBidOpenedModal = (bid) => {
    setSelectedBid(bid);
    setBidForm({
      selected_level: bid.selected_level || "",
      l1_level: bid.l1_level || "",
      l1_price: bid.l1_price || "",
      l2_level: bid.l2_level || "",
      l2_price: bid.l2_price || "",
      l3_level: bid.l3_level || "",
      l3_price: bid.l3_price || "",
    });
    setShowModal(true);
  };

  const handleSaveBidOpened = async () => {
    if (!selectedBid) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/gem-crm/bids/${selectedBid.bid_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bidForm),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Bid opened details updated successfully");
        setShowModal(false);
        fetchBids(); // Refresh bids list
      } else {
        toast.error(result.message || "Failed to update bid");
      }
    } catch (error) {
      console.error("Error updating bid:", error);
      toast.error("Error updating bid");
    } finally {
      setIsSaving(false);
    }
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
          onClick={() => router.push("/admin-dashboard/gem-crm/bids/new")}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Bid
        </button>
      </div>

      {/* Ending Soon Filter Banner */}
      {endingSoonFilter && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <span className="text-orange-800 font-medium">Showing bids ending within 1 week</span>
          </div>
          <button
            onClick={clearEndingSoonFilter}
            className="flex items-center gap-1 text-orange-700 hover:text-orange-900 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear Filter
          </button>
        </div>
      )}

      {/* Active RA Filter Banner */}
      {activeRAFilter && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-purple-600" />
            <span className="text-purple-800 font-medium">Showing bids with active RA period</span>
          </div>
          <button
            onClick={clearActiveRAFilter}
            className="flex items-center gap-1 text-purple-700 hover:text-purple-900 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear Filter
          </button>
        </div>
      )}

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

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reverse Auction</label>
                <select
                  value={raFilter}
                  onChange={(e) => setRaFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All RA Status</option>
                  <option value="yes">Yes (RA Participated)</option>
                  <option value="no">No (RA Not Participated)</option>
                </select>
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase bg-purple-50">
                  Customer ID
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Bid Number
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
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                  Bid Value
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
                  RA
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
                  <td colSpan="13" className="py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : bids.length === 0 ? (
                <tr>
                  <td colSpan="13" className="py-8 text-center text-gray-500">
                    No bids found
                  </td>
                </tr>
              ) : (
                bids.map((bid) => (
                  <tr key={bid.bid_id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-purple-600 bg-purple-50">
                      {bid.customer_id || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-blue-600">
                      {bid.bid_number || "-"}
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
                    <td className="py-3 px-4 text-sm text-gray-900 text-right">
                      {bid.bid_value
                        ? `₹${Number(bid.bid_value).toLocaleString()}`
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${bid.ra_participated === 'yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {bid.ra_participated === 'yes' ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={bid.bid_status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/admin-dashboard/gem-crm/bids/${bid.bid_id}`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/admin-dashboard/gem-crm/bids/${bid.bid_id}/edit`)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {["opened", "won", "lost", "cancelled"].includes(bid.bid_status) && (
                          <div className="relative group">
                            <button
                              onClick={() => openBidOpenedModal(bid)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Edit Bid Opened Details"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                            {/* Tooltip */}
                            {(bid.selected_level || bid.l1_level || bid.l2_level || bid.l3_level) && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-72 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-normal break-words pointer-events-none">
                                {bid.selected_level && <p className="mb-1"><strong>Selected Level:</strong> {bid.selected_level}</p>}
                                {bid.l1_level && <p className="mb-1"><strong>L1:</strong> {bid.l1_level} {bid.l1_price ? `(₹${Number(bid.l1_price).toLocaleString()})` : ""}</p>}
                                {bid.l2_level && <p className="mb-1"><strong>L2:</strong> {bid.l2_level} {bid.l2_price ? `(₹${Number(bid.l2_price).toLocaleString()})` : ""}</p>}
                                {bid.l3_level && <p><strong>L3:</strong> {bid.l3_level} {bid.l3_price ? `(₹${Number(bid.l3_price).toLocaleString()})` : ""}</p>}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                              </div>
                            )}
                          </div>
                        )}
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

      {/* Modal for Bid Opened Details */}
      {showModal && selectedBid && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Bid Opened Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* L1 Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">L1 Level (Company Name)</label>
                  <input
                    type="text"
                    value={bidForm.l1_level}
                    onChange={(e) => setBidForm({ ...bidForm, l1_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">L1 Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bidForm.l1_price}
                    onChange={(e) => setBidForm({ ...bidForm, l1_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter price"
                  />
                </div>
              </div>

              {/* L2 Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">L2 Level (Company Name)</label>
                  <input
                    type="text"
                    value={bidForm.l2_level}
                    onChange={(e) => setBidForm({ ...bidForm, l2_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">L2 Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bidForm.l2_price}
                    onChange={(e) => setBidForm({ ...bidForm, l2_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter price"
                  />
                </div>
              </div>

              {/* L3 Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">L3 Level (Company Name)</label>
                  <input
                    type="text"
                    value={bidForm.l3_level}
                    onChange={(e) => setBidForm({ ...bidForm, l3_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">L3 Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bidForm.l3_price}
                    onChange={(e) => setBidForm({ ...bidForm, l3_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter price"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBidOpened}
                disabled={isSaving}
                className="px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
