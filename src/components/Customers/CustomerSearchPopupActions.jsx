"use client";

/** TL customers search + SUPERADMIN header search: TL & View iframe popups. */
export default function CustomerSearchPopupActions({ onTl, onView }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTl?.();
        }}
        className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
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
        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        title="View customer (popup)"
      >
        View
      </button>
    </div>
  );
}
