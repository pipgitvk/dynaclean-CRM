"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";
import { PhoneCall } from "lucide-react";
import {
  getNextFollowupDateBounds,
  validateNextFollowupDate,
} from "@/lib/manualPaymentFollowupValidation";

function formatDt(value) {
  if (!value) return "—";
  return dayjs(value).format("DD MMM YYYY, hh:mm A");
}

export default function ThirdPartyEngineerFollowupPanel({ engineerId, engineerName }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [followups, setFollowups] = useState([]);
  const [followedDate, setFollowedDate] = useState("");
  const [communicationMode, setCommunicationMode] = useState("Call");
  const [nextFollowupDate, setNextFollowupDate] = useState("");
  const [notes, setNotes] = useState("");

  const { min: nextFollowupMin, max: nextFollowupMax } = getNextFollowupDateBounds();

  const loadFollowups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/third-party-engineers/${engineerId}/followups`);
      if (res.status === 403) {
        toast.error("Access denied");
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load follow-ups");
      }
      const data = await res.json();
      setFollowups(data.followups || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load follow-up history");
    } finally {
      setLoading(false);
    }
  }, [engineerId]);

  useEffect(() => {
    setFollowedDate(dayjs().format("YYYY-MM-DDTHH:mm"));
    loadFollowups();
  }, [loadFollowups]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error("Notes are required");
      return;
    }
    const nextDateCheck = validateNextFollowupDate(nextFollowupDate);
    if (!nextDateCheck.ok) {
      toast.error(nextDateCheck.error);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/third-party-engineers/${engineerId}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followed_date: followedDate,
          communication_mode: communicationMode,
          next_followup_date: nextFollowupDate,
          notes: notes.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save follow-up");
      }
      toast.success("Follow-up saved");
      setNotes("");
      setNextFollowupDate("");
      setFollowedDate(dayjs().format("YYYY-MM-DDTHH:mm"));
      await loadFollowups();
    } catch (err) {
      toast.error(err.message || "Failed to save follow-up");
    } finally {
      setSubmitting(false);
    }
  };

  const latest = followups[0];

  return (
    <div className="space-y-8">
      {latest && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900 mb-1">Latest follow-up</p>
          <p>
            <span className="text-slate-500">Next follow-up:</span>{" "}
            {formatDt(latest.next_followup_date)}
          </p>
          <p className="mt-1 line-clamp-2">
            <span className="text-slate-500">Notes:</span> {latest.notes}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <PhoneCall className="text-purple-600" size={22} aria-hidden />
          Add follow-up
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Engineer: <span className="font-semibold">{engineerName}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Followed date</label>
            <input
              type="datetime-local"
              value={followedDate}
              readOnly
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Communication mode</label>
            <select
              value={communicationMode}
              onChange={(e) => setCommunicationMode(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            >
              <option value="Call">Call</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Visit">Visit</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Next follow-up date <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={nextFollowupDate}
              onChange={(e) => setNextFollowupDate(e.target.value)}
              min={nextFollowupMin}
              max={nextFollowupMax}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">From now up to 1 month ahead</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Discussion summary, availability, service charge agreed, etc."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? (
            "Saving…"
          ) : (
            <>
              <PhoneCall size={16} className="inline mr-1.5 -mt-0.5" aria-hidden />
              Save follow-up
            </>
          )}
        </button>
      </form>

      <div
        id="history"
        className="bg-white rounded-lg shadow-md p-6 border border-slate-200 scroll-mt-6"
      >
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          Follow-up history
          <span className="text-xs font-normal bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {followups.length} record{followups.length !== 1 ? "s" : ""}
          </span>
        </h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : followups.length === 0 ? (
          <p className="text-slate-500 text-center py-6">No follow-ups yet. Add the first one above.</p>
        ) : (
          <ol className="relative border-l-2 border-blue-200 ml-2 space-y-0">
            {followups.map((rec, idx) => (
              <li key={rec.id} className="mb-6 ml-5">
                <span
                  className={`absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${
                    idx === 0 ? "bg-blue-600" : "bg-slate-400"
                  }`}
                />
                <div
                  className={`p-4 rounded-lg border ${
                    idx === 0 ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap justify-between gap-2 mb-2 text-xs text-slate-500">
                    <span>
                      {idx === 0 && (
                        <span className="mr-2 font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          Latest
                        </span>
                      )}
                      #{rec.id}
                    </span>
                    <span>
                      By <span className="font-semibold text-slate-700">{rec.created_by || "—"}</span>
                      {" · "}
                      {formatDt(rec.created_at)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-2">
                    <p>
                      <span className="text-slate-500">Followed:</span> {formatDt(rec.followed_date)}
                    </p>
                    <p>
                      <span className="text-slate-500">Mode:</span> {rec.communication_mode || "—"}
                    </p>
                    <p className="sm:col-span-2">
                      <span className="text-slate-500">Next follow-up:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {formatDt(rec.next_followup_date)}
                      </span>
                    </p>
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{rec.notes}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
