"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Save, X } from "lucide-react";

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
  console.log("customer Data in Tl follow", customerData);

  const [formData, setFormData] = useState({
    estimated_order_date: "",
    lead_quality_score: "",
    multi_tag: [],
    status: "",
    notes: "",
    followed_date: (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    })(),
    next_followup_date: "",
    assigned_employee: customerData?.lead_source || "",
    stage: "New",
  });

  const statusOptions = ["Very Good", "Average", "Poor", "Denied"];
  const tagOptions = [
    "Demo",
    "Prime",
    "Repeat order",
    "Mail",
    "Running Orders",
    "N/A",
  ];
  const stageOptions = [
    "New",
    "Contacted",
    "Interested",
    "Demo Scheduled",
    "Demo Completed",
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

    setFormData((prev) => ({
      ...prev,
      estimated_order_date: latestfollowup.estimated_order_date || "",
      lead_quality_score: latestfollowup.lead_quality_score || "",
      status: latestfollowup.status || "",
      notes: latestfollowup.notes || "",
      next_followup_date: latestfollowup.next_followup_date
        ? latestfollowup.next_followup_date
        : "",
      stage: latestfollowup.stage || prev.stage,
      multi_tag: latestfollowup.multi_tag
        ? latestfollowup.multi_tag.split(",").map((t) => t.trim())
        : [],
      assigned_employee:
        latestfollowup.assigned_employee || prev.assigned_employee,
    }));
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
          // Remove tag if already selected
          newTags = newTags.filter((t) => t !== tag);
        } else {
          // Add tag
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
              Estimated Order Date
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
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((tag) => (
                <label
                  key={tag}
                  className={`inline-flex items-center px-4 py-2 rounded-md cursor-pointer transition-colors ${
                    formData.multi_tag.includes(tag)
                      ? tag === "N/A"
                        ? "bg-gray-500 text-white"
                        : "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
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
