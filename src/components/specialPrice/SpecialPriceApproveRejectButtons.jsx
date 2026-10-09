"use client";

import { useActionState, useState } from "react";
import { decideSpecialPrice } from "@/app/admin-dashboard/special-pricing/_actions";

export default function SpecialPriceApproveRejectButtons({ id, variant = "table" }) {
  const [modal, setModal] = useState(null);
  const [state, formAction, pending] = useActionState(decideSpecialPrice, null);

  const openApprove = () => setModal("approve");
  const openReject = () => setModal("reject");
  const close = () => setModal(null);

  const isApprove = modal === "approve";

  const btnBase =
    variant === "page"
      ? "px-4 py-2 rounded text-sm font-medium"
      : "text-xs font-medium px-3 py-1.5 rounded";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openApprove}
          className={`bg-green-600 text-white hover:bg-green-700 ${btnBase}`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={openReject}
          className={`bg-red-600 text-white hover:bg-red-700 ${btnBase}`}
        >
          Reject
        </button>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sp-decision-title"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2
                id="sp-decision-title"
                className="text-sm font-semibold text-gray-900"
              >
                {isApprove ? "Approve special price" : "Reject special price"}
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-gray-500 hover:text-gray-700 text-sm p-1 -m-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form action={formAction} className="px-4 py-3 space-y-3">
              <input type="hidden" name="id" value={id} />
              <input
                type="hidden"
                name="decision"
                value={isApprove ? "approve" : "reject"}
              />

              <div>
                <label
                  htmlFor="sp-decision-note"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Note <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="sp-decision-note"
                  name="note"
                  required
                  rows={4}
                  disabled={pending}
                  placeholder="Enter a note before submitting…"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50"
                />
              </div>

              {state?.error && (
                <p className="text-sm text-red-600" role="alert">
                  {state.error}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={
                    isApprove
                      ? "px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      : "px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  }
                >
                  {pending ? "Submitting…" : isApprove ? "Submit approval" : "Submit rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
