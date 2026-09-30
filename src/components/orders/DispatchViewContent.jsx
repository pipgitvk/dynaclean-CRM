"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const PHOTO_LABELS = ["Front", "Back", "Right", "Left"];

function parsePhotos(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAccessories(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function DispatchViewContent() {
  const { order_id } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/dispatch?order_id=${order_id}`);
        const json = await res.json();
        if (json.success) setRows(json.data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [order_id]);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Dispatch Details for Order #{order_id}
        </h2>
      </div>

      {rows.length === 0 ? (
        <div className="text-gray-600">No dispatch rows.</div>
      ) : (
        <div className="space-y-6">
          {rows.map((r) => {
            const photos = parsePhotos(r.photos);
            const accessories = parseAccessories(r.accessories_checklist);

            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-lg border bg-white shadow-sm"
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="p-3 border-b">Item</th>
                        <th className="p-3 border-b">Code</th>
                        <th className="p-3 border-b">Godown</th>
                        <th className="p-3 border-b">Serial No</th>
                        <th className="p-3 border-b">Remarks</th>
                        <th className="p-3 border-b">Accessories</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-3 border-b align-top whitespace-nowrap">
                          {r.item_name}
                        </td>
                        <td className="p-3 border-b align-top whitespace-nowrap">
                          {r.item_code}
                        </td>
                        <td className="p-3 border-b align-top">
                          {r.godown || "-"}
                        </td>
                        <td className="p-3 border-b align-top">
                          {r.serial_no || "-"}
                        </td>
                        <td className="p-3 border-b align-top">
                          {r.remarks || "-"}
                        </td>
                        <td className="p-3 border-b align-top">
                          {accessories.length > 0 ? (
                            <ul className="space-y-1 text-xs">
                              {accessories.map((acc, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center gap-1"
                                >
                                  <span className="text-green-600">✓</span>
                                  <span>{acc.accessory_name}</span>
                                  {acc.is_mandatory === 1 && (
                                    <span className="text-red-600 text-[10px]">
                                      (required)
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border-t bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-800">
                    Dispatch Photos
                  </h4>
                  {photos.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {photos.map((photoUrl, idx) => (
                        <a
                          key={`${photoUrl}-${idx}`}
                          href={photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-md"
                        >
                          <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                            <img
                              src={photoUrl}
                              alt={`Dispatch photo ${idx + 1}`}
                              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                            />
                          </div>
                          <div className="px-3 py-2 text-center text-xs font-medium text-gray-700">
                            {PHOTO_LABELS[idx] || `Photo ${idx + 1}`}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No photos uploaded</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
