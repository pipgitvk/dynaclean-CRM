"use client";

import { RotateCcw, Search } from "lucide-react";

/** Search field — first in the filter row; applies on Enter via onApply. */
export function OrderListSearchInput({ searchQuery, setSearchQuery, onApply }) {
  return (
    <div className="flex items-end shrink-0 order-first w-full sm:w-auto">
      <div className="relative w-[200px] max-w-full">
        <label className="block text-xs text-gray-600 mb-1">Search</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by ID, client, company, etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApply();
              }
            }}
            className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

/** Clear filters to defaults (caller applies list + persistence). */
export function OrderListSearchResetButton({ onReset }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
    >
      <RotateCcw size={16} aria-hidden />
      Reset
    </button>
  );
}

/** Apply all filters — last in the filter row when used alone. */
export function OrderListSearchApplyButton({ onApply, embedded = false }) {
  const button = (
    <button
      type="button"
      onClick={onApply}
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
    >
      <Search size={16} aria-hidden />
      Search
    </button>
  );
  if (embedded) return button;
  return <div className="flex items-end shrink-0 order-last">{button}</div>;
}
