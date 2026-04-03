"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const TRIPLE_CLICK_WINDOW_MS = 500;

/**
 * Triple-click the notes text to show/hide delete (admin follow-up page).
 * variant "employee" uses customers_followup (time_stamp); "tl" uses TL_followups (id).
 */
export default function FollowupNotesWithDelete({
  customerId,
  variant,
  notes,
  empTimeStamp,
  tlFollowupId,
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const clickCountRef = useRef(0);
  const clickResetTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (clickResetTimerRef.current) {
        clearTimeout(clickResetTimerRef.current);
      }
    };
  }, []);

  function handleNotesClick() {
    if (clickResetTimerRef.current) {
      clearTimeout(clickResetTimerRef.current);
    }
    clickCountRef.current += 1;
    if (clickCountRef.current === 3) {
      setOpen((o) => !o);
      clickCountRef.current = 0;
      return;
    }
    clickResetTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, TRIPLE_CLICK_WINDOW_MS);
  }

  const canDelete =
    variant === "tl"
      ? tlFollowupId != null
      : Boolean(customerId && empTimeStamp);

  async function handleDelete() {
    if (!canDelete) return;
    if (
      !window.confirm(
        "Delete this follow-up record? This cannot be undone."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      if (variant === "tl") {
        const res = await fetch(
          `/api/tl-followup?id=${encodeURIComponent(String(tlFollowupId))}`,
          { method: "DELETE" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Delete failed");
      } else {
        const q = new URLSearchParams({
          customer_id: String(customerId),
          time_stamp: empTimeStamp,
        });
        const res = await fetch(`/api/employee-followup?${q}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Delete failed");
      }
      router.refresh();
      setOpen(false);
    } catch (e) {
      alert(e.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  const display = notes?.trim() ? notes : "No notes";

  const label = variant === "tl" ? "TL Notes:" : "Notes:";

  return (
    <div className="md:col-span-2">
      <p>
        <strong>{label}</strong>{" "}
        {canDelete ? (
          <button
            type="button"
            title="Triple-click to show or hide delete"
            onClick={handleNotesClick}
            className="text-left align-baseline cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 transition-colors text-gray-700 select-none"
          >
            {display}
          </button>
        ) : (
          <span>{display}</span>
        )}
      </p>
      {open && canDelete && (
        <div className="mt-2 pl-3 border-l-2 border-amber-300">
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete this follow-up"}
          </button>
        </div>
      )}
    </div>
  );
}
