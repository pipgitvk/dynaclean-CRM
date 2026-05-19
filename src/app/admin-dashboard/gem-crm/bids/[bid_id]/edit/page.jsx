"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  X,
  Upload,
  FileText,
  DollarSign,
  Calendar,
  User,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";

export default function EditBidPage({ params }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [bidId, setBidId] = useState(null);
  const [formData, setFormData] = useState({
    bidding_platform: "",
    bid_number: "",
    gem_bid_no: "",
    bid_title: "",
    bid_link: "",
    item_category: "",
    organisation_id: "",
    bid_start_date: "",
    bid_end_date: "",
    bid_open_date: "",
    bid_validity_days: "",
    model_id: "",
    specification: "",
    total_quantity: "",
    bid_type: "",
    evaluation_method: "",
    estimated_bid_value: "",
    emd_required: "no",
    emd_amount: "",
    epbg_percentage: "",
    epbg_duration_months: "",
    reverse_auction: "no",
    turnover_required: "",
    oem_turnover_required: "",
    experience_required_years: "",
    delivery_days: "",
    inspection_required: "no",
    technical_status: "pending",
    financial_status: "pending",
    bid_status: "new",
    assigned_employee_id: "",
    dd_id: "",
    remarks: "",
    bid_document: null,
  });

  useEffect(() => {
    // Handle async params in Next.js 15+
    const resolveParams = async () => {
      const resolvedParams = await params;
      setBidId(resolvedParams.bid_id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (bidId) {
      fetchBidDetails();
      fetchEmployees();
    }
  }, [bidId]);

  const fetchBidDetails = async () => {
    try {
      const res = await fetch(`/api/gem-crm/bids/${bidId}`);
      const result = await res.json();
      if (result.success) {
        const bid = result.data;
        
        console.log("DEBUG: Raw bid data dates:", {
          bid_start_date: bid.bid_start_date,
          bid_end_date: bid.bid_end_date,
          bid_open_date: bid.bid_open_date
        });
        
        // Helper function to format date for date input
        const formatDateForInput = (dateStr) => {
          console.log("DEBUG: Formatting date:", dateStr, "Type:", typeof dateStr);
          if (!dateStr) return "";
          
          let date;
          // Try parsing the date string
          if (typeof dateStr === 'string') {
            // Handle various date formats
            date = new Date(dateStr);
            // If invalid, try parsing manually for YYYY-MM-DD format
            if (isNaN(date.getTime())) {
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                date = new Date(parts[0], parts[1] - 1, parts[2]);
              }
            }
          } else {
            date = new Date(dateStr);
          }
          
          if (isNaN(date.getTime())) {
            console.log("Invalid date:", dateStr);
            return "";
          }
          
          // Format as YYYY-MM-DD
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const formatted = `${year}-${month}-${day}`;
          console.log("DEBUG: Formatted date:", formatted);
          return formatted;
        };
        
        const formattedStartDate = formatDateForInput(bid.bid_start_date);
        const formattedEndDate = formatDateForInput(bid.bid_end_date);
        const formattedOpenDate = formatDateForInput(bid.bid_open_date);
        
        console.log("DEBUG: Formatted dates:", {
          formattedStartDate,
          formattedEndDate,
          formattedOpenDate
        });
        
        setFormData({
          bidding_platform: bid.bidding_platform || "",
          bid_number: bid.bid_number || "",
          gem_bid_no: bid.gem_bid_no || "",
          bid_title: bid.bid_title || "",
          bid_link: bid.bid_link || "",
          item_category: bid.item_category || "",
          organisation_id: bid.organisation_id || "",
          bid_start_date: formattedStartDate,
          bid_end_date: formattedEndDate,
          bid_open_date: formattedOpenDate,
          bid_validity_days: bid.bid_validity_days || "",
          model_id: bid.model_id || "",
          specification: bid.specification || "",
          total_quantity: bid.total_quantity || "",
          bid_type: bid.bid_type || "",
          evaluation_method: bid.evaluation_method || "",
          estimated_bid_value: bid.estimated_bid_value || "",
          emd_required: bid.emd_required || "no",
          emd_amount: bid.emd_amount || "",
          epbg_percentage: bid.epbg_percentage || "",
          epbg_duration_months: bid.epbg_duration_months || "",
          reverse_auction: bid.reverse_auction || "no",
          turnover_required: bid.turnover_required || "",
          oem_turnover_required: bid.oem_turnover_required || "",
          experience_required_years: bid.experience_required_years || "",
          delivery_days: bid.delivery_days || "",
          inspection_required: bid.inspection_required || "no",
          technical_status: bid.technical_status || "pending",
          financial_status: bid.financial_status || "pending",
          bid_status: bid.bid_status || "new",
          assigned_employee_id: bid.assigned_employee_id || "",
          dd_id: bid.dd_id || "",
          remarks: bid.remarks || "",
          bid_document: null,
        });
      } else {
        toast.error("Failed to fetch bid details");
      }
    } catch (error) {
      console.error("Error fetching bid details:", error);
      toast.error("Error fetching bid details");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/gem-crm/employees");
      const result = await res.json();
      if (result.success) {
        setEmployees(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === "file") {
      setFormData((prev) => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== "") {
          formDataToSend.append(key, formData[key]);
        }
      });

      const res = await fetch(`/api/gem-crm/bids/${bidId}`, {
        method: "PUT",
        body: formDataToSend,
      });

      const result = await res.json();
      if (result.success) {
        toast.success("Bid updated successfully");
        router.push(`/admin-dashboard/gem-crm/bids/${bidId}`);
      } else {
        toast.error(result.error || "Failed to update bid");
      }
    } catch (error) {
      console.error("Error updating bid:", error);
      toast.error("Error updating bid");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Bid</h1>
          <p className="text-gray-600 mt-1">Update bid information</p>
        </div>
        <button
          onClick={() => router.push(`/admin-dashboard/gem-crm/bids/${params.bid_id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bidding Platform *
                </label>
                <select
                  name="bidding_platform"
                  value={formData.bidding_platform}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Platform</option>
                  <option value="GEM">GEM</option>
                  <option value="E Procurement">E Procurement</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid Number *
                </label>
                <input
                  type="text"
                  name="bid_number"
                  value={formData.bid_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GEM Bid No
                </label>
                <input
                  type="text"
                  name="gem_bid_no"
                  value={formData.gem_bid_no}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid Title *
                </label>
                <input
                  type="text"
                  name="bid_title"
                  value={formData.bid_title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid Link
                </label>
                <input
                  type="url"
                  name="bid_link"
                  value={formData.bid_link}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Category
                </label>
                <input
                  type="text"
                  name="item_category"
                  value={formData.item_category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organisation ID
                </label>
                <input
                  type="number"
                  name="organisation_id"
                  value={formData.organisation_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Replace Bid Document
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    name="bid_document"
                    onChange={handleChange}
                    accept=".pdf,.doc,.docx"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <Upload className="w-5 h-5 text-gray-400" />
                  {bid && bid.bid_document && (
                    <a
                      href={bid.bid_document}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Document"
                    >
                      <Eye className="w-5 h-5" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Leave empty to keep existing document</p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid Status
                </label>
                <select
                  name="bid_status"
                  value={formData.bid_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Technical Status
                </label>
                <select
                  name="technical_status"
                  value={formData.technical_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="qualified">Qualified</option>
                  <option value="disqualified">Disqualified</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Financial Status
                </label>
                <select
                  name="financial_status"
                  value={formData.financial_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="qualified">Qualified</option>
                  <option value="disqualified">Disqualified</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status Change Remarks
                </label>
                <input
                  type="text"
                  name="status_remarks"
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Reason for status change"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Important Dates
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid Start Date
                </label>
                <input
                  type="date"
                  name="bid_start_date"
                  value={formData.bid_start_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid End Date
                </label>
                <input
                  type="date"
                  name="bid_end_date"
                  value={formData.bid_end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid Open Date
                </label>
                <input
                  type="date"
                  name="bid_open_date"
                  value={formData.bid_open_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid Validity Days
                </label>
                <input
                  type="number"
                  name="bid_validity_days"
                  value={formData.bid_validity_days}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Financial Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Bid Value (₹)
                </label>
                <input
                  type="number"
                  name="estimated_bid_value"
                  value={formData.estimated_bid_value}
                  onChange={handleChange}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  EMD Required
                </label>
                <select
                  name="emd_required"
                  value={formData.emd_required}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              {formData.emd_required === "yes" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    EMD Amount (₹)
                  </label>
                  <input
                    type="number"
                    name="emd_amount"
                    value={formData.emd_amount}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  EPBG Percentage
                </label>
                <input
                  type="number"
                  name="epbg_percentage"
                  value={formData.epbg_percentage}
                  onChange={handleChange}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  EPBG Duration (Months)
                </label>
                <input
                  type="number"
                  name="epbg_duration_months"
                  value={formData.epbg_duration_months}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Assignment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Employee
                </label>
                <select
                  name="assigned_employee_id"
                  value={formData.assigned_employee_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.empId} value={emp.empId}>
                      {emp.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link DD/BG
                </label>
                <input
                  type="number"
                  name="dd_id"
                  value={formData.dd_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter DD/BG ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Quantity
                </label>
                <input
                  type="number"
                  name="total_quantity"
                  value={formData.total_quantity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Days
                </label>
                <input
                  type="number"
                  name="delivery_days"
                  value={formData.delivery_days}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experience Required (Years)
                </label>
                <input
                  type="number"
                  name="experience_required_years"
                  value={formData.experience_required_years}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reverse Auction
                </label>
                <select
                  name="reverse_auction"
                  value={formData.reverse_auction}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inspection Required
                </label>
                <select
                  name="inspection_required"
                  value={formData.inspection_required}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.push(`/admin-dashboard/gem-crm/bids/${params.bid_id}`)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
