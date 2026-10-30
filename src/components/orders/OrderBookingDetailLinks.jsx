"use client";

import { ExternalLink } from "lucide-react";
import { isSuperAdminRole } from "@/lib/roleKeyUtils";
import {
  buildDelhiveryPublicTrackUrl,
  parseDelhiveryLrFromUrl,
} from "@/lib/resolveOrderDelhiveryLr";

const inlineLinkClass =
  "inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100";

function lrFromBookingId(bookingId) {
  const id = String(bookingId ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

function resolveLrFromBooking(bookingId, bookingUrl) {
  return (
    lrFromBookingId(bookingId) ||
    parseDelhiveryLrFromUrl(bookingUrl) ||
    null
  );
}

function getPrimaryBookingUrl(order) {
  const main = String(order?.booking_url || "").trim();
  if (main) return main;
  const batches = order?.booking_batches || [];
  for (let i = batches.length - 1; i >= 0; i--) {
    const u = String(batches[i]?.booking_url || "").trim();
    if (u) return u;
  }
  return "";
}

function getPrimaryTrackHref(order) {
  const savedUrl = getPrimaryBookingUrl(order);
  const lr = resolveLrFromBooking(order?.booking_id, savedUrl);
  return buildDelhiveryPublicTrackUrl(lr) || savedUrl || null;
}

function getRemainTrackHref(order, primarySavedUrl) {
  const batches = order?.booking_batches || [];
  if (batches.length < 2) return null;
  const remain = batches[batches.length - 1];
  const remainUrl = String(remain?.booking_url || "").trim();
  if (!remainUrl || remainUrl === primarySavedUrl) return null;
  const lr = resolveLrFromBooking(remain?.booking_id, remainUrl);
  return buildDelhiveryPublicTrackUrl(lr) || remainUrl;
}

export default function OrderBookingDetailLinks({ order, userRole }) {
  if (!order || !isSuperAdminRole(userRole)) return null;

  const primarySavedUrl = getPrimaryBookingUrl(order);
  const trackHref = getPrimaryTrackHref(order);
  const remainHref = getRemainTrackHref(order, primarySavedUrl);
  if (!trackHref && !remainHref) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
      <span className="text-sm font-medium text-gray-700">Booking:</span>
      {trackHref ? (
        <a
          href={trackHref}
          target="_blank"
          rel="noopener noreferrer"
          className={inlineLinkClass}
          title="Open Delhivery public tracking (track-v2/lr)"
        >
          <ExternalLink size={16} />
          Open Booking URL
        </a>
      ) : null}
      {remainHref ? (
        <a
          href={remainHref}
          target="_blank"
          rel="noopener noreferrer"
          className={inlineLinkClass}
          title="Open Delhivery tracking for remaining batch"
        >
          <ExternalLink size={16} />
          Open Booking URL (Remain)
        </a>
      ) : null}
    </div>
  );
}
