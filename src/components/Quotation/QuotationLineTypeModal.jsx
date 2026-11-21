"use client";

const OPTIONS = [
  {
    id: "product",
    title: "Product",
    description: "Add up to 3 products only (machines / main products).",
  },
  {
    id: "spare",
    title: "Spare",
    description: "Add spare parts only.",
  },
  {
    id: "multi",
    title: "Multi Products",
    description: "Add more than 3 products (products only).",
  },
];

export default function QuotationLineTypeModal({
  isOpen,
  onClose,
  onSelect,
  title = "Select quotation type",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-2 text-xl font-bold text-gray-900">{title}</h2>
        <p className="mb-5 text-sm text-gray-600">
          Choose how you want to add line items. Product search will be filtered
          accordingly.
        </p>
        <div className="space-y-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left transition hover:border-blue-500 hover:bg-blue-50"
            >
              <span className="block font-semibold text-gray-900">{opt.title}</span>
              <span className="mt-1 block text-xs text-gray-600">{opt.description}</span>
            </button>
          ))}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}