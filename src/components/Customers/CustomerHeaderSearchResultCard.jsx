"use client";

import { Building2, Calendar, Phone, StickyNote } from "lucide-react";
import CustomerSearchResultActions from "@/components/Customers/CustomerSearchResultActions";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";

function customerInitials(firstName, lastName, company, fallbackName) {
  const personal = [firstName, lastName].filter(Boolean).join(" ").trim();
  const src = String(personal || company || fallbackName || "C").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

function resolveDisplayName(customer, isSuperAdminSearch) {
  const company = customer.company?.trim() || "";
  const personal = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (isSuperAdminSearch) {
    return (
      customer.name ||
      company ||
      personal ||
      "Unnamed"
    );
  }
  return personal || company || "Unnamed";
}

/**
 * Rich card for navbar customer search (user + SUPERADMIN).
 */
export default function CustomerHeaderSearchResultCard({
  customer,
  isSuperAdminSearch,
  viewHref,
  onView,
  onSuperAdminPopupView,
}) {
  const displayName = resolveDisplayName(customer, isSuperAdminSearch);
  const company = customer.company?.trim() || "";

  const followupNote = String(
    customer.last_followup_note ??
      (isSuperAdminSearch
        ? customer.tl_notes
        : customer.latest_followup_notes) ??
      "",
  ).trim();
  const followupAt =
    customer.last_followup_at ??
    (isSuperAdminSearch
      ? customer.tl_followed_date || customer.tl_created_at
      : customer.latest_followed_date);
  const followupLabel =
    customer.last_followup_label ??
    (isSuperAdminSearch ? "Last TL follow-up:" : "Last follow-up:");

  const followedLabel = followupAt
    ? formatCrmDatetimeForISTDisplay(followupAt, "D MMM YYYY, hh:mm A")
    : "";

  return (
    <div className="border-b border-slate-100 last:border-b-0 bg-white hover:bg-slate-50/80 transition-colors border-l-4 border-l-blue-600">
      <div className="flex gap-2.5 items-start px-3 pt-3 pb-2">
        <div
          className="w-9 h-9 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-xs font-semibold shrink-0 ring-1 ring-sky-200/80 mt-0.5"
          aria-hidden
        >
          {customerInitials(
            customer.first_name,
            customer.last_name,
            company,
            displayName,
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-base text-gray-900 leading-snug break-words">
            {displayName}{" "}
            <span className="text-red-600 font-normal whitespace-nowrap">
              {" "}
              ID-{customer.customer_id}
            </span>
          </div>
          {customer.phone ||
          (company && displayName !== company) ? (
            <div className="mt-0.5 flex min-w-0 flex-row items-center gap-2 text-sm leading-snug">
              {company && displayName !== company ? (
                <span className="min-w-0 truncate text-xs text-gray-500">
                  {company}
                </span>
              ) : null}
              {customer.phone ? (
                <span className="inline-flex shrink-0 items-center gap-1 font-medium text-black">
                  <Phone
                    size={14}
                    className="text-gray-400 shrink-0"
                    aria-hidden
                  />
                  <span className="whitespace-nowrap">{customer.phone}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {customer.lead_source ? (
            <div className="flex items-start gap-1.5 text-sm text-black mt-1.5">
              <Building2
                size={13}
                className="text-gray-400 shrink-0 mt-0.5"
                aria-hidden
              />
              <span className="break-words leading-snug">
                Lead source:{" "}
                <span className="text-green-700 font-medium">
                  {customer.lead_source}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {followupNote || followedLabel ? (
        <div className="mx-3 mb-3 rounded-lg border border-yellow-500/80 bg-yellow-300/95 px-3 py-2.5 shadow-sm">
          <div className="flex w-full items-start gap-2">
            <StickyNote
              size={18}
              className="text-yellow-900 shrink-0 mt-0.5"
              aria-hidden
            />
            <p className="min-w-0 flex-1 text-base font-bold text-yellow-950 leading-relaxed">
              <span className="whitespace-nowrap">{followupLabel}</span>{" "}
              <span className="break-words">{followupNote || "—"}</span>
            </p>
          </div>
          {followedLabel ? (
            <div className="mt-2 flex items-center gap-1.5 pl-7 text-sm font-bold text-yellow-950">
              <Calendar
                size={14}
                className="text-yellow-900 shrink-0"
                aria-hidden
              />
              <span className="leading-snug">{followedLabel}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="mx-3 mb-3 w-[calc(100%-1.5rem)]"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <CustomerSearchResultActions
          phone={customer.phone}
          viewHref={viewHref}
          onView={
            isSuperAdminSearch
              ? () => onSuperAdminPopupView?.(customer.customer_id)
              : onView
          }
        />
      </div>
    </div>
  );
}
