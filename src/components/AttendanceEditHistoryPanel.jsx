"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

function formatWhen(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AttendanceEditHistoryPanel({
  username,
  logDate,
  refreshToken = 0,
  className = "",
}) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!username || !logDate) {
      setHistory([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/empcrm/attendance/edit-history?username=${encodeURIComponent(username)}&date=${encodeURIComponent(logDate)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to load history");
      }
      setHistory(data.history || []);
    } catch (e) {
      setError(e.message);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [username, logDate]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  return (
    <div className={className}>
      <h4 className="text-sm font-semibold text-gray-800 mb-2">Edit history</h4>
      {loading ? (
        <p className="text-sm text-gray-500 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-gray-500">No edits recorded for this day yet.</p>
      ) : (
        <ul className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                <span className="font-semibold text-gray-800">
                  {entry.edit_source_label}
                </span>
                <span className="text-gray-500">{formatWhen(entry.created_at)}</span>
              </div>
              <p className="text-gray-600 mb-1.5">
                By <span className="font-medium">{entry.edited_by}</span>
              </p>
              <ul className="space-y-1">
                {(entry.changes || []).map((ch, i) => (
                  <li key={`${entry.id}-${ch.field}-${i}`} className="text-gray-700">
                    <span className="font-medium">{ch.label}:</span>{" "}
                    <span className="text-red-700 line-through">{ch.old_value}</span>
                    <span className="text-gray-400 mx-1">→</span>
                    <span className="text-green-800 font-medium">{ch.new_value}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
