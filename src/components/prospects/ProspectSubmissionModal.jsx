"use client";

import { useState } from "react";
import { X, Upload, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function ProspectSubmissionModal({ open, onClose, reportingManager }) {
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please upload a PDF or image file.");
      return;
    }
    if (!reportingManager) {
      toast.error("Reporting manager is not assigned.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("notes", notes);
      formData.append("pdf", file);

      const res = await fetch("/api/prospect-submissions", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit prospect");
      }

      toast.success(data.message || "Prospect submitted successfully.");
      setNotes("");
      setFile(null);
      onClose?.();
    } catch (error) {
      toast.error(error.message || "Failed to submit prospect");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Submit Prospect</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sent to reporting manager: {reportingManager || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              PDF / Image
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 hover:border-blue-400 hover:bg-blue-50/40">
              <Upload className="h-5 w-5 text-blue-600" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {file ? file.name : "Choose PDF or image"}
                </p>
                <p className="text-xs text-gray-500">
                  PDF, JPG, PNG, WEBP — uploaded to Cloudinary
                </p>
              </div>
              <input
                type="file"
                accept="application/pdf,.pdf,image/*,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this prospect..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !reportingManager}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit Prospect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
