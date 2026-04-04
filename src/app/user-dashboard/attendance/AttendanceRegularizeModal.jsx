"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  mysqlDatetimeToDatetimeLocalValue,
  datetimeLocalToMysql,
} from "./regularizationUtils";

const TIME_FIELDS = [
  { key: "checkin_time", label: "Check-in" },
  { key: "checkout_time", label: "Check-out" },
  { key: "break_morning_start", label: "Morning break start" },
  { key: "break_morning_end", label: "Morning break end" },
  { key: "break_lunch_start", label: "Lunch start" },
  { key: "break_lunch_end", label: "Lunch end" },
  { key: "break_evening_start", label: "Evening break start" },
  { key: "break_evening_end", label: "Evening break end" },
];

export default function AttendanceRegularizeModal({
  open,
  log,
  logDateKey,
  onClose,
  onSubmitted,
}) {
  const [reason, setReason] = useState("");
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !log) return;
    const next = {};
    for (const { key } of TIME_FIELDS) {
      next[key] = mysqlDatetimeToDatetimeLocalValue(log[key]);
    }
    setValues(next);
    setReason("");
  }, [open, log]);

  if (!open || !log) return null;

  const handleChange = (key, v) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const proposed = {};
      for (const { key } of TIME_FIELDS) {
        proposed[key] = datetimeLocalToMysql(values[key]);
      }
      const res = await fetch("/api/attendance/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_date: logDateKey,
          reason,
          proposed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      toast.success(data.message || "Submitted for manager approval.");
      onSubmitted?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Regularize attendance
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Date:{" "}
            <span className="font-medium text-gray-900">
              {new Date(log.date).toLocaleDateString()}
            </span>
            . Correct the times below. Your reporting manager must approve before
            the attendance log is updated.
          </p>
          {TIME_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}
              </label>
              <input
                type="datetime-local"
                value={values[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Why are you correcting this day?"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Submitting…" : "Submit for approval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
