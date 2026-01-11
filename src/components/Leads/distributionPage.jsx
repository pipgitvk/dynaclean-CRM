// components/LeadDistributionForm.jsx
"use client"; // This directive marks this file as a Client Component

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";

export default function LeadDistributionForm({ initialReps }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission and page reload
    setIsSubmitting(true);

    const formData = new FormData(event.target);
    const count = parseInt(formData.get("count"), 10); // Ensure count is a number

    const dataToSave = [];
    for (let i = 0; i < count; i++) {
      const username = formData.get(`username_${i}`);
      const priority = formData.get(`priority_${i}`);
      const maxLeads = formData.get(`max_leads_${i}`);

      dataToSave.push({
        username,
        priority: parseInt(priority, 10), // Ensure numbers are parsed as integers
        max_leads: parseInt(maxLeads, 10),
      });
    }

    try {
      const response = await fetch("/api/lead-distribution", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSave), // Send data as JSON
      });

      if (response.ok) {
        toast.success("Lead distribution settings saved successfully! 🎉");
      } else {
        const errorData = await response.json();
        toast.error(
          `Failed to save settings: ${errorData.message || "Unknown error"} 😢`
        );
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("An unexpected error occurred. Please try again. 🚨");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />{" "}
      {/* Toaster component to display toasts */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {initialReps.length > 0 ? (
          initialReps.map((rep, index) => (
            <div
              key={rep.username}
              className="bg-white p-4 rounded shadow text-black"
            >
              <input
                type="hidden"
                name={`username_${index}`}
                value={rep.username}
              />
              <p className="font-semibold mb-2">{rep.username}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Priority</label>
                  <input
                    type="number"
                    name={`priority_${index}`}
                    className="w-full border rounded p-2"
                    required
                    // If you want to pre-fill existing values, fetch them with getReps()
                    // and use defaultValue={rep.priority || ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Max Leads</label>
                  <input
                    type="number"
                    name={`max_leads_${index}`}
                    className="w-full border rounded p-2"
                    required
                    // If you want to pre-fill existing values, fetch them with getReps()
                    // and use defaultValue={rep.max_leads || ''}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-black">No representatives found or loading...</p>
        )}
        <input type="hidden" name="count" value={initialReps.length} />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </>
  );
}
