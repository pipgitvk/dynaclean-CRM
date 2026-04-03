"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const emptyForm = () => ({
  username: "",
  target: "",
  target_start_date: "",
  target_end_date: "",
});

export default function AssignTargetModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState(emptyForm);
  const [usernames, setUsernames] = useState([]);
  const [allUsernames, setAllUsernames] = useState([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(emptyForm());
    setMessage("");
    setSubmitting(false);
    let cancelled = false;
    (async () => {
      try {
        const resUsers = await fetch("/api/target-usrname");
        if (!resUsers.ok) throw new Error("Failed to fetch usernames.");
        const users = await resUsers.json();
        if (!cancelled) {
          setAllUsernames(users);
          setUsernames(users);
        }
      } catch (error) {
        if (!cancelled) setMessage("Error loading users. Try again.");
        console.error(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchAvailableUsers = async () => {
      if (formData.target_start_date && formData.target_end_date) {
        try {
          const resUsers = await fetch(
            `/api/target-usrname?startDate=${formData.target_start_date}&endDate=${formData.target_end_date}`
          );
          if (!resUsers.ok) throw new Error("Failed to fetch available usernames.");
          const users = await resUsers.json();
          setUsernames(users);
          setFormData((prev) =>
            prev.username && !users.includes(prev.username)
              ? { ...prev, username: "" }
              : prev
          );
        } catch (error) {
          console.error("Error fetching available users:", error);
        }
      } else {
        setUsernames(allUsernames);
      }
    };
    fetchAvailableUsers();
  }, [isOpen, formData.target_start_date, formData.target_end_date, allUsernames]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Submitting...");
    setSubmitting(true);
    try {
      const response = await fetch("/api/assign-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage("");
        onSuccess?.();
        onClose();
      } else {
        setMessage(data.message || "Something went wrong.");
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
      console.error("Submission error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close modal"
        onClick={() => !submitting && onClose()}
      />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-target-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="assign-target-title" className="text-2xl font-extrabold text-gray-800">
            Assign Target
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg p-3 text-center text-sm font-medium ${
              message === "Submitting..."
                ? "bg-gray-100 text-gray-800"
                : "bg-red-600 text-white"
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">Start Date</label>
            <input
              type="date"
              name="target_start_date"
              value={formData.target_start_date}
              onChange={handleChange}
              required
              disabled={submitting}
              className="w-full rounded-lg border border-gray-600 px-4 py-3 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">End Date</label>
            <input
              type="date"
              name="target_end_date"
              value={formData.target_end_date}
              onChange={handleChange}
              required
              disabled={submitting}
              className="w-full rounded-lg border border-gray-600 px-4 py-3 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">Username</label>
            <select
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={submitting || !formData.target_start_date || !formData.target_end_date}
              className="w-full rounded-lg border border-gray-800 px-4 py-3 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="" disabled>
                {!formData.target_start_date || !formData.target_end_date
                  ? "Please select dates first"
                  : usernames.length === 0
                    ? "No users available for this period"
                    : "Select user"}
              </option>
              {usernames.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {formData.target_start_date &&
              formData.target_end_date &&
              usernames.length === 0 && (
                <p className="mt-1 text-sm text-orange-600">
                  All users already have targets for this period.
                </p>
              )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">Target Amount</label>
            <input
              type="number"
              name="target"
              value={formData.target}
              onChange={handleChange}
              placeholder="Enter target amount"
              min="1"
              step="any"
              required
              disabled={submitting}
              className="w-full rounded-lg border border-gray-600 px-4 py-3 disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gray-600 px-4 py-3 text-lg font-bold text-white hover:bg-gray-700 disabled:opacity-60"
          >
            Assign Target
          </button>
        </form>
      </div>
    </div>
  );
}
