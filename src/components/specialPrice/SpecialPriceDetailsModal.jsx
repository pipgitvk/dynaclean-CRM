"use client";

import { useActionState, useEffect, useState } from "react";
import {
  resolveSpecialPriceTerm,
  displayPriceTypeLabel,
} from "@/lib/specialPriceDefaults";

export default function SpecialPriceDetailsModal({
  details,
  triggerLabel = "Details",
  onUpdate,
  onDelete,
  onRowChange,
  onRowDeleted,
}) {
  const [open, setOpen] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(
    onUpdate ?? (async () => ({ error: "Not available." })),
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    onDelete ?? (async () => ({ error: "Not available." })),
    null,
  );

  useEffect(() => {
    if (!updateState?.success) return;
    onRowChange?.(updateState);
  }, [updateState, onRowChange]);

  useEffect(() => {
    if (!deleteState?.success) return;
    onRowDeleted?.(deleteState.id);
    setOpen(false);
  }, [deleteState, onRowDeleted]);

  if (!details) return null;

  const {
    id,
    customerId,
    customerName,
    productId,
    productName,
    productCode,
    originalPrice,
    specialPrice,
    priceType,
    priceTerm,
    status,
    setBy,
    setDate,
    approvedBy,
    approvedDate,
    approvalNote,
  } = details;

  const formattedSetDate = setDate
    ? new Date(setDate).toLocaleString()
    : "-";

  const formattedApprovedDate = approvedDate
    ? new Date(approvedDate).toLocaleString()
    : "-";

  const statusLower = (status || "").toLowerCase();
  const isApproved = statusLower === "approved";
  const isRejected = statusLower === "rejected";
  const badgeClass = isApproved
    ? "bg-green-100 text-green-700"
    : isRejected
    ? "bg-red-100 text-red-700"
    : "bg-yellow-100 text-yellow-700";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-600 hover:underline"
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between border-b px-3 sm:px-4 py-3 flex-shrink-0">
              <h2 className="text-sm font-semibold">
                Requested Price Details
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-sm p-1 -m-1"
              >
                ✕
              </button>
            </div>

            <div className="px-3 sm:px-4 py-3 space-y-2 text-sm flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <div className="font-semibold text-gray-600">Customer ID</div>
                  <div className="text-gray-800">{customerId}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-600">
                    Customer Name
                  </div>
                  <div className="text-gray-800">
                    {customerName || "-"}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-600">Product</div>
                  <div className="text-gray-800">
                    {productName || "-"}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-600">Code</div>
                  <div className="text-gray-800">
                    {productCode || "-"}
                  </div>
                </div>
              </div>

              <div className="border-t pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <div className="font-semibold text-gray-600">
                    Original Price
                  </div>
                  <div className="text-gray-800">
                    ₹ {originalPrice ?? 0}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-600">
                    Requested Price
                  </div>
                  <div className="text-green-700 font-semibold">
                    ₹ {specialPrice ?? 0}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-600">Price Type</div>
                  <div className="text-gray-800 capitalize">
                    {displayPriceTypeLabel(priceType)}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-600">Price Term</div>
                  <div className="text-gray-800 capitalize">
                    {resolveSpecialPriceTerm(priceTerm)}
                  </div>
                </div>
              </div>

              <div className="border-t pt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-600">
                    Status:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs capitalize ${badgeClass}`}
                  >
                    {statusLower || "-"}
                  </span>
                </div>
                {approvedBy && approvedDate && (
                  <div className="text-xs text-gray-600">
                    {isRejected ? "Rejected" : "Approved"} by {approvedBy} on{" "}
                    {formattedApprovedDate}
                  </div>
                )}
                {approvalNote && (isApproved || isRejected) && (
                  <div className="text-xs text-gray-700 mt-2 pt-2 border-t border-gray-200">
                    <div className="font-semibold text-gray-600 mb-0.5">Note</div>
                    <div className="whitespace-pre-wrap text-gray-800">
                      {approvalNote}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                <div>
                  <div className="font-semibold text-gray-600">Set By</div>
                  <div className="text-gray-800">
                    {setBy || "-"}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-600">Set Date</div>
                  <div className="text-gray-800">
                    {formattedSetDate}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t px-3 sm:px-4 py-3 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full gap-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  {onUpdate && (
                    <form
                      action={updateAction}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs"
                    >
                      <input type="hidden" name="stay_on_page" value="1" />
                      <input type="hidden" name="id" value={id} />
                      <label className="text-gray-600 font-medium">
                        Update Price
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          name="special_price"
                          defaultValue={specialPrice ?? 0}
                          step="0.01"
                          required
                          className="flex-1 min-w-0 sm:w-24 border rounded px-2 py-1.5 sm:py-1 text-right"
                        />
                        <button
                          type="submit"
                          disabled={updatePending}
                          className="px-3 py-1.5 sm:py-1 rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap disabled:opacity-50"
                        >
                          {updatePending ? "Saving…" : "Save"}
                        </button>
                      </div>
                      {updateState?.error && (
                        <p className="text-red-600 text-xs">{updateState.error}</p>
                      )}
                    </form>
                  )}

                  {onDelete && (
                    <form
                      action={deleteAction}
                      className="text-xs"
                      onSubmit={(e) => {
                        if (
                          !window.confirm(
                            "Are you sure you want to delete this special price?",
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="stay_on_page" value="1" />
                      <input type="hidden" name="id" value={id} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className="w-full sm:w-auto px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletePending ? "Deleting…" : "Delete"}
                      </button>
                      {deleteState?.error && (
                        <p className="text-red-600 text-xs mt-1">{deleteState.error}</p>
                      )}
                    </form>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm w-full sm:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

