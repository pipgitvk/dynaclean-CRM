"use client";

import { useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import {
  formatDelhiveryDateTime,
  formatDelhiveryStatusLabel,
  formatDelhiveryWeight,
} from "@/lib/delhiveryB2bTrackingUi";

function detailRows(result, lr, awb) {
  if (!result) return [];
  const rows = [
    ["Status", formatDelhiveryStatusLabel(result.status)],
    ["LR number", result.lrnum || lr],
    ["AWB", result.mwbn || awb],
    ["Latest remark", result.scan_remark],
    ["Location", result.location],
    ["Last scan", formatDelhiveryDateTime(result.timestamp)],
    ["Client", result.client_name],
    [
      "Route",
      [result.origin_city, result.destination_city].filter(Boolean).join(" → ") ||
        null,
    ],
    ["Origin branch", result.origin_branch],
    ["Destination branch", result.destination_branch],
    ["Pickup", formatDelhiveryDateTime(result.pickup_date)],
    ["Manifested", formatDelhiveryDateTime(result.manifested_date)],
    ["Estimated delivery", formatDelhiveryDateTime(result.estimated_date)],
    ["Promised delivery", formatDelhiveryDateTime(result.promised_delivery_date)],
    ["Delivered", formatDelhiveryDateTime(result.delivered_date)],
    [
      "Weight",
      result.total_weight != null
        ? formatDelhiveryWeight(result.total_weight)
        : null,
    ],
    ["Packages", result.count != null ? String(result.count) : null],
  ];
  return rows.filter(
    ([, value]) =>
      value != null && String(value).trim() !== "" && value !== "—",
  );
}

function DetailsList({ rows }) {
  return (
    <dl className="max-h-[min(60vh,18rem)] space-y-2 overflow-y-auto pr-1 text-xs sm:max-h-72">
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt className="text-gray-500">{key}</dt>
          <dd className="mt-0.5 break-words font-medium leading-snug text-gray-900">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function useIsMobileSheet() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}

/**
 * Desktop: hover popover. Mobile: tap opens bottom sheet only (no hover).
 */
export default function DelhiveryShipmentDetailsHover({
  result,
  lr,
  awb,
  label = "More details",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const isMobileSheet = useIsMobileSheet();

  const rows = detailRows(result, lr, awb);
  const canShow = !disabled && result && rows.length > 0;

  const scheduleOpen = () => {
    if (isMobileSheet || !canShow) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const scheduleClose = () => {
    if (isMobileSheet) return;
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const handleTriggerClick = () => {
    if (!canShow) return;
    if (isMobileSheet) {
      setOpen(true);
      return;
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open || !isMobileSheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobileSheet]);

  const buttonLabel = isMobileSheet ? "Tap for details" : label;

  return (
    <>
      <div
        className="relative inline-flex max-w-full"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          className={`inline-flex max-w-full items-center gap-1 rounded-md border border-white/25 px-2.5 py-1.5 text-xs transition-colors sm:border-0 sm:py-0.5 sm:text-sm ${
            canShow
              ? "bg-white/10 text-white active:bg-white/20 sm:bg-transparent sm:hover:bg-white/15"
              : "cursor-not-allowed text-white/50"
          }`}
          disabled={!canShow}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={handleTriggerClick}
        >
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{buttonLabel}</span>
        </button>

        {open && canShow && !isMobileSheet ? (
          <div
            role="dialog"
            className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl"
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
          >
            <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-[#3B966F]">
              Shipment information
            </p>
            <DetailsList rows={rows} />
          </div>
        ) : null}
      </div>

      {open && canShow && isMobileSheet ? (
        <div className="fixed inset-0 z-[100]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close details"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl border border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#3B966F]">
                Shipment information
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <DetailsList rows={rows} />
          </div>
        </div>
      ) : null}
    </>
  );
}
