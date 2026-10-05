"use client";

import { useState } from "react";
import { Eye, Plus, Star } from "lucide-react";
import toast from "react-hot-toast";

const actionIconClass =
  "inline-flex items-center justify-center p-1.5 rounded-md text-white transition-colors";

function hasFollowupSaved(record) {
  return (
    record?.service_followup_at != null &&
    String(record.service_followup_at).trim() !== ""
  );
}

function StarPicker({ value, onChange, disabled }) {
  const current = value == null ? null : Number(value);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs border transition-colors ${
            current === n
              ? "border-amber-400 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          } disabled:opacity-50`}
        >
          {n === 0 ? (
            "0"
          ) : (
            <>
              {n}
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            </>
          )}
        </button>
      ))}
    </div>
  );
}

function FollowupTooltip({ record }) {
  const mail = Number(record.mail_sent) === 1;
  const rating =
    record.service_rating != null && record.service_rating !== ""
      ? Number(record.service_rating)
      : null;
  const feedback = (record.final_feedback_on_call || "").trim();

  return (
    <div className="absolute right-0 bottom-full mb-2 z-50 w-64 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg opacity-0 invisible group-hover/fu:opacity-100 group-hover/fu:visible transition-all pointer-events-none">
      <p className="font-semibold text-slate-900 mb-2">Follow-up details</p>
      <p>
        <span className="text-slate-500">Mail sent:</span>{" "}
        {mail ? "Yes" : "No"}
      </p>
      <p className="mt-1">
        <span className="text-slate-500">Rating:</span>{" "}
        {rating != null && !Number.isNaN(rating) ? `${rating} / 5` : "—"}
      </p>
      <p className="mt-1">
        <span className="text-slate-500">Final feedback on call:</span>
      </p>
      <p className="mt-0.5 whitespace-pre-wrap break-words">
        {feedback || "—"}
      </p>
      {record.service_followup_at && (
        <p className="mt-2 text-[10px] text-slate-400">
          Saved: {new Date(record.service_followup_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function ServiceRecordFollowupActions({
  record,
  onUpdated,
  enabled = true,
}) {
  const [open, setOpen] = useState(false);
  const [mailSent, setMailSent] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!enabled) return null;

  const openModal = () => {
    setMailSent(Number(record.mail_sent) === 1);
    setFeedback(record.final_feedback_on_call || "");
    setRating(
      record.service_rating != null && record.service_rating !== ""
        ? Number(record.service_rating)
        : null
    );
    setOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(
        `/api/service-records/${record.service_id}/followup`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mail_sent: mailSent,
            final_feedback_on_call: feedback,
            service_rating: rating,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to save");
      }
      toast.success("Follow-up saved");
      onUpdated?.(record.service_id, data.record);
      setOpen(false);
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {hasFollowupSaved(record) ? (
        <span className="relative inline-flex group/fu">
          <button
            type="button"
            onClick={openModal}
            title="View / edit follow-up"
            className={`${actionIconClass} bg-teal-600 hover:bg-teal-700`}
          >
            <Eye className="w-4 h-4" />
          </button>
          <FollowupTooltip record={record} />
        </span>
      ) : (
        <button
          type="button"
          onClick={openModal}
          title="Add follow-up (mail / feedback / rating)"
          className={`${actionIconClass} bg-slate-600 hover:bg-slate-700`}
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-5"
            role="dialog"
            aria-labelledby="followup-title"
          >
            <h3 id="followup-title" className="text-lg font-semibold text-gray-900">
              Service follow-up
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Service ID: {record.service_id}
            </p>

            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mailSent}
                  onChange={(e) => setMailSent(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Mail sent
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Final feedback on call
                </label>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Notes from follow-up call…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rating (0–5)
                </label>
                <StarPicker
                  value={rating}
                  onChange={setRating}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || rating == null}
                className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {rating == null && (
              <p className="text-xs text-amber-700 mt-2">Select a rating (0–5) to save.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
