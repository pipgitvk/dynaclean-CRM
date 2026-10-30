"use client";

import { ExternalLink } from "lucide-react";
import { isSuperAdminRole } from "@/lib/roleKeyUtils";

const inlineLinkClass =
  "inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100";

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

function getRemainBookingUrl(order, primaryUrl) {
  const batches = order?.booking_batches || [];
  if (batches.length < 2) return "";
  const remain = String(batches[batches.length - 1]?.booking_url || "").trim();
  if (!remain || remain === primaryUrl) return "";
  return remain;
}

export default function OrderBookingDetailLinks({ order, userRole }) {
  if (!order || !isSuperAdminRole(userRole)) return null;

  const externalUrl = getPrimaryBookingUrl(order);
  const remainUrl = getRemainBookingUrl(order, externalUrl);
  if (!externalUrl && !remainUrl) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
      <span className="text-sm font-medium text-gray-700">Booking:</span>
      {externalUrl ? (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={inlineLinkClass}
          title="Open Delhivery / saved booking URL"
        >
          <ExternalLink size={16} />
          Open Booking URL
        </a>
      ) : null}
      {remainUrl ? (
        <a
          href={remainUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={inlineLinkClass}
          title="Open remaining booking URL"
        >
          <ExternalLink size={16} />
          Open Booking URL (Remain)
        </a>
      ) : null}
    </div>
  );
}
