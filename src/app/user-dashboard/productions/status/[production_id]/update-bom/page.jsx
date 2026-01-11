"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function UpdateBomForProductionPage() {
  const { production_id } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null); // { header, bom, current_items, bom_items }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/productions/bom/compare?production_id=${encodeURIComponent(production_id)}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load");
        setData(json);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [production_id]);

  const diffItems = useMemo(() => {
    if (!data) return [];
    const currentMap = new Map(data.current_items.map(it => [Number(it.spare_id), it]));
    const bomMap = new Map(data.bom_items.map(it => [Number(it.spare_id), it]));
    const allIds = new Set([
      ...Array.from(currentMap.keys()),
      ...Array.from(bomMap.keys()),
    ]);

    const rows = [];
    for (const id of allIds) {
      const cur = currentMap.get(id) || null;
      const bom = bomMap.get(id) || null;
      const type = !cur && bom ? "added" : cur && !bom ? "removed" : "changed";
      if (type === "changed") {
        const sameQty = (cur?.qty_in_product || 0) === (bom?.qty_in_product || 0);
        const sameW = (cur?.weight_percent || 0) === (bom?.weight_percent || 0);
        if (sameQty && sameW) continue; // skip identical rows
      }
      rows.push({ spare_id: id, current: cur, bom, type, selected: type !== "removed" });
    }
    return rows;
  }, [data]);

  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (diffItems.length) {
      const init = {};
      for (const row of diffItems) {
        init[row.spare_id] = row.type !== "removed"; // default select added/changed, not removed
      }
      setSelected(init);
    }
  }, [diffItems]);

  const hasChanges = diffItems.some(row => selected[row.spare_id]);

  const applyUpdate = async () => {
    try {
      setSaving(true);
      setError("");
      const spare_ids = diffItems
        .filter(row => selected[row.spare_id])
        .map(row => row.spare_id);
      const res = await fetch("/api/productions/bom/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ production_id, spare_ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      // Go back to Production Status list
      router.push("/user-dashboard/productions/status");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Update BOM for Production</h1>
        <button
          onClick={() => router.back()}
          className="px-3 py-2 rounded border text-sm"
        >
          Back
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm text-gray-500">Loading…</div>}

      {!loading && data && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="border rounded-lg p-4 bg-gray-50 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {data.header.product_image ? (
              <img
                src={data.header.product_image}
                alt={data.header.product_name}
                className="w-16 h-16 object-cover rounded"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-100 rounded" />
            )}
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">{data.header.product_name}</div>
              <div className="text-xs text-gray-500">{data.header.product_code}</div>
              <div className="text-xs text-gray-500">Production ID: {data.header.production_id}</div>
            </div>
            <div className="ml-auto text-right text-xs text-gray-600">
              <div>Status: {data.header.status}</div>
              <div>Progress: {Math.round(data.header.progress_percent || 0)}%</div>
            </div>
          </div>

          {/* Diff table */}
          <div className="bg-white rounded border">
            {/* Desktop table */}
            <div className="hidden md:block overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="p-2 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={diffItems.length > 0 && diffItems.every(row => selected[row.spare_id])}
                        onChange={(e) => {
                          const all = {};
                          for (const row of diffItems) {
                            all[row.spare_id] = e.target.checked;
                          }
                          setSelected(all);
                        }}
                      />
                    </th>
                    <th className="p-2">Spare</th>
                    <th className="p-2 text-right">Current Qty</th>
                    <th className="p-2 text-right">New Qty</th>
                    <th className="p-2 text-right">Current W%</th>
                    <th className="p-2 text-right">New W%</th>
                    <th className="p-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {!hasChanges && (
                    <tr>
                      <td className="p-2 text-gray-500 text-sm" colSpan={7}>
                        No differences between production snapshot and current BOM.
                      </td>
                    </tr>
                  )}
                  {diffItems.map((row) => {
                    const { spare_id, current, bom, type } = row;
                    const label = bom?.spare_name || current?.spare_name || `#${spare_id}`;
                    const tag =
                      type === "added" ? "New" : type === "removed" ? "Removed" : "Changed";
                    const tagColor =
                      type === "added"
                        ? "bg-green-100 text-green-700"
                        : type === "removed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700";
                    return (
                      <tr key={spare_id} className="border-t">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!!selected[spare_id]}
                            onChange={(e) =>
                              setSelected((prev) => ({ ...prev, [spare_id]: e.target.checked }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex flex-col">
                            <div className="font-medium">{label}</div>
                            <div className="text-[11px] text-gray-500 truncate max-w-xs">
                              {bom?.specification || current?.specification || ""}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          {current ? current.qty_in_product : "-"}
                        </td>
                        <td className="p-2 text-right">
                          {bom ? bom.qty_in_product : "-"}
                        </td>
                        <td className="p-2 text-right">
                          {current ? current.weight_percent : "-"}
                        </td>
                        <td className="p-2 text-right">
                          {bom ? bom.weight_percent : "-"}
                        </td>
                        <td className="p-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${tagColor}`}>
                            {tag}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-2 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={diffItems.length > 0 && diffItems.every(row => selected[row.spare_id])}
                  onChange={(e) => {
                    const all = {};
                    for (const row of diffItems) {
                      all[row.spare_id] = e.target.checked;
                    }
                    setSelected(all);
                  }}
                />
                <span>Select all</span>
              </div>

              {!hasChanges && (
                <div className="text-sm text-gray-500">
                  No differences between production snapshot and current BOM.
                </div>
              )}

              {diffItems.map((row) => {
                const { spare_id, current, bom, type } = row;
                const label = bom?.spare_name || current?.spare_name || `#${spare_id}`;
                const tag =
                  type === "added" ? "New" : type === "removed" ? "Removed" : "Changed";
                const tagColor =
                  type === "added"
                    ? "bg-green-100 text-green-700"
                    : type === "removed"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700";
                return (
                  <div
                    key={spare_id}
                    className="border rounded p-3 bg-white flex items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-1"
                      checked={!!selected[spare_id]}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [spare_id]: e.target.checked }))
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{label}</div>
                        <span
                          className={`shrink-0 inline-block px-2 py-0.5 rounded text-[11px] ${tagColor}`}
                        >
                          {tag}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 truncate mt-0.5">
                        {bom?.specification || current?.specification || ""}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase text-gray-500">Current Qty</div>
                          <div className="font-medium">
                            {current ? current.qty_in_product : "-"}
                          </div>
                        </div>
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase text-gray-500">New Qty</div>
                          <div className="font-medium">
                            {bom ? bom.qty_in_product : "-"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase text-gray-500">Current W%</div>
                          <div className="font-medium">
                            {current ? current.weight_percent : "-"}
                          </div>
                        </div>
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase text-gray-500">New W%</div>
                          <div className="font-medium">
                            {bom ? bom.weight_percent : "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              When you click <span className="font-semibold">Apply Update</span>, this production's
              BOM snapshot will be replaced with the current active BOM for this product.
              Already issued quantities will be preserved (required qty will never be lower than
              issued qty for any spare).
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded border"
                onClick={() => router.back()}
              >
                Cancel
              </button>
              <button
                disabled={saving || !hasChanges}
                className={`px-3 py-2 rounded text-sm text-white ${
                  saving || !hasChanges
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={applyUpdate}
              >
                {saving ? "Updating…" : "Apply Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
