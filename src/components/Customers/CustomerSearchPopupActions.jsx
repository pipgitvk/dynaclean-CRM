"use client";

import { Eye } from "lucide-react";

/** TL customers search + SUPERADMIN header search: TL & View iframe popups. */
const actionBtnClass =
  "inline-flex h-9 sm:h-7 min-h-[2.75rem] sm:min-h-0 flex-1 sm:flex-initial sm:min-w-[2.25rem] items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold text-white shadow-sm transition-colors touch-manipulation";

export default function CustomerSearchPopupActions({ onTl, onView }) {
  return (
    <div className="flex w-full sm:w-auto shrink-0 items-stretch gap-1.5 max-sm:pt-0.5 sm:self-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTl?.();
        }}
        className={`${actionBtnClass} bg-violet-600 hover:bg-violet-700 active:bg-violet-800`}
        title="TL follow-up (popup)"
      >
        TL
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onView?.();
        }}
        className={`${actionBtnClass} bg-blue-600 hover:bg-blue-700 active:bg-blue-800 sm:pr-3`}
        title="View customer (popup)"
      >
        <Eye size={14} className="shrink-0" aria-hidden />
        <span>View</span>
      </button>
    </div>
  );
}
