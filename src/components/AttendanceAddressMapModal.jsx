"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";

function toCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function hasAttendanceLocation({ address, latitude, longitude }) {
  const lat = toCoord(latitude);
  const lng = toCoord(longitude);
  if (lat != null && lng != null) return true;
  return Boolean(String(address || "").trim());
}

export function ViewAddressLink({ title, address, latitude, longitude, onOpen, className = "" }) {
  if (!hasAttendanceLocation({ address, latitude, longitude })) {
    return <span className="text-gray-400 italic">—</span>;
  }
  return (
    <button
      type="button"
      onClick={() =>
        onOpen({
          title,
          address: address || "",
          latitude,
          longitude,
        })
      }
      className={`underline text-blue-600 hover:text-blue-800 cursor-pointer ${className}`}
    >
      View Address
    </button>
  );
}

export default function AttendanceAddressMapModal({ open, payload, onClose }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [displayAddress, setDisplayAddress] = useState("");
  const [mapCenter, setMapCenter] = useState(null);

  const title = payload?.title || "Location";
  const address = payload?.address || "";

  useEffect(() => {
    if (!open || !payload) return;

    let cancelled = false;
    setStatus("loading");
    setDisplayAddress(address);
    setMapCenter(null);
    markerRef.current = null;

    const lat = toCoord(payload.latitude);
    const lng = toCoord(payload.longitude);

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;

        const placeOnMap = (center) => {
          setMapCenter(center);
          const map = new window.google.maps.Map(mapRef.current, {
            center,
            zoom: 16,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          });
          markerRef.current = new window.google.maps.Marker({
            position: center,
            map,
          });
          setStatus("ready");
        };

        if (lat != null && lng != null) {
          placeOnMap({ lat, lng });
          return;
        }

        const query = String(address || "").trim();
        if (!query) {
          setStatus("no-location");
          return;
        }

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: query }, (results, geocodeStatus) => {
          if (cancelled) return;
          if (geocodeStatus === "OK" && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            const center = { lat: loc.lat(), lng: loc.lng() };
            if (results[0].formatted_address) {
              setDisplayAddress(results[0].formatted_address);
            }
            placeOnMap(center);
          } else {
            setStatus("error");
          }
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [open, payload, address]);

  if (!open) return null;

  const externalMapsUrl =
    mapCenter != null
      ? `https://www.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}`
      : address.trim()
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
        : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-address-map-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-start gap-3 px-4 py-3 border-b border-slate-200">
          <div className="min-w-0">
            <h3 id="attendance-address-map-title" className="font-semibold text-slate-900">
              {title}
            </h3>
            {displayAddress ? (
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap break-words">
                {displayAddress}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-2xl leading-none px-2 shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="relative flex-1 min-h-[280px]">
          <div ref={mapRef} className="w-full h-[min(420px,50vh)] bg-slate-100" />
          {status === "loading" && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-600 bg-slate-100/80">
              Loading map…
            </p>
          )}
          {status === "no-location" && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-600 px-4 text-center">
              No address or GPS coordinates for this punch.
            </p>
          )}
          {status === "error" && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-red-600 px-4 text-center">
              Could not show this location on the map. Try opening in Google Maps below.
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap justify-end gap-2">
          {externalMapsUrl ? (
            <a
              href={externalMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-blue-600 hover:bg-slate-50"
            >
              Open in Google Maps
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
