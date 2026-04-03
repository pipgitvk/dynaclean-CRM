"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { PROFILE_REASSIGN_FIELD_GROUPS } from "@/lib/profileReassignFields";

export default function ReassignFieldsModal({ open, onClose, onConfirm, submitting }) {
  const allKeys = useMemo(
    () => PROFILE_REASSIGN_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key)),
    []
  );
  const [selected, setSelected] = useState(() => new Set());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setNote("");
    }
  }, [open]);

  if (!open) return null;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(allKeys));
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    onConfirm({ fields: [...selected], reassignment_note: note.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Reassign fields to employee</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="px-4 pt-3 text-sm text-gray-600">
          Select the fields that need correction. The employee will see this request and can update their profile and resubmit.
        </p>
        <div className="px-4 py-2 flex gap-2">
          <button type="button" onClick={selectAll} className="text-sm text-blue-600 hover:underline">
            Select all
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={clearAll} className="text-sm text-gray-600 hover:underline">
            Clear
          </button>
        </div>
        <div className="px-4 flex-1 overflow-y-auto border-t border-gray-100 py-3 space-y-4">
          {PROFILE_REASSIGN_FIELD_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{group.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.fields.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggle(key)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-1">Note for employee (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="e.g. Please upload clearer bank proof"
          />
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || submitting}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending…" : "Send to employee"}
          </button>
        </div>
      </div>
    </div>
  );
}
