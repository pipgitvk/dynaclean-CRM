"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const normalizeImg = (src) => {
  if (!src || typeof src !== "string") return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  // Absolute
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

export default function ManageInstallationVideosPage() {
  const [q, setQ] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (onlyMissing) params.set("onlyMissing", "true");
    const res = await fetch(`/api/installation-videos/search?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveVideoLink = async (row) => {
    if (!row._newVideo || !row._newVideo.trim()) return;
    setSavingId(row.id);
    const res = await fetch("/api/installation-videos/video-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, installation_video_link: row._newVideo.trim() }),
    });
    setSavingId(null);
    if (res.ok) {
      setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, installation_video_link: row._newVideo.trim() } : it)));
    } else {
      alert("Failed to save video link");
    }
  };


  const uploadManual = async (row, file) => {
    if (!file) return;
    try {
      setSavingId(row.id);
      const fd = new FormData();
      fd.append("id", row.id);
      fd.append("file", file);
      const res = await fetch("/api/installation-videos/upload-manual", { method: "POST", body: fd });
      setSavingId(null);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to upload manual");
        return;
      }
      const data = await res.json();
      setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, user_manual_link: data.path } : it)));
    } catch (e) {
      setSavingId(null);
      alert("Upload error");
    }
  };

  const uploadCatalogue = async (row, file) => {
    if (!file) return;
    try {
      setSavingId(row.id);
      const fd = new FormData();
      fd.append("id", row.id);
      fd.append("file", file);
      const res = await fetch("/api/installation-videos/upload-catalogue", { method: "POST", body: fd });
      setSavingId(null);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to upload catalogue");
        return;
      }
      const data = await res.json();
      setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, catalogue_link: data.path } : it)));
    } catch (e) {
      setSavingId(null);
      alert("Upload error");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">Manage Installation / Manual / Catalogue Links</h1>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Search</label>
          <input
            className="border rounded px-2 py-1 w-64"
            placeholder="Name / Model / Spec"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Only missing links
        </label>
        <button onClick={load} className="bg-emerald-600 text-white px-3 py-1 rounded h-8">Filter</button>
        <button onClick={() => { setQ(""); setOnlyMissing(false); load(); }} className="border px-3 py-1 rounded h-8">Reset</button>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? (
          <div className="text-center p-6">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center p-6">No products</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((p) => {
              const img = normalizeImg(p.product_image);
              return (
                <div key={p.id} className="bg-white rounded-lg shadow border p-3 flex flex-col gap-2">
                  {img ? (
<Image unoptimized src={img} alt={p.item_name} width={360} height={260} className="rounded object-contain w-full h-[180px] bg-gray-50 border" />
                  ) : (
                    <div className="w-full h-[180px] bg-gray-100 rounded border" />
                  )}
                  <div className="text-sm">
                    <div className="font-semibold">{p.item_name}</div>
                    <div className="text-gray-600">Model: <span className="font-medium">{p.item_code}</span></div>
                  </div>
                  <label className="text-xs text-gray-600">Installation Video</label>
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="https://..."
                    defaultValue={p.installation_video_link || ""}
                    onChange={(e) => (p._newVideo = e.target.value)}
                  />
                  <button
                    onClick={() => saveVideoLink(p)}
                    className="bg-emerald-600 text-white px-3 py-1 rounded"
                    disabled={savingId === p.id}
                  >
                    {savingId === p.id ? "Saving..." : "Save Video"}
                  </button>

                  <label className="text-xs text-gray-600">User Manual</label>
                  <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => uploadManual(p, e.target.files?.[0])}
                    className="text-xs" />

                  <label className="text-xs text-gray-600">Catalogue</label>
                  <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => uploadCatalogue(p, e.target.files?.[0])}
                    className="text-xs" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto border rounded">
        <table className="min-w-[1000px] w-full text-sm">
          <thead className="bg-gray-100 text-xs">
            <tr>
              <th className="border px-2 py-2">Image</th>
              <th className="border px-2 py-2">Product</th>
              <th className="border px-2 py-2">Model</th>
              <th className="border px-2 py-2">Current Links</th>
              <th className="border px-2 py-2">New Video</th>
              <th className="border px-2 py-2">Save</th>
              <th className="border px-2 py-2">Upload Manual</th>
              <th className="border px-2 py-2">Upload Catalogue</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center p-6">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="text-center p-6">No products</td></tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-t align-top">
                  <td className="border px-2 py-2">
                    {(() => {
                      const img = normalizeImg(p.product_image);
                      return img ? (
<Image unoptimized src={img} alt={p.item_name} width={40} height={40} className="rounded object-cover border" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded" />
                      );
                    })()}
                  </td>
                  <td className="border px-2 py-2 min-w-[240px]">{p.item_name}</td>
                  <td className="border px-2 py-2">{p.item_code}</td>
                  <td className="border px-2 py-2 max-w-[280px] break-all">
                    <div className="flex flex-col gap-1">
                      <div>
                        <span className="text-gray-500 text-xs mr-1">Video:</span>
                        {p.installation_video_link ? (
                          <a href={p.installation_video_link} target="_blank" className="text-emerald-700 underline">Open</a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs mr-1">Manual:</span>
                        {p.user_manual_link ? (
                          <a href={`/api/files/product-documents?path=${encodeURIComponent(p.user_manual_link)}`} target="_blank" className="text-emerald-700 underline">Open</a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs mr-1">Catalogue:</span>
                        {p.catalogue_link ? (
                          <a href={`/api/files/product-documents?path=${encodeURIComponent(p.catalogue_link)}`} target="_blank" className="text-emerald-700 underline">Open</a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="border px-2 py-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      placeholder="https://..."
                      defaultValue={p.installation_video_link || ""}
                      onChange={(e) => (p._newVideo = e.target.value)}
                    />
                  </td>
                  <td className="border px-2 py-2">
                    <button
                      onClick={() => saveVideoLink(p)}
                      className="bg-emerald-600 text-white px-3 py-1 rounded"
                      disabled={savingId === p.id}
                    >
                      {savingId === p.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                  <td className="border px-2 py-2">
                    <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => uploadManual(p, e.target.files?.[0])}
                      className="text-xs" />
                  </td>
                  <td className="border px-2 py-2">
                    <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => uploadCatalogue(p, e.target.files?.[0])}
                      className="text-xs" />
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
