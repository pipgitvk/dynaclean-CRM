"use client";

import { useState } from "react";

export default function AssignServiceForm({
  internalEngineers,
  thirdPartyEngineers,
  serviceId,
  updateServiceAssignment,
  message,
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(message || "");
  const [assignToType, setAssignToType] = useState("internal");
  const [selectedEngineer, setSelectedEngineer] = useState("");

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
      <input type="hidden" name="assigned_to_type" value={assignToType} />
      <input type="hidden" name="assigned_to_id" value={assignToType === "third_party" ? selectedEngineer.split("|")[0] : ""} />

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
          htmlFor="assign_type"
          className="block text-sm font-medium text-gray-700"
        >
          Assign To Type:
        </label>
        <select
          id="assign_type"
          value={assignToType}
          onChange={(e) => {
            setAssignToType(e.target.value);
            setSelectedEngineer("");
          }}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="internal">Internal Employee</option>
          <option value="third_party">Third Party Service Engineer</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="assigned_to"
          className="block text-sm font-medium text-gray-700"
        >
          Select {assignToType === "internal" ? "Employee" : "Engineer"}:
        </label>
        <select
          id="assigned_to"
          name="assigned_to"
          value={selectedEngineer}
          onChange={(e) => setSelectedEngineer(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="">-- SELECT --</option>
          {assignToType === "internal" ? (
            internalEngineers.length > 0 ? (
              internalEngineers.map((engineer) => (
                <option key={engineer} value={engineer}>
                  {engineer}
                </option>
              ))
            ) : (
              <option disabled>No internal engineers found</option>
            )
          ) : (
            thirdPartyEngineers.length > 0 ? (
              thirdPartyEngineers.map((engineer) => (
                <option key={engineer.engineer_id} value={`${engineer.engineer_id}|${engineer.name}`}>
                  {engineer.name}
                </option>
              ))
            ) : (
              <option disabled>No third-party engineers found</option>
            )
          )}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending || !selectedEngineer}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Updating..." : "Update Record"}
      </button>
    </form>
  );
}
