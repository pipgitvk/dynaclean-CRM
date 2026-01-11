"use client";

import { useState } from "react";

export default function AssignServiceForm({
  engineers,
  serviceId,
  updateServiceAssignment,
  message,
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(message || "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPending(true);
    setFeedback("");

    const formData = new FormData(e.target);
    const result = await updateServiceAssignment(formData);

    if (result.error) {
      setFeedback(result.error);
    } else if (result.success && result.redirectTo) {
      window.location.href = result.redirectTo;
    }

    setPending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {feedback && (
        <div
          className={`${
            feedback.includes("error")
              ? "bg-red-100 border-red-500 text-red-700"
              : "bg-green-100 border-green-500 text-green-700"
          } border-l-4 p-4`}
          role="alert"
        >
          <p>{feedback}</p>
        </div>
      )}

      <input type="hidden" name="service_id" value={serviceId} />

      <div>
        <label
          htmlFor="service_id_display"
          className="block text-sm font-medium text-gray-700"
        >
          Service ID:
        </label>
        <input
          type="text"
          id="service_id_display"
          defaultValue={serviceId}
          readOnly
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="assigned_to"
          className="block text-sm font-medium text-gray-700"
        >
          New Assigned To:
        </label>
        <select
          id="assigned_to"
          name="assigned_to"
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="" disabled>
            Select a Service Engineer
          </option>
          {engineers.length > 0 ? (
            engineers.map((engineer) => (
              <option key={engineer} value={engineer}>
                {engineer}
              </option>
            ))
          ) : (
            <option disabled>No service engineers found</option>
          )}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer"
      >
        {pending ? "Updating..." : "Update Record"}
      </button>
    </form>
  );
}
