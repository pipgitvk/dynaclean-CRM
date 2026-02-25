"use client";

import { useState } from "react";

export default function SpecialPriceDetailsModal({
  details,
  triggerLabel = "Details",
  onUpdate,
  onDelete,
}) {
  const [open, setOpen] = useState(false);

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
    status,
    setBy,
    setDate,
    approvedBy,
    approvedDate,
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-2">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                Special Price Details
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-3 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
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

              <div className="border-t pt-2 grid grid-cols-2 gap-2">
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
                    Special Price
                  </div>
                  <div className="text-green-700 font-semibold">
                    ₹ {specialPrice ?? 0}
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
                    Approved by {approvedBy} on {formattedApprovedDate}
                  </div>
                )}
              </div>

              <div className="border-t pt-2 grid grid-cols-2 gap-2 text-xs">
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

            <div className="flex justify-end border-t px-4 py-3">
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex gap-2 items-center">
                  {onUpdate && (
                    <form
                      action={onUpdate}
                      className="flex items-center gap-2 text-xs"
                    >
                      <input type="hidden" name="id" value={id} />
                      <label className="text-gray-600 font-medium">
                        Update Price
                      </label>
                      <input
                        type="number"
                        name="special_price"
                        defaultValue={specialPrice ?? 0}
                        step="0.01"
                        required
                        className="w-24 border rounded px-2 py-1 text-right"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </form>
                  )}

                  {onDelete && (
                    <form
                      action={onDelete}
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
                      <input type="hidden" name="id" value={id} />
                      <button
                        type="submit"
                        className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-sm"
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

