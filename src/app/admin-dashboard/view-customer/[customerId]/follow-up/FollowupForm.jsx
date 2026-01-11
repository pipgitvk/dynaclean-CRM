"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function FollowupForm({ customerId }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    followed_date: "",
    next_followup_date: "",
    notes: "",
    communication_mode: "",
    status: "",
    multi_tag: [],
    stage: "New"
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerCurrentStage, setCustomerCurrentStage] = useState("New");

  const statusList = ["Very Good", "Average", "Poor", "Denied"];
  const tagOptions = ["Demo", "Prime", "Repeat order", "Mail", "Running Orders", "N/A"];
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
    "Disqualified / Invalid Lead"
  ];

  // ✅ Format datetime for <input type="datetime-local"> (IST/local)
  const formatLocalDateTime = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Fetch customer's current stage from database
  useEffect(() => {
    const fetchCustomerStage = async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}`);
        if (response.ok) {
          const data = await response.json();
          setCustomerCurrentStage(data.stage || "New");
          setFormData(prev => ({
            ...prev,
            stage: data.stage || "New"
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

  useEffect(() => {
    const now = new Date();
    setFormData((prevData) => ({
      ...prevData,
      followed_date: formatLocalDateTime(now),
      next_followup_date: formatLocalDateTime(now),
    }));
  }, []);

  // Filter stages based on customer's current stage from database
  const getAvailableStages = (currentStage) => {
    if (!currentStage) return stageOptions;

    const stageOrder = stageOptions;
    const currentIndex = stageOrder.indexOf(currentStage);

    // For final stages, only allow staying in the same stage or going back
    if (currentStage === "Won (Order Received)" || currentStage === "Lost" || currentStage === "Disqualified / Invalid Lead") {
      return [currentStage];
    }

    // Show current stage and all stages after it (progressive flow)
    return stageOrder.slice(currentIndex);
  };

  const availableStages = getAvailableStages(customerCurrentStage);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTagChange = (tag) => {
    setFormData(prev => {
      let newTags = [...prev.multi_tag];

      if (tag === "N/A") {
        // If N/A is selected, clear all other tags and set only N/A
        newTags = newTags.includes("N/A") ? [] : ["N/A"];
      } else {
        // If any other tag is selected
        if (newTags.includes("N/A")) {
          // Remove N/A if it exists
          newTags = newTags.filter(t => t !== "N/A");
        }

        if (newTags.includes(tag)) {
          // Remove tag if already selected
          newTags = newTags.filter(t => t !== tag);
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
    setIsSubmitting(true);

    try {
      // ✅ Send datetime-local values directly (no UTC conversion)
      const payload = {
        ...formData,
        multi_tag: formData.multi_tag.join(", "), // Convert array to comma-separated string
      };

      const res = await fetch(`/api/followup/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Follow-up saved successfully!");
        router.push(`/admin-dashboard/view-customer/${customerId}`);
      } else {
        toast.error("Something went wrong.");
      }
    } catch (error) {
      toast.error("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-gray-700">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Followed Date (IST)
        </label>
        <input
          type="datetime-local"
          name="followed_date"
          value={formData.followed_date}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          name="notes"
          rows={4}
          value={formData.notes}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Communication Mode
        </label>
        <select
          name="communication_mode"
          value={formData.communication_mode}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        >
          <option value="" disabled>
            Select
          </option>
          <option value="Call">Call</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Visit">Visit</option>
          <option value="Email">Email</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        >
          <option value="" disabled>
            Select Status
          </option>
          {statusList.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Stage Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Stage <span className="text-red-500">*</span>
        </label>
        <select
          name="stage"
          value={formData.stage}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        >
          <option value="">Select Stage</option>
          {availableStages.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
      </div>

      {/* Multi-Tag Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags (Multiple Selection)
        </label>
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((tag) => (
            <label
              key={tag}
              className={`inline-flex items-center px-3 py-2 rounded-md cursor-pointer transition-colors ${
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

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Next Follow-up Date (IST)
        </label>
        <input
          type="datetime-local"
          name="next_followup_date"
          value={formData.next_followup_date}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-2 rounded-lg text-white ${
          isSubmitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-gray-600 hover:bg-gray-700"
        }`}
      >
        {isSubmitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
