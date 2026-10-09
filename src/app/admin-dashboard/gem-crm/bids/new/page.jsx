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
  Building2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";

export default function NewBidPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [bidNumberStatus, setBidNumberStatus] = useState(null); // null, 'checking', 'exists', 'available'
  const [bidNumberMessage, setBidNumberMessage] = useState("");
  const [checkingBidNumber, setCheckingBidNumber] = useState(false);
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
    bid_value: "",
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
    assigned_employee_id: "",
    dd_id: "",
    remarks: "",
    bid_document: null,
    ra_participated: "no",
    ra_start_date: "",
    ra_end_date: "",
    customer_id: "",
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

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

  // Check if bid number already exists
  const checkBidNumberAvailability = async (bidNumber) => {
    if (!bidNumber || bidNumber.trim() === "") {
      setBidNumberStatus(null);
      setBidNumberMessage("");
      return;
    }

    setCheckingBidNumber(true);
    setBidNumberStatus("checking");
    try {
      const res = await fetch(`/api/gem-crm/bids/check-duplicate?bid_number=${encodeURIComponent(bidNumber)}`);
      const data = await res.json();
      
      if (data.exists) {
        setBidNumberStatus("exists");
        setBidNumberMessage(`Bid number already exists in the system`);
      } else {
        setBidNumberStatus("available");
        setBidNumberMessage("");
      }
    } catch (error) {
      console.error("Error checking bid number:", error);
      setBidNumberStatus(null);
      setBidNumberMessage("");
    } finally {
      setCheckingBidNumber(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === "file") {
      setFormData((prev) => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      
      // Check for duplicate bid number when it changes
      if (name === "bid_number") {
        checkBidNumberAvailability(value);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if bid number is duplicate
    if (bidNumberStatus === "exists") {
      toast.error("This bid number already exists. Please use a different bid number.");
      return;
    }

    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== "") {
          formDataToSend.append(key, formData[key]);
        }
      });

      const res = await fetch("/api/gem-crm/bids", {
        method: "POST",
        body: formDataToSend,
      });

      const result = await res.json();
      if (result.success) {
        toast.success("Bid created successfully");
        router.push("/admin-dashboard/gem-crm/bids");
      } else {
        toast.error(result.error || "Failed to create bid");
      }
    } catch (error) {
      console.error("Error creating bid:", error);
      toast.error("Error creating bid");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Bid</h1>
          <p className="text-gray-600 mt-1">Add a new government tender/bid</p>
        </div>
        <button
          onClick={() => router.push("/admin-dashboard/gem-crm/bids")}
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
                <div className="relative">
                  <input
                    type="text"
                    name="bid_number"
                    value={formData.bid_number}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      bidNumberStatus === "exists" 
                        ? "border-red-500 focus:ring-red-500" 
                        : bidNumberStatus === "available" 
                        ? "border-green-500 focus:ring-green-500" 
                        : "border-gray-300"
                    }`}
                    required
                  />
                  {checkingBidNumber && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                  {bidNumberStatus === "exists" && !checkingBidNumber && (
                    <AlertCircle className="absolute right-3 top-2.5 w-5 h-5 text-red-500" />
                  )}
                  {bidNumberStatus === "available" && !checkingBidNumber && (
                    <CheckCircle className="absolute right-3 top-2.5 w-5 h-5 text-green-500" />
                  )}
                </div>
                {bidNumberStatus === "exists" && (
                  <p className="text-sm text-red-600 mt-1">⚠️ {bidNumberMessage}</p>
                )}
                {bidNumberStatus === "available" && (
                  <p className="text-sm text-green-600 mt-1">✓ Bid number is available</p>
                )}
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
                  Customer ID (GEM ID)
                </label>
                <input
                  type="text"
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter customer GEM ID"
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
                  Bid Document
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
                </div>
                <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX (Max 10MB)</p>
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
                  Bid Value (₹)
                </label>
                <input
                  type="number"
                  name="bid_value"
                  value={formData.bid_value}
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

          {/* Assignment & Requirements */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Assignment & Requirements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  RA Participated
                </label>
                <select
                  name="ra_participated"
                  value={formData.ra_participated}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              {formData.ra_participated === "yes" && (
                <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">RA Participation Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        RA Start Date *
                      </label>
                      <input
                        type="date"
                        name="ra_start_date"
                        value={formData.ra_start_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        RA End Date *
                      </label>
                      <input
                        type="date"
                        name="ra_end_date"
                        value={formData.ra_end_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

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

              <div className="md:col-span-2">
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
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.push("/admin-dashboard/gem-crm/bids")}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || bidNumberStatus === "exists"}
            title={bidNumberStatus === "exists" ? "Cannot submit - bid number already exists" : ""}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isLoading ? "Creating..." : "Create Bid"}
          </button>
        </div>
      </form>
    </div>
  );
}
