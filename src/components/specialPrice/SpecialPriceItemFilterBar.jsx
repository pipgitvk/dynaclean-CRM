"use client";

const TYPE_OPTIONS = [
  { id: "all", label: "All" },
  { id: "product", label: "Products" },
  { id: "spare", label: "Spares" },
];

export default function SpecialPriceItemFilterBar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onSelectAllFiltered,
  onDeselectAllFiltered,
  onClearAll,
  shownCount = 0,
  selectedInViewCount = 0,
  selectedTotalCount = 0,
  searchPlaceholder = "Search by name, code, model, or specification...",
}) {
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {TYPE_OPTIONS.map((opt) => {
          const active = typeFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onTypeFilterChange(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                active
                  ? opt.id === "product"
                    ? "bg-blue-600 text-white border-blue-600"
                    : opt.id === "spare"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="border p-2 rounded flex-1 min-w-[200px] text-sm"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onSelectAllFiltered}
          className="px-3 py-2 text-xs border rounded hover:bg-gray-50 whitespace-nowrap"
        >
          Select all shown
        </button>
        <button
          type="button"
          onClick={onDeselectAllFiltered}
          className="px-3 py-2 text-xs border rounded hover:bg-gray-50 whitespace-nowrap"
        >
          Deselect shown
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="px-3 py-2 text-xs border rounded hover:bg-gray-50 whitespace-nowrap"
        >
          Clear all
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Showing {shownCount} item{shownCount !== 1 ? "s" : ""} ·{" "}
        {selectedInViewCount} selected in view · {selectedTotalCount} total
        selected
      </p>
    </div>
  );
}
