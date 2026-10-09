"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  mysqlDatetimeToDatetimeLocalValue,
  datetimeLocalToMysql,
} from "./regularizationUtils";

export default function AttendanceRegularizeModal({
  open,
  log,
  logDateKey,
  onClose,
  onSubmitted,
  /** When set (e.g. EMPCRM admin acting for an employee), sent as for_username. */
  forUsername,
}) {
  const [reason, setReason] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (!open || !log) return;
    setCheckin(mysqlDatetimeToDatetimeLocalValue(log.checkin_time));
    setCheckout(mysqlDatetimeToDatetimeLocalValue(log.checkout_time));
    setReason("");
    setFile(null);
    setFileInputKey((k) => k + 1);
  }, [open, log]);

  if (!open || !log) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const r = reason.trim();
    if (!r) {
      toast.error("Reason is required.");
      return;
    }

    const checkinMysql = datetimeLocalToMysql(checkin);
    const checkoutMysql = datetimeLocalToMysql(checkout);
    if (log.type === "absent" && (!checkinMysql || !checkoutMysql)) {
      toast.error("For an absent day, check-in and check-out are required.");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("log_date", logDateKey);
      if (forUsername && String(forUsername).trim()) {
        fd.append("for_username", String(forUsername).trim());
      }
      fd.append("reason", r);
      fd.append(
        "checkin_time",
        checkinMysql ?? ""
      );
      fd.append(
        "checkout_time",
        checkoutMysql ?? ""
      );
      if (file) {
        fd.append("attachment", file);
      }

      const res = await fetch("/api/attendance/regularization", {
        method: "POST",
        body: fd,
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
            {forUsername ? (
              <>
                {" "}
                · Employee:{" "}
                <span className="font-medium text-gray-900">{forUsername}</span>
              </>
            ) : null}
            . Set check-in and check-out. For a missed day, both times are
            required. The reporting manager must approve before the attendance
            log is created or updated.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Check-in
            </label>
            <input
              type="datetime-local"
              value={checkin}
              onChange={(e) => setCheckin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Check-out
            </label>
            <input
              type="datetime-local"
              value={checkout}
              onChange={(e) => setCheckout(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason <span className="text-red-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Why are you correcting this day?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Attachment (optional)
            </label>
            <input
              key={fileInputKey}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-teal-50 file:text-teal-800"
            />
            <p className="mt-1 text-xs text-gray-500">
              PDF, JPG, PNG, or WebP — max 5 MB (optional)
            </p>
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
