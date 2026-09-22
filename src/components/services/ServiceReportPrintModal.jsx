"use client";

export default function ServiceReportPrintModal({
  isOpen,
  onClose,
  printMode,
  setPrintMode,
  hasPhotos,
  onConfirm,
  isPrinting = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-options-title"
      >
        <h3
          id="print-options-title"
          className="text-lg font-semibold text-gray-900 mb-4"
        >
          Print Options
        </h3>
        <div className="space-y-3 mb-6">
          <label
            className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer ${
              printMode === "withImages"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            } ${!hasPhotos ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              type="radio"
              name="printMode"
              value="withImages"
              checked={printMode === "withImages"}
              disabled={!hasPhotos}
              onChange={() => setPrintMode("withImages")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-gray-900">
                Report with images
              </span>
              <span className="block text-sm text-gray-600">
                Print the service report, then pre and post completion photos on
                the next page.
              </span>
              {!hasPhotos && (
                <span className="block text-xs text-amber-700 mt-1">
                  No pre/post photos uploaded for this service.
                </span>
              )}
            </span>
          </label>
          <label
            className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer ${
              printMode === "reportOnly"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            }`}
          >
            <input
              type="radio"
              name="printMode"
              value="reportOnly"
              checked={printMode === "reportOnly"}
              onChange={() => setPrintMode("reportOnly")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-gray-900">
                Report only
              </span>
              <span className="block text-sm text-gray-600">
                Print the service report without photos.
              </span>
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPrinting}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isPrinting ? "Preparing..." : "Print"}
          </button>
        </div>
      </div>
    </div>
  );
}
