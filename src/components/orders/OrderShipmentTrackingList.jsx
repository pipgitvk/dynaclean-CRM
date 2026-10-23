"use client";

import { Info, ExternalLink } from "lucide-react";

export default function OrderShipmentTrackingList({ tracks = [] }) {
  if (!tracks.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Info size={16} className="text-blue-600" />
        Tracking
      </div>
      <ul className="space-y-1.5 text-sm">
        {tracks.map((t) => (
          <li key={`${t.provider}-${t.trackingNumber}`} className="text-slate-700">
            <span className="font-medium">Tracking — {t.provider}:</span>{" "}
            {t.trackingUrl ? (
              <a
                href={t.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                title="Open live tracking in new tab"
              >
                {t.trackingNumber}
                <ExternalLink size={12} className="shrink-0 opacity-70" />
              </a>
            ) : (
              <span className="font-mono text-slate-800">{t.trackingNumber}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">
        Carrier sites (e.g. Delhivery) open in a new browser tab — they cannot be embedded here.
      </p>
    </div>
  );
}
