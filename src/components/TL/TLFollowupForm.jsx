"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Save, X, Search } from "lucide-react";
import {
  getTlTagOptions,
  getTlMultiTagChipClass,
  normalizeLegacyPostponingTagLabel,
} from "@/utils/tlFollowupTagOptions";

export default function TLFollowupForm({
  customerId,
  customerData,
  latestfollowup,
  isAdmin = false,
  currentStage = "New",
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerCurrentStage, setCustomerCurrentStage] = useState("New");
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [modelSearchInput, setModelSearchInput] = useState("");
  const [selectedModels, setSelectedModels] = useState([]); // Array for multiple products
  console.log("customer Data in Tl follow", customerData);

  // ✅ Format datetime for <input type="datetime-local"> in IST (Asia/Kolkata)
  const formatISTDateTime = (date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  const [formData, setFormData] = useState({
    estimated_order_date: "",
    lead_quality_score: "",
    model: [], // Changed to array for multiple products
    multi_tag: [],
    status: "",
    notes: "",
    followed_date: formatISTDateTime(new Date()),
    next_followup_date: formatISTDateTime(new Date()),
    assigned_employee: customerData?.lead_source || "",
    stage: "New",
  });

  const statusOptions = ["Good", "Very Good", "Average", "Poor", "Denied", "Invalid"];
  const tagOptions = getTlTagOptions();
  const stageOptions = [
    "New",
    "Contacted",
    "Interested",
    "Demo Scheduled",
    "Demo Completed",
    "without GST order",
    "Qualified",
    "Quotation Sent",
    "Quotation Revised",
    "Negotiation / Follow-up",
    "Decision Pending",
    "Won (Order Received)",
    "Lost",
    "Disqualified / Invalid Lead",
  ];

  // Fetch customer's current stage from database
  useEffect(() => {
    const fetchCustomerStage = async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}`);
        if (response.ok) {
          const data = await response.json();
          setCustomerCurrentStage(data.stage || "New");
          setFormData((prev) => ({
            ...prev,
            stage: data.stage || "New",
          }));
        }
      } catch (error) {
        console.error("Error fetching customer stage:", error);
        setCustomerCurrentStage("New");
      }
    };

    if (customerId) {
      fetchCustomerStage();
    }
  }, [customerId]);

  // add alredy filled data of latest followup
  useEffect(() => {
    if (!latestfollowup) return;

    const allowed = new Set(getTlTagOptions());
    const parsedTags = latestfollowup.multi_tag
      ? latestfollowup.multi_tag
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const multi_tag = parsedTags
      .map(normalizeLegacyPostponingTagLabel)
      .filter((t) => allowed.has(t));

    // Parse model field - if it's a comma-separated string, convert to array
    let modelArray = [];
    if (latestfollowup.model) {
      if (typeof latestfollowup.model === 'string') {
        modelArray = latestfollowup.model
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean);
      } else if (Array.isArray(latestfollowup.model)) {
        modelArray = latestfollowup.model;
      }
    }

    setFormData((prev) => ({
      ...prev,
      // estimated_order_date: latestfollowup.estimated_order_date || "",
      lead_quality_score: latestfollowup.lead_quality_score || "",
      model: modelArray,
      status: latestfollowup.status || "",
      notes: latestfollowup.notes || "",
      // Always set next_followup_date to today (current month/year with today's date)
      next_followup_date: formatISTDateTime(new Date()),
      stage: latestfollowup.stage || prev.stage,
      multi_tag,
      assigned_employee:
        latestfollowup.assigned_employee || prev.assigned_employee,
    }));
    setSelectedModels(modelArray);
    setModelSearchInput("");
  }, [latestfollowup]);

  // Filter stages based on customer's current stage from database
  const getAvailableStages = (currentStage) => {
    if (!currentStage) return stageOptions;

    const stageOrder = stageOptions;
    const currentIndex = stageOrder.indexOf(currentStage);

    // For final stages, only allow staying in the same stage or going back
    if (
      currentStage === "Won (Order Received)" ||
      currentStage === "Lost" ||
      currentStage === "Disqualified / Invalid Lead"
    ) {
      return [currentStage];
    }

    // Show current stage and all stages after it (progressive flow)
    return stageOrder.slice(currentIndex);
  };

  const availableStages = getAvailableStages(customerCurrentStage);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Search for product suggestions
  const handleModelSearch = async (searchTerm) => {
    setModelSearchInput(searchTerm);
    
    if (searchTerm.length < 2) {
      setProductSuggestions([]);
      setShowProductSuggestions(false);
      return;
    }

    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setProductSuggestions(data);
        setShowProductSuggestions(true);
      }
    } catch (err) {
      console.error("Error searching products:", err);
    }
  };

  // Handle product selection from suggestions
  const handleSelectProduct = (product) => {
    const productLabel = `${product.item_code} - ${product.item_name}`;
    
    // Add to selectedModels array if not already there
    if (!selectedModels.some(m => m === productLabel)) {
      const newModels = [...selectedModels, productLabel];
      setSelectedModels(newModels);
      setFormData((prev) => ({
        ...prev,
        model: newModels,
      }));
    }
    
    setModelSearchInput("");
    setShowProductSuggestions(false);
    setProductSuggestions([]);
  };

  // Remove a product from the selected list
  const handleRemoveModel = (productLabel) => {
    const newModels = selectedModels.filter((m) => m !== productLabel);
    setSelectedModels(newModels);
    setFormData((prev) => ({
      ...prev,
      model: newModels,
    }));
  };

  const handleTagChange = (tag) => {
    setFormData((prev) => {
      let newTags = [...prev.multi_tag];

      if (tag === "N/A") {
        // If N/A is selected, clear all other tags and set only N/A
        newTags = newTags.includes("N/A") ? [] : ["N/A"];
      } else {
        // If any other tag is selected
        if (newTags.includes("N/A")) {
          // Remove N/A if it exists
          newTags = newTags.filter((t) => t !== "N/A");
        }

        if (newTags.includes(tag)) {
          newTags = newTags.filter((t) => t !== tag);
        } else {
          newTags.push(tag);
        }
      }

      return { ...prev, multi_tag: newTags };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tl-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          ...formData,
          model: formData.model.join(", "), // Convert model array to comma-separated string
          multi_tag: formData.multi_tag.join(", "), // Convert array to comma-separated string
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Navigate based on admin or user context
        const basePath = isAdmin ? "/admin-dashboard" : "/user-dashboard";
        router.push(`${basePath}/tl-customers/${customerId}`);
        router.refresh();
      } else {
        setError(data.error || "Failed to add TL follow-up");
      }
    } catch (err) {
      console.error("Error adding TL follow-up:", err);
      setError("Failed to add TL follow-up");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const basePath = isAdmin ? "/admin-dashboard" : "/user-dashboard";
    router.push(`${basePath}/tl-customers`);
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold text-gray-800">TL Follow-up</h3>
        <button
          onClick={handleCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Followed Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Followed Date <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="followed_date"
              value={formData.followed_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Next Follow-up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Next Follow-up Date
            </label>
            <input
              type="datetime-local"
              name="next_followup_date"
              value={formData.next_followup_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Estimated Order Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1" />
              Estimated Order Date (optional)
            </label>
            <input
              type="date"
              name="estimated_order_date"
              value={formData.estimated_order_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Lead Quality Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead Quality Score (0-10)
            </label>
            <input
              type="number"
              name="lead_quality_score"
              value={formData.lead_quality_score}
              onChange={handleChange}
              min="0"
              max="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Model - Multiple Selection */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Products / Models (Multiple Selection)
            </label>
            
            {/* Selected Products Chips */}
            {selectedModels.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                {selectedModels.map((productLabel, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-full text-sm"
                  >
                    <span>{productLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(productLabel)}
                      className="ml-1 hover:bg-blue-600 rounded-full p-0.5 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <div className="flex items-center border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
                <Search size={16} className="ml-3 text-gray-400" />
                <input
                  type="text"
                  value={modelSearchInput}
                  onChange={(e) => handleModelSearch(e.target.value)}
                  onFocus={() => modelSearchInput.length >= 2 && setShowProductSuggestions(true)}
                  placeholder="Search & add product code or name..."
                  className="flex-1 px-3 py-2 border-0 outline-none focus:ring-0"
                />
              </div>
              
              {/* Product Suggestions Dropdown */}
              {showProductSuggestions && productSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                  {productSuggestions.map((product) => {
                    const productLabel = `${product.item_code} - ${product.item_name}`;
                    const isSelected = selectedModels.includes(productLabel);
                    return (
                      <button
                        key={product.item_code}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className={`w-full text-left px-4 py-2 border-b border-gray-200 last:border-b-0 transition-colors ${
                          isSelected
                            ? "bg-blue-100 hover:bg-blue-200"
                            : "hover:bg-blue-50"
                        }`}
                        disabled={isSelected}
                      >
                        <div className="font-semibold text-gray-800">{product.item_code}</div>
                        <div className="text-sm text-gray-600">{product.item_name}</div>
                        {product.product_number && (
                          <div className="text-xs text-gray-500">Product #: {product.product_number}</div>
                        )}
                        {isSelected && (
                          <div className="text-xs text-blue-600 font-semibold">✓ Added</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* No Results Message */}
              {showProductSuggestions && modelSearchInput.length >= 2 && productSuggestions.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 p-3 text-center text-gray-600">
                  No products found
                </div>
              )}
            </div>

            {/* Hidden input to store model value for form submission */}
            <input
              type="hidden"
              name="model"
              value={formData.model.join(", ")}
            />

            {/* Helper text */}
            <p className="mt-1 text-xs text-gray-500">
              {selectedModels.length > 0
                ? `${selectedModels.length} product(s) selected`
                : "Search and select multiple products"}
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Stage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stage <span className="text-red-500">*</span>
            </label>
            <select
              name="stage"
              value={formData.stage}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Stage</option>
              {availableStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          {/* Multi Tag */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (Multiple Selection)
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {tagOptions.map((tag) => (
                <label
                  key={tag}
                  className={`inline-flex items-center cursor-pointer transition-colors ${
                    formData.multi_tag.includes(tag)
                      ? tag === "N/A"
                        ? "px-4 py-2 rounded-md bg-gray-500 text-white"
                        : getTlMultiTagChipClass(tag, "form")
                      : "px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.multi_tag.includes(tag)}
                    onChange={() => handleTagChange(tag)}
                    className="hidden"
                  />
                  <span className="text-sm font-medium">{tag}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {formData.multi_tag.includes("N/A")
                ? "N/A is selected (no other tags can be selected)"
                : "Select multiple tags. Selecting N/A will clear all others."}
            </p>
          </div>

          {/* Assigned Employee */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned Employee
            </label>
            <input
              type="text"
              name="assigned_employee"
              value={formData.assigned_employee}
              onChange={handleChange}
              placeholder="Employee username"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              readOnly
            />
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Remarks
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="4"
              placeholder="Add your remarks here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
          >
            <Save size={18} />
            {loading ? "Saving..." : "Save Follow-up"}
          </button>
        </div>
      </form>
    </div>
  );
}
