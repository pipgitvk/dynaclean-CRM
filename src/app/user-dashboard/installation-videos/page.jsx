"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

export default function InstallationVideosPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (opts = {}) => {
    setLoading(true);
    const params = new URLSearchParams();
    const qs = opts.q ?? q;
    const cat = opts.category ?? category;
    if (qs) params.set("q", qs);
    if (cat) params.set("category", cat);

    const res = await fetch(`/api/installation-videos/with-video?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.items || []);
    setCategories(data.categories || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = items; // server filters already applied

  const normalizeImg = (src) => {
    if (!src || typeof src !== "string") return null;
    const trimmed = src.trim();
    if (!trimmed) return null;
    // Absolute URLs (already full)
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) return encodeURI(trimmed);
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    let base = "https://app.dynacleanindustries.com";
    if (typeof window !== "undefined") {
      const origin = window.location.origin || "";
      if (/localhost|127\.0\.0\.1/.test(origin)) {
        base = origin;
      }
    }
    return encodeURI(`${base}${path}`);
  };

  const normalizeDocLink = (url) => {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.startsWith("/product_documents/")) {
      const p = encodeURIComponent(trimmed);
      return `/api/files/product-documents?path=${p}`;
    }
    return trimmed;
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Installation Videos</h1>

      <div className="flex flex-wrap gap-2 items-end mb-4">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Search</label>
          <input
            className="border rounded px-2 py-1 w-64"
            placeholder="Name / Model / Spec"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load({ q: e.currentTarget.value })}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Category</label>
          <select
            className="border rounded px-2 py-1"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              load({ category: e.target.value });
            }}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => load()}
          className="bg-emerald-600 text-white px-3 py-1 rounded h-8"
        >
          Filter
        </button>
        <button
          onClick={() => { setQ(""); setCategory(""); load({ q: "", category: "" }); }}
          className="border px-3 py-1 rounded h-8"
        >
          Reset
        </button>
      </div>

      {/* Mobile: card layout */}
      <div className="md:hidden">
        {loading ? (
          <div className="text-center p-6">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-6">No products found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((p) => {
              const img = normalizeImg(p.product_image);
              return (
                <div key={p.id} className="bg-white rounded-lg shadow border p-3 flex flex-col gap-2">
                  <div className="w-full flex justify-center">
                    {img ? (
<Image unoptimized src={img} alt={p.item_name} width={360} height={260} className="rounded object-contain w-full h-[180px] bg-gray-50 border" />
                    ) : (
                      <div className="w-full h-[180px] bg-gray-100 rounded border" />
                    )}
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">{p.item_name}</div>
                    <div className="text-gray-600">Model: <span className="font-medium">{p.item_code}</span></div>
                    {p.category ? (
                      <div className="text-gray-600">Category: <span className="font-medium">{p.category}</span></div>
                    ) : null}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-emerald-700">Specification</summary>
                      <div className="mt-1 text-gray-800 whitespace-pre-wrap break-words">
                        {p.specification}
                      </div>
                    </details>
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-2">
                    {p.installation_video_link ? (
                      <a
                        href={p.installation_video_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full bg-emerald-600 text-white px-3 py-2 rounded"
                      >
                        Open Video
                      </a>
                    ) : (
                      <button disabled className="w-full border px-3 py-2 rounded text-gray-400">No video</button>
                    )}
                    {p.user_manual_link ? (
                      <a
                        href={normalizeDocLink(p.user_manual_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full bg-blue-600 text-white px-3 py-2 rounded"
                      >
                        Open Manual
                      </a>
                    ) : null}
                    {p.catalogue_link ? (
                      <a
                        href={normalizeDocLink(p.catalogue_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full bg-indigo-600 text-white px-3 py-2 rounded"
                      >
                        Open Catalogue
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block overflow-x-auto border rounded">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-100 text-xs">
            <tr>
              <th className="border px-2 py-2">Image</th>
              <th className="border px-2 py-2">Product Name</th>
              <th className="border px-2 py-2">Model No</th>
              <th className="border px-2 py-2">Specification</th>
              <th className="border px-2 py-2">Category</th>
              <th className="border px-2 py-2">Installation Video</th>
              <th className="border px-2 py-2">User Manual</th>
              <th className="border px-2 py-2">Catalogue</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center p-6">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center p-6">No products found</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-t align-top">
                  <td className="border px-2 py-2">
                    <div className="relative group inline-block">
                      {(() => {
                        const img = normalizeImg(p.product_image);
                        return img ? (
<Image unoptimized src={img} alt={p.item_name} width={40} height={40} className="rounded object-cover border" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded" />
                        );
                      })()}
                      {p.product_image && normalizeImg(p.product_image) && (
                        <div className="hidden group-hover:block absolute z-20 bg-white p-2 border rounded shadow-lg -left-1 top-10">
<Image unoptimized src={normalizeImg(p.product_image)} alt={p.item_name} width={320} height={320} className="object-contain" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border px-2 py-2 min-w-[220px]">{p.item_name}</td>
                  <td className="border px-2 py-2">{p.item_code}</td>
                  <td className="border px-2 py-2 max-w-[360px]">
                    <div className="relative group">
                      <div className="line-clamp-2 text-gray-800">{p.specification}</div>
                      <div className="hidden group-hover:block absolute z-20 bg-white p-3 border rounded shadow-lg w-[480px] max-h-[60vh] overflow-auto">
                        {p.specification}
                      </div>
                    </div>
                  </td>
                  <td className="border px-2 py-2">{p.category || '-'}</td>
                  <td className="border px-2 py-2">
                    {p.installation_video_link ? (
                      <a
                        href={p.installation_video_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 underline"
                      >
                        Open Video
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="border px-2 py-2">
                    {p.user_manual_link ? (
                      <a
                        href={normalizeDocLink(p.user_manual_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 underline"
                      >
                        Manual
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="border px-2 py-2">
                    {p.catalogue_link ? (
                      <a
                        href={normalizeDocLink(p.catalogue_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 underline"
                      >
                        Catalogue
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}