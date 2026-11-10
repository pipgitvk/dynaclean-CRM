"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { HEADER_TL_FOLLOWUP_SAVED_MESSAGE } from "@/lib/headerTlFollowupModal";

/**
 * Iframe popup for View customer / TL follow-up (header search + TL customers search).
 */
export default function CustomerQuickViewModal({
  modal,
  onClose,
  dashboardBase = "admin-dashboard",
}) {
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== HEADER_TL_FOLLOWUP_SAVED_MESSAGE) return;
      onClose();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose]);

  if (typeof window === "undefined" || modal == null) {
    return null;
  }

  const customerViewEmbedPath = (customerId) =>
    `/${dashboardBase}/view-customer/${customerId}?embed=1`;

  const tlFollowupPagePath = (customerId) =>
    `/${dashboardBase}/tl-customers/${customerId}/followup?tlOnly=true&embed=1`;

  const fullPageHref =
    modal.kind === "tl"
      ? `/${dashboardBase}/tl-customers/${modal.customerId}/followup?tlOnly=true`
      : `/${dashboardBase}/view-customer/${modal.customerId}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={
        modal.kind === "tl" ? "TL follow-up" : "View customer"
      }
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-[min(98vw,1320px)] h-[min(96vh,940px)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 truncate">
            {modal.kind === "tl"
              ? `TL Follow-up — Customer #${modal.customerId}`
              : `View Customer — #${modal.customerId}`}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={fullPageHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap"
            >
              Open full page
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <iframe
          title={
            modal.kind === "tl"
              ? `TL follow-up ${modal.customerId}`
              : `View customer ${modal.customerId}`
          }
          src={
            modal.kind === "tl"
              ? tlFollowupPagePath(modal.customerId)
              : customerViewEmbedPath(modal.customerId)
          }
          className="flex-1 w-full min-h-0 border-0 bg-white"
        />
      </div>
    </div>,
    document.body,
  );
}
