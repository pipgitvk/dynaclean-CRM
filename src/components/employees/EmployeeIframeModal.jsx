"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { EMBED_HEIGHT_MESSAGE_TYPE } from "@/components/embed/EmbedHeightReporter";
import {
  iframeHeightForPage,
  maxAutoIframeHeight,
  modalMaxHeightClassForPage,
  modalWidthClassForPage,
  usesAutoIframeHeight,
  usesViewportIframeHeight,
} from "@/lib/employeeEmbedPages";

export default function EmployeeIframeModal({ open, url, title, pageKey, onClose }) {
  const fallbackHeight = iframeHeightForPage(pageKey);
  const widthClass = modalWidthClassForPage(pageKey);
  const maxHeightClass = modalMaxHeightClassForPage(pageKey);
  const tallModal = usesViewportIframeHeight(pageKey);
  const autoHeight = usesAutoIframeHeight(pageKey);
  const [contentHeight, setContentHeight] = useState(null);

  useEffect(() => {
    if (!open) {
      setContentHeight(null);
      return;
    }
    if (!autoHeight) return;

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== EMBED_HEIGHT_MESSAGE_TYPE) return;
      const next = Number(event.data.height);
      if (!Number.isFinite(next) || next <= 0) return;
      const cap = maxAutoIframeHeight(pageKey);
      setContentHeight(Math.min(Math.ceil(next), cap));
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, autoHeight, pageKey]);

  if (!open || !url) return null;

  let iframeHeight;
  if (tallModal) {
    iframeHeight = "min(720px, calc(92vh - 52px))";
  } else if (autoHeight && contentHeight) {
    iframeHeight = `${contentHeight}px`;
  } else {
    iframeHeight = `${fallbackHeight}px`;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex w-full flex-col ${widthClass} ${maxHeightClass} overflow-hidden rounded-xl bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-iframe-modal-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 id="employee-iframe-modal-title" className="text-sm font-semibold text-gray-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <iframe
          src={url}
          title={title}
          scrolling={autoHeight ? "no" : "auto"}
          className="block w-full border-0 bg-white"
          style={{
            height: iframeHeight,
            minHeight: tallModal ? 520 : autoHeight ? undefined : fallbackHeight,
          }}
        />
      </div>
    </div>
  );
}
