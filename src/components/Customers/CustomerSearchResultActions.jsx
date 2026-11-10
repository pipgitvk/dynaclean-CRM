"use client";

import { ExternalLink } from "lucide-react";

/**
 * Header search & TL customers search: new tab + full-page View (no iframe popup).
 */
export default function CustomerSearchResultActions({
  viewHref,
  onView,
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <a
        href={viewHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200"
        title="Open in new tab"
        aria-label="Open customer in new tab"
      >
        <ExternalLink size={16} />
      </a>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onView?.();
        }}
        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        View
      </button>
    </div>
  );
}
