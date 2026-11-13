"use client";

import { Building2, Calendar, Phone, StickyNote } from "lucide-react";
import CustomerSearchPopupActions from "@/components/Customers/CustomerSearchPopupActions";
import CustomerWhatsAppLink from "@/components/Customers/CustomerWhatsAppLink";
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
  const note = String(suggestion.tl_notes ?? suggestion.last_note ?? "").trim();
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
          <button
            type="button"
            className="min-w-0 w-full text-left hover:text-blue-900 touch-manipulation"
            onClick={() => onPick?.(suggestion)}
          >
            <div className="font-semibold text-base text-gray-900 leading-snug break-words">
              {displayName}{" "}
              <span className="text-red-600 font-normal whitespace-nowrap">
                {" "}
                ID-{suggestion.customer_id}
              </span>
            </div>
          </button>
          {suggestion.phone ||
          (suggestion.company?.trim() &&
            displayName !== suggestion.company.trim()) ? (
            <div className="mt-0.5 flex min-w-0 flex-row items-center gap-2 text-sm leading-snug">
              {suggestion.company?.trim() &&
              displayName !== suggestion.company.trim() ? (
                <span className="min-w-0 truncate text-xs text-gray-500">
                  {suggestion.company.trim()}
                </span>
              ) : null}
              {suggestion.phone ? (
                <span className="inline-flex shrink-0 items-center gap-1 font-medium text-black">
                  <Phone
                    size={14}
                    className="text-gray-400 shrink-0"
                    aria-hidden
                  />
                  <span className="whitespace-nowrap">{suggestion.phone}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {suggestion.lead_source ? (
            <div className="flex items-start gap-1.5 text-sm text-black mt-0.5">
              <Building2
                size={13}
                className="text-gray-400 shrink-0 mt-0.5"
              />
              <span className="break-words leading-snug">
                Lead source:{" "}
                <span className="text-green-700 font-medium">
                  {suggestion.lead_source}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {note || followedLabel ? (
        <div className="mx-2.5 sm:mx-3 mb-3 rounded-md border border-yellow-500 bg-yellow-300 px-2.5 sm:px-3 py-2.5 shadow-sm">
          <div className="flex w-full items-start gap-2">
            <StickyNote
              size={18}
              className="text-yellow-900 shrink-0 mt-0.5"
              aria-hidden
            />
            <p className="min-w-0 flex-1 text-base font-bold text-yellow-950 leading-relaxed">
              <span className="whitespace-nowrap">Last TL follow-up:</span>{" "}
              <span className="break-words">{note || "—"}</span>
            </p>
          </div>
          {followedLabel ? (
            <div className="mt-2 flex items-center gap-1.5 pl-7 text-sm font-bold text-yellow-950">
              <Calendar size={14} className="text-yellow-900 shrink-0" aria-hidden />
              <span className="leading-snug">{followedLabel}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {showPopupActions ? (
        <div
          className="mx-2.5 sm:mx-3 mb-3 flex flex-wrap items-center gap-2"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          {suggestion.phone ? (
            <CustomerWhatsAppLink phone={suggestion.phone} />
          ) : null}
          <CustomerSearchPopupActions onTl={onTl} onView={onView} />
        </div>
      ) : (
        <div className="pb-2" />
      )}
    </div>
  );
}
