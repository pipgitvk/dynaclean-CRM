"use client";

import { ExternalLink } from "lucide-react";
import CustomerWhatsAppLink from "@/components/Customers/CustomerWhatsAppLink";

/**
 * Header search & TL customers search: new tab + full-page View (no iframe popup).
 */
export default function CustomerSearchResultActions({
  viewHref,
  onView,
  phone,
}) {
  return (
    <div className="grid w-full grid-cols-3 items-center gap-1 px-5">
      <div className="flex justify-start pl-2">
        {phone ? (
          <span onClick={(e) => e.stopPropagation()} role="presentation">
            <CustomerWhatsAppLink phone={phone} />
          </span>
        ) : null}
      </div>
      <div className="flex justify-center">
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
          title="Open in new tab"
          aria-label="Open customer in new tab"
        >
          <ExternalLink size={16} />
        </a>
      </div>
      <div className="flex justify-end pr-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView?.();
          }}
          className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
        >
          View
        </button>
      </div>
    </div>
  );
}
