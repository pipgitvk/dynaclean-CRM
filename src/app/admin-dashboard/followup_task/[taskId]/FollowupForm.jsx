"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import toast from "react-hot-toast";

export default function FollowupForm({ taskId, status }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const followDate = dayjs().format("YYYY-MM-DDTHH:mm");
    const taskCompletionDate = currentStatus === "Completed" ? followDate : "";

    const formData = new FormData();
    formData.append("taskId", taskId);
    formData.append("notes", notes);
    formData.append("followdate", followDate);
    formData.append("status", currentStatus);
    formData.append("task_completion_date", taskCompletionDate);

    try {
      const res = await fetch(`/api/followup_task/${taskId}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to submit follow-up");

      toast.success("✅ Task follow-up saved successfully!");
      setTimeout(() => {
        router.push("/admin-dashboard?message=followup-success");
      }, 1500);
    } catch (err) {
      toast.error("❌ Failed to save follow-up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white shadow-md rounded-lg p-6 space-y-4 text-gray-800"
    >
      {message && (
        <p className="text-green-600 text-sm font-medium">{message}</p>
      )}
      {error && <p className="text-red-600 text-sm font-medium">{error}</p>}

      <div>
        <label htmlFor="notes" className="block font-medium mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows="4"
          className="w-full border rounded-md p-2 focus:ring focus:border-blue-300"
          required
        />
      </div>

      <div>
        <label className="block font-medium mb-1">Follow-up Time</label>
        <input
          type="text"
          value={dayjs().format("DD MMM YYYY, hh:mm A")}
          className="w-full border rounded-md p-2 bg-gray-100"
          readOnly
        />
      </div>

      <div>
        <label htmlFor="status" className="block font-medium mb-1">
          Status
        </label>
        <select
          id="status"
          value={currentStatus}
          onChange={(e) => setCurrentStatus(e.target.value)}
          className="w-full border rounded-md p-2 focus:ring focus:border-blue-300"
          required
        >
          {["Pending", "Working", "Completed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-40 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition ${
          loading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {loading ? "Saving..." : "Submit Follow-up"}
      </button>
    </form>
  );
}
