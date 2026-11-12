"use client";

import { Building2, Calendar, Phone, StickyNote } from "lucide-react";
import CustomerSearchPopupActions from "@/components/Customers/CustomerSearchPopupActions";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";

function customerInitials(name, company) {
  const src = String(name || company || "C").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

/**
 * TL customers / admin search dropdown row (rich card layout).
 */
export default function CustomerSearchSuggestionItem({
  suggestion,
  highlighted,
  showPopupActions,
  onPick,
  onTl,
  onView,
}) {
  const displayName =
    suggestion.name || suggestion.company?.trim() || "Customer";
  const note = String(
    suggestion.last_note || suggestion.tl_notes || "",
  ).trim();
  const noteAt = suggestion.last_note_at || suggestion.tl_followed_date;
  const followedLabel = noteAt
    ? formatCrmDatetimeForISTDisplay(noteAt, "D MMM YYYY, hh:mm A")
    : "";

  return (
    <div
      className={`text-sm transition-colors border-l-4 border-blue-600 ${
        highlighted ? "bg-sky-50/90" : "bg-white"
      }`}
    >
      <div className="flex gap-2.5 sm:gap-3 items-start px-2.5 sm:px-3 pt-3 pb-2">
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0 ring-1 ring-sky-200/80 mt-0.5"
          aria-hidden
        >
          {customerInitials(displayName, suggestion.company)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-2 sm:gap-y-1">
            <button
              type="button"
              className="min-w-0 w-full sm:flex-1 text-left hover:text-blue-900 sm:pr-1 touch-manipulation"
              onClick={() => onPick?.(suggestion)}
            >
              <div className="font-semibold text-[13px] sm:text-sm text-gray-900 leading-snug break-words">
                {displayName}{" "}
                <span className="text-gray-400 font-normal whitespace-nowrap">
                  #{suggestion.customer_id}
                </span>
              </div>
            </button>
            {showPopupActions ? (
              <CustomerSearchPopupActions onTl={onTl} onView={onView} />
            ) : null}
          </div>
          {suggestion.phone ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1.5 break-all">
              <Phone size={13} className="text-gray-400 shrink-0" />
              <span>{suggestion.phone}</span>
            </div>
          ) : null}
          {suggestion.lead_source ? (
            <div className="flex items-start gap-1.5 text-xs text-gray-500 mt-0.5">
              <Building2
                size={13}
                className="text-gray-400 shrink-0 mt-0.5"
              />
              <span className="break-words leading-snug">
                Lead source: {suggestion.lead_source}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {note || followedLabel ? (
        <div className="mx-2.5 sm:mx-3 mb-3 flex flex-col gap-2 rounded-md border border-yellow-500 bg-yellow-300 px-2.5 sm:px-3 py-2.5 shadow-sm sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <StickyNote
              size={18}
              className="text-yellow-900 shrink-0 mt-0.5"
              aria-hidden
            />
            <p className="text-sm sm:text-base font-bold text-yellow-950 leading-snug max-sm:line-clamp-6 sm:line-clamp-5 break-words">
              <span>Last Note:</span> {note || "—"}
            </p>
          </div>
          {followedLabel ? (
            <div className="flex shrink-0 items-center gap-1.5 text-yellow-950 border-t border-yellow-600/50 pt-2 sm:border-t-0 sm:border-l sm:border-yellow-600/50 sm:pt-0 sm:pl-3 max-sm:w-full text-sm font-bold">
              <Calendar size={14} className="text-yellow-900 shrink-0" aria-hidden />
              <span className="break-words sm:whitespace-nowrap leading-snug">
                {followedLabel}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="pb-2" />
      )}
    </div>
  );
}
