"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DispatchViewPage({ params }) {
  const { order_id } = params;
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
        <h2 className="text-lg font-semibold">Dispatch Details for Order #{order_id}</h2>
        {/* <Link href={`/user-dashboard/order/dispatch/${order_id}`} className="text-blue-600 underline">Edit</Link> */}
      </div>
      {rows.length === 0 ? (
        <div className="text-gray-600">No dispatch rows.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border">Item</th>
                <th className="p-2 border">Code</th>
                <th className="p-2 border">Godown</th>
                <th className="p-2 border">Serial No</th>
                <th className="p-2 border">Remarks</th>
                <th className="p-2 border">Accessories</th>
                <th className="p-2 border">Photos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const photos = (r.photos || "").split(",").map((s) => s.trim()).filter(Boolean);
                let accessories = [];
                if (r.accessories_checklist) {
                  try {
                    accessories = JSON.parse(r.accessories_checklist);
                  } catch (e) {
                    console.error('Failed to parse accessories_checklist:', e);
                  }
                }
                return (
                  <tr key={r.id}>
                    <td className="p-2 border whitespace-nowrap">{r.item_name}</td>
                    <td className="p-2 border whitespace-nowrap">{r.item_code}</td>
                    <td className="p-2 border">{r.godown || "-"}</td>
                    <td className="p-2 border">{r.serial_no || "-"}</td>
                    <td className="p-2 border">{r.remarks || "-"}</td>
                    <td className="p-2 border">
                      {accessories.length > 0 ? (
                        <ul className="text-xs space-y-1">
                          {accessories.map((acc, idx) => (
                            <li key={idx} className="flex items-center gap-1">
                              <span className="text-green-600">✓</span>
                              <span>{acc.accessory_name}</span>
                              {acc.is_mandatory === 1 && (
                                <span className="text-red-600 text-[10px]">(required)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-2 border">
                      <div className="flex gap-2 flex-wrap">
                        {photos.length ? photos.map((p, idx) => (
                          <a key={idx} href={p} target="_blank" className="block w-16 h-16 border rounded overflow-hidden">
                            <img src={p} alt="photo" className="object-cover w-full h-full" />
                          </a>
                        )) : <span className="text-gray-500">No photos</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
