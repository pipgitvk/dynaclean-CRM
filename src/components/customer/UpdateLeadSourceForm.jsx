"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpdateLeadSourceForm({ initialData, leadSources }) {
  const router = useRouter();
  const [selectedLeadSource, setSelectedLeadSource] = useState(
    initialData.lead_source || ""
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setStatusMessage("");

    try {
      const response = await fetch(
        `/api/customers/${initialData.customer_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lead_source: selectedLeadSource }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setStatusMessage("✅ Lead source updated successfully!");
        router.refresh();
      } else {
        setStatusMessage(
          `❌ Error: ${result.error || "Failed to update lead source."}`
        );
      }
    } catch (error) {
      console.error("Failed to update lead source:", error);
      setStatusMessage("❌ Network error. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-md">
        <p className="font-semibold text-lg mb-2">
          Current Lead Source:{" "}
          <span className="font-normal">{initialData.lead_source}</span>
        </p>
      </div>

      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label
            htmlFor="lead_source_select"
            className="block text-sm font-medium text-gray-700"
          >
            Select New Lead Source
          </label>
          <select
            id="lead_source_select"
            name="lead_source"
            value={selectedLeadSource}
            onChange={(e) => setSelectedLeadSource(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            {leadSources.map((source, index) => (
              <option key={index} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isUpdating}
            className={`px-4 py-2 mb-2 rounded-md text-white font-semibold transition-colors duration-200 ${
              isUpdating
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isUpdating ? "Saving..." : "Save New Lead Source"}
          </button>
        </div>
      </form>

      {statusMessage && (
        <p
          className={`mt-4 text-center font-semibold ${
            statusMessage.includes("✅") ? "text-green-600" : "text-red-600"
          }`}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
}
