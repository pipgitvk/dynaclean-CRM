"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RepUpdateForm({ initialPassword, username }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState(initialPassword);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setStatusMessage("");

    try {
      const response = await fetch(`/api/update-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, newPassword }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatusMessage("✅ Password updated successfully!");
        // Redirect to the admin dashboard on success
        router.push("/admin-dashboard/employees");
      } else {
        setStatusMessage(`❌ Error: ${result.error || "Update failed."}`);
      }
    } catch (error) {
      console.error("API call failed:", error);
      setStatusMessage("❌ Network error. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <form onSubmit={handleUpdate} className="space-y-6">
      <div className="mb-4">
        <label
          htmlFor="new-password"
          className="block text-sm font-medium text-gray-700"
        >
          New Password
        </label>
        <input
          id="new-password"
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isUpdating}
          className={`w-full py-2 px-4 rounded-md font-semibold transition-colors duration-200 ${
            isUpdating
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {isUpdating ? "Updating..." : "Update Password"}
        </button>
      </div>

      {statusMessage && (
        <p
          className={`mt-4 text-center font-semibold ${
            statusMessage.includes("✅") ? "text-green-600" : "text-red-600"
          }`}
        >
          {statusMessage}
        </p>
      )}
    </form>
  );
}
