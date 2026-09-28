"use client";

import { useEffect, useState } from "react";
import { Images, X } from "lucide-react";

const PHOTO_LABELS = ["Front", "Back", "Right", "Left"];

function splitPhotos(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function DispatchPhotosModal({ orderId, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/dispatch?order_id=${encodeURIComponent(orderId)}`);
        const json = await res.json();
        if (!res.ok || json.success === false) {
          throw new Error(json.error || "Could not load dispatch photos");
        }
        if (!cancelled) setRows(json.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load dispatch photos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">
            Dispatch photos · Order #{orderId}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && <p className="text-sm text-gray-500">Loading photos...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-gray-500">No dispatched items for this order.</p>
          )}
          {!loading &&
            !error &&
            rows.map((row) => {
              const photos = splitPhotos(row.photos);
              return (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="mb-2">
                    <p className="font-medium text-sm text-gray-900">{row.item_name || "Item"}</p>
                    <p className="text-xs text-gray-500">
                      {row.item_code || "-"}
                      {row.serial_no ? ` · Serial ${row.serial_no}` : ""}
                    </p>
                  </div>
                  {photos.length === 0 ? (
                    <p className="text-sm italic text-gray-400">No photo uploaded</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {photos.map((src, index) => (
                        <button
                          key={`${row.id}-${index}`}
                          type="button"
                          onClick={() =>
                            setPreview({
                              src,
                              label: `${row.item_name || "Item"} · ${PHOTO_LABELS[index] || `Photo ${index + 1}`}`,
                            })
                          }
                          className="text-left"
                        >
                          <img
                            src={src}
                            alt={PHOTO_LABELS[index] || `Photo ${index + 1}`}
                            className="h-28 w-full rounded border object-cover bg-gray-50"
                          />
                          <span className="mt-1 block text-xs text-gray-600">
                            {PHOTO_LABELS[index] || `Photo ${index + 1}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-white">
              <p className="text-sm">{preview.label}</p>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded p-1 hover:bg-white/10"
                aria-label="Close image"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={preview.src}
              alt={preview.label}
              className="max-h-[80vh] w-full rounded bg-white object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function DispatchPhotosMenuButton({ orderId, onOpen }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
      title="View dispatch photos"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <Images size={16} />
      <span>View Dispatch Photos</span>
    </button>
  );
}
