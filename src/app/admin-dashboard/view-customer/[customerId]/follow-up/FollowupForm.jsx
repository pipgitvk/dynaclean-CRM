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
  const [customerCreatedAt, setCustomerCreatedAt] = useState(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
  const [hasOrder, setHasOrder] = useState(false);

  const statusList = ["Very Good", "Average", "Poor", "Denied", "Invalid"];
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

  // ✅ Get min and max datetime for last 24 hours (in IST)
  const getFollowedDateLimits = () => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      min: formatISTDateTime(twentyFourHoursAgo),
      max: formatISTDateTime(now),
    };
  };

  const followedDateLimits = getFollowedDateLimits();

  // Calculate min/max for Next Follow-up Date based on lead age (from customer creation date) and stage
  // If stage is "Won (Order Received)" → max 15 days from now
  // If customer has an order → max 15 days from now (skip validation)
  // < 7 days old  → max 48 hours from now
  // >= 7 days old → max 15 days from now
  const getNextFollowupDateLimits = () => {
    const now = new Date();
    const minDate = formatISTDateTime(now);

    // If customer already has an order, allow 15 days (skip the 7-day restriction)
    if (hasOrder) {
      const maxDate = formatISTDateTime(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000));
      return { min: minDate, max: maxDate, isNewLead: false };
    }

    // If stage is "Won (Order Received)", allow 15 days
    if (formData.stage === "Won (Order Received)") {
      const maxDate = formatISTDateTime(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000));
      return { min: minDate, max: maxDate, isNewLead: false };
    }

    if (customerCreatedAt) {
      const createdDate = new Date(customerCreatedAt);
      const leadAgeInDays = (now - createdDate) / (1000 * 60 * 60 * 24);

      if (leadAgeInDays < 7) {
        // Fresh lead: restrict to 48 hours max
        const maxDate = formatISTDateTime(new Date(now.getTime() + 48 * 60 * 60 * 1000));
        return { min: minDate, max: maxDate, isNewLead: true };
      } else {
        // Old lead: allow up to 15 days
        const maxDate = formatISTDateTime(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000));
        return { min: minDate, max: maxDate, isNewLead: false };
      }
    }

    // Still loading — apply strict 48 hour fallback so no one can bypass during load
    const maxDate = formatISTDateTime(new Date(now.getTime() + 48 * 60 * 60 * 1000));
    return { min: minDate, max: maxDate, isNewLead: true };
  };

  const nextFollowupDateLimits = getNextFollowupDateLimits();

  useEffect(() => {
    const now = new Date();
    setFormData((prevData) => ({
      ...prevData,
      followed_date: formatISTDateTime(now),
      next_followup_date: formatISTDateTime(now),
    }));
  }, []);

  // Filter stages based on customer's current stage from database
  // Fetch customer's current stage and date_created from database
  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}`);
        if (response.ok) {
          const data = await response.json();
          setCustomerCurrentStage(data.stage || "New");
          setCustomerCreatedAt(data.date_created || null);
          setHasOrder(data.has_order === 1 || data.has_order === true);
          setFormData(prev => ({
            ...prev,
            stage: data.stage || "New"
          }));
        }
      } catch (error) {
        console.error("Error fetching customer data:", error);
        setCustomerCurrentStage("New");
      } finally {
        setIsLoadingCustomer(false);
      }
    };

    if (customerId) {
      fetchCustomerData();
    }
  }, [customerId]);

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
    const { name, value } = e.target;

    if (name === "next_followup_date" && value) {
      const limits = getNextFollowupDateLimits();
      const selected = new Date(value);
      const minDate = new Date(limits.min);
      const maxDate = limits.max ? new Date(limits.max) : null;

      if (selected < minDate) {
        toast.error("Cannot select a past date.");
        return;
      }

      if (maxDate && selected > maxDate) {
        if (limits.isNewLead) {
          toast.error("This lead is less than 7 days old — you can only schedule a follow-up within the next 48 hours.");
        } else {
          toast.error("You can schedule a follow-up for a maximum of 15 days from now.");
        }
        // Clamp to max allowed value
        setFormData({ ...formData, [name]: limits.max });
        return;
      }
    }

    setFormData({ ...formData, [name]: value });
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

    // Final validation for next_followup_date before submitting
    if (formData.status !== "Denied" && formData.status !== "Invalid" && formData.next_followup_date) {
      const limits = getNextFollowupDateLimits();
      const selected = new Date(formData.next_followup_date);
      const maxDate = limits.max ? new Date(limits.max) : null;

      if (maxDate && selected > maxDate) {
        if (limits.isNewLead) {
          toast.error("This lead is less than 7 days old — you can only schedule a follow-up within the next 48 hours.");
        } else {
          toast.error("You can schedule a follow-up for a maximum of 15 days from now.");
        }
        return;
      }
    }

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
          Followed Date (IST) <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          name="followed_date"
          value={formData.followed_date}
          onChange={handleChange}
          min={followedDateLimits.min}
          max={followedDateLimits.max}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          You can only select dates from the last 24 hours
        </p>
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

      {/* Next Follow-up Date - Hide when status is Denied or Invalid */}
      {formData.status !== "Denied" && formData.status !== "Invalid" && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Next Follow-up Date (IST)
          </label>
          <input
            type="datetime-local"
            name="next_followup_date"
            value={formData.next_followup_date}
            onChange={handleChange}
            min={nextFollowupDateLimits.min}
            max={nextFollowupDateLimits.max}
            disabled={isLoadingCustomer}
            className={`w-full px-4 py-2 border rounded-lg ${isLoadingCustomer ? "bg-gray-100 cursor-not-allowed" : ""}`}
            required
          />
          <p className="mt-1 text-xs text-red-500">
            {isLoadingCustomer
              ? "Loading lead information..."
              : formData.stage === "Won (Order Received)"
              ? "Stage is Won (Order Received) — you can schedule a follow-up for a maximum of 15 days from now."
              : hasOrder
              ? "Order exists for this customer — you can schedule a follow-up for a maximum of 15 days from now."
              : nextFollowupDateLimits.isNewLead
              ? "This lead is less than 7 days old — you can only schedule a follow-up within the next 48 hours."
              : "This lead is older than 7 days — you can schedule a follow-up for a maximum of 15 days from now."}
          </p>
        </div>
      )}

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
