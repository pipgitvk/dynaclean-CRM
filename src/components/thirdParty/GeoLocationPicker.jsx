"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import {
  formatGeoLocation,
  parseGeoLocation,
  reverseGeocodeLabel,
} from "@/lib/geoLocationFormat";

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

export default function GeoLocationPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const parsed = parseGeoLocation(value);

  useEffect(() => {
    if (!open) {
      setMapReady(false);
      return;
    }

    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;

        const center =
          parsed.lat != null && parsed.lng != null
            ? { lat: parsed.lat, lng: parsed.lng }
            : DEFAULT_CENTER;

        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: parsed.lat != null ? 15 : 5,
          mapTypeControl: true,
          streetViewControl: false,
        });

        mapInstanceRef.current = map;

        if (parsed.lat != null && parsed.lng != null) {
          markerRef.current = new window.google.maps.Marker({
            position: center,
            map,
          });
        }

        map.addListener("click", async (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          if (markerRef.current) {
            markerRef.current.setPosition(e.latLng);
          } else {
            markerRef.current = new window.google.maps.Marker({
              position: e.latLng,
              map,
            });
          }

          setLoadingAddress(true);
          const label = await reverseGeocodeLabel(lat, lng);
          setLoadingAddress(false);
          onChange(formatGeoLocation(lat, lng, label));
        });

        setMapReady(true);
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapInstanceRef.current = null;
    };
  }, [open]);

  const mapsLink =
    parsed.lat != null && parsed.lng != null
      ? `https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`
      : null;

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-start">
        <input
          type="text"
          readOnly
          value={value || ""}
          placeholder="Pick location on map"
          className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50"
        >
          Pick on map
        </button>
        {mapsLink && (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-blue-600 hover:bg-slate-50"
          >
            Open in Maps
          </a>
        )}
      </div>
      {loadingAddress && (
        <p className="text-xs text-slate-500 mt-1">Fetching address…</p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-slate-900">Select location</h3>
                <p className="text-xs text-slate-500">Click on the map to set latitude & longitude</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-2xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div ref={mapRef} className="w-full h-[400px] bg-slate-100" />
            {!mapReady && (
              <p className="text-center text-sm text-slate-500 py-2">Loading map…</p>
            )}
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
