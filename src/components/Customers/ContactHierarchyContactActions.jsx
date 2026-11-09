"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Loader2, X } from "lucide-react";
import FollowUpHistory from "@/components/Leads/FollowUpHistory";

export default function ContactHierarchyContactActions({
  customerId,
  displayName,
  followHref,
  userRole = "",
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");

  const openHistory = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    setEntries([]);
    try {
      const res = await fetch(`/api/followup/${encodeURIComponent(customerId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not load follow-up history");
      }
      setEntries(Array.isArray(data.history) ? data.history : []);
    } catch (e) {
      setError(e.message || "Could not load follow-up history");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setError("");
  };

  const name =
    displayName ||
    (customerId != null ? `Customer ${customerId}` : "Contact");

  return (
    <>
      <div className="ml-2 flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={openHistory}
          className="inline-flex items-center justify-center rounded border border-blue-200 bg-white p-1.5 text-blue-600 transition hover:bg-blue-50"
          title="View follow-up history"
          aria-label={`View follow-up history for ${name}`}
        >
          <Eye className="h-4 w-4" />
        </button>
        <Link
          href={followHref}
          className="whitespace-nowrap rounded bg-green-600 px-3 py-1 text-xs text-white transition hover:bg-green-700"
        >
          Follow
        </Link>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hierarchy-followup-history-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h3
                  id="hierarchy-followup-history-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Follow-up History
                </h3>
                <p className="mt-0.5 text-sm text-gray-600">
                  {name}
                  {customerId != null ? ` (ID: ${customerId})` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-600">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  Loading…
                </div>
              ) : error ? (
                <p className="py-8 text-center text-sm text-red-600">{error}</p>
              ) : (
                <FollowUpHistory entries={entries} userRole={userRole} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
