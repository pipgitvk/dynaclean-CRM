"use client";

export const MANUAL_FILTER_HINT =
  "Set filters, then click Search to update the list.";

export default function ManualFilterSearchButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ||
        "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg whitespace-nowrap"
      }
    >
      Search
    </button>
  );
}
