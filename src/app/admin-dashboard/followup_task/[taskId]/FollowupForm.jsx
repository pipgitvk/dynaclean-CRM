"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import toast from "react-hot-toast";

export default function FollowupForm({ taskId, status }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [notes, setNotes] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file (JPEG, PNG, etc.)");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
    if (imageFile) formData.append("image", imageFile);

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
        <label htmlFor="image" className="block font-medium mb-1">
          Image (Optional)
        </label>
        <input
          ref={fileInputRef}
          id="image"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="w-full border rounded-md p-2 focus:ring focus:border-blue-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-600 file:text-sm"
        />
        {imagePreview && (
          <div className="mt-2 relative inline-block">
            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
            >
              ×
            </button>
          </div>
        )}
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
