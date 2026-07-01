"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function EditCustomerForm({ initialData, userRole }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [enabled, setEnabled] = useState({
    first_name: false,
    company: false,
    email: false,
    tags: false,
    status: false,
    gstin: false,
    stage: false,
    address: false,
  });
  const [saving, setSaving] = useState(false);
  const [tagsFilter, setTagsFilter] = useState(""); // Add filter state
  const [showTagsDropdown, setShowTagsDropdown] = useState(false); // Show/hide dropdown

  // Use useEffect to update the 'enabled' state based on whether data exists
  // for the tags and status fields, allowing them to be edited by default.
  useEffect(() => {
    setEnabled((prev) => ({
      ...prev,
      tags: !!initialData.tags,
      status: !!initialData.status, 
      stage: !!initialData.stage,
    }));
  }, [initialData]);

  const tagsList = [
    "Facilities Management Company",
    "Industrial Facilities",
    "Commercial Buildings",
    "Healthcare Facilities",
    "Educational Institutions",
    "Government Facilities",
    "Property Management Companies",
    "Construction Company",
    "Transportation Companies",
  ];
  const statusList = ["Very Good", "Average", "Poor", "Denied", "Invalid"];
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

  // Filter tags based on search input
  const filteredTags = tagsList.filter(tag =>
    tag.toLowerCase().includes(tagsFilter.toLowerCase())
  );

  const toggle = (field) =>
    setEnabled((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleChange = (e) => {
    setData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTagSelect = (tag) => {
    setData((prev) => ({ ...prev, tags: tag }));
    setShowTagsDropdown(false);
    setTagsFilter("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/customer/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Customer updated successfully!");
      router.push(`/user-dashboard/view-customer/${data.customer_id}`);
    } else {
      toast.error("Failed to update customer.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {["first_name", "company", "email", "tags", "status", "stage", "gstin", "address"]
        .filter(field => !(userRole === "SERVICE SUPPORT" || userRole === "SERVICE HEAD") || !["tags", "status", "stage"].includes(field))
        .map((field) => (
        <div key={field} className="flex items-center space-x-2">
          <label className="w-24 font-medium capitalize">
            {field.replace("_", " ")}:
          </label>
          {field === "first_name" || field === "company" || field === "email" || field === "gstin" || field === "address" ? (
            <div className="relative flex-1">
              <input
                name={field}
                value={data[field] || ""}
                disabled={!enabled[field]}
                onChange={handleChange}
                className={`w-full border px-3 py-2 rounded ${
                  enabled[field]
                    ? "border-blue-400 bg-white"
                    : "border-gray-200 bg-gray-100"
                }`}
              />
              <button
                type="button"
                onClick={() => toggle(field)}
                className="absolute right-2 top-2 text-gray-500 hover:text-blue-600"
              >
                <Pencil size={18} />
              </button>
            </div>
          ) : field === "tags" ? (
            // Filtered tags dropdown
            <div className="relative flex-1">
              <div
                className={`w-full border px-3 py-2 rounded cursor-pointer ${
                  enabled[field]
                    ? "border-blue-400 bg-white"
                    : "border-gray-200 bg-gray-100"
                }`}
                onClick={() => enabled[field] && setShowTagsDropdown(!showTagsDropdown)}
              >
                {data[field] || "Select"}
              </div>
              
              {/* Dropdown with filter */}
              {showTagsDropdown && enabled[field] && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-gray-300 rounded bg-white shadow-lg z-10">
                  <input
                    type="text"
                    placeholder="Filter tags..."
                    value={tagsFilter}
                    onChange={(e) => setTagsFilter(e.target.value)}
                    className="w-full border-b px-3 py-2 focus:outline-none"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredTags.length > 0 ? (
                      filteredTags.map((tag) => (
                        <div
                          key={tag}
                          onClick={() => handleTagSelect(tag)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                        >
                          {tag}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500">No tags found</div>
                    )}
                  </div>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => toggle(field)}
                className="absolute right-2 top-2 text-gray-500 hover:text-blue-600"
              >
                <Pencil size={18} />
              </button>
            </div>
          ) : (
            // Select fields for status and stage
            <div className="relative flex-1">
              <select
                name={field}
                value={data[field] || ""}
                disabled={!enabled[field]}
                onChange={handleChange}
                className={`w-full border px-3 py-2 rounded ${
                  enabled[field]
                    ? "border-blue-400 bg-white"
                    : "border-gray-200 bg-gray-100"
                }`}
              >
                <option value="" disabled>
                  Select
                </option>
                {(field === "status" ? statusList : stageOptions).map((opt) => (
                  <option value={opt} key={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toggle(field)}
                className="absolute right-2 top-2 text-gray-500 hover:text-blue-600"
              >
                <Pencil size={18} />
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50"
      >
        {saving ? "Saving..." : "Update Customer"}
      </button>
    </form>
  );
}
