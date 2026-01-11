"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function BomListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  // Filters
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/productions/bom/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setRows(Array.isArray(data) ? data : data.items || []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const viewRows = useMemo(() => {
    const qt = q.trim().toLowerCase();
    return rows.filter(r => {
      const okStatus = statusF === 'all' ? true : String(r.bom_status || 'active').toLowerCase() === statusF;
      const okQ = !qt ? true : (
        String(r.product_name||'').toLowerCase().includes(qt) ||
        String(r.product_code||'').toLowerCase().includes(qt) ||
        String(r.specification||'').toLowerCase().includes(qt)
      );
      return okStatus && okQ;
    });
  }, [rows, q, statusF]);

// View modal state
  const [viewCode, setViewCode] = useState(null);

  function openEdit(row) {
    router.push(`/user-dashboard/productions/bom-list/${encodeURIComponent(row.product_code)}/edit`);
  }

  return (
    <div className="p-3 md:p-6 space-y-4 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <h1 className="text-xl font-semibold">BOM List</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search name/code/spec" className="border rounded p-2 text-sm w-full sm:w-64" />
          <select value={statusF} onChange={(e)=>setStatusF(e.target.value)} className="border rounded p-2 text-sm w-full sm:w-40">
            <option value="all">All</option>
            <option value="active">Active</option>
          </select>
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm w-full sm:w-auto"
            onClick={() => router.push("/user-dashboard/productions/bom-list/create")}
          >
            Create BOM
          </button>
        </div>
      </div>

      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      {/* Desktop table */}
      <div className="overflow-auto border rounded bg-white hidden md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">Image</th>
              <th className="p-2">Product Code</th>
              <th className="p-2">Product Name</th>
              <th className="p-2">Specification</th>
              <th className="p-2">BOM Status</th>
              <th className="p-2">Created By</th>
              <th className="p-2">Modified By</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.length === 0 && (
              <tr>
                <td className="p-2 text-gray-500" colSpan={7}>No data</td>
              </tr>
            )}
            {viewRows.map((r) => (
              <tr key={`${r.product_code}-${r.bom_id || r.id}`} className="border-t">
                <td className="p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.product_image ? <img src={r.product_image} alt={r.product_name} className="w-12 h-12 object-cover rounded"/> : <div className="w-12 h-12 bg-gray-100 rounded"/>}
                </td>
                <td className="p-2">{r.product_code}</td>
                <td className="p-2">{r.product_name}</td>
                <td className="p-2 max-w-[300px] relative group">
                  <div className="truncate text-gray-700">{r.specification || "-"}</div>
                  {r.specification && (
                    <div className="absolute z-30 hidden group-hover:block bg-white border rounded shadow-lg w-96 -left-2 top-full mt-1">
                      <div className="p-3">
                        <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Specification</div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{r.specification}</div>
                      </div>
                    </div>
                  )}
                </td>
                <td className="p-2">{r.bom_status || "active"}</td>
                <td className="p-2">{r.created_by || '-'}</td>
                <td className="p-2">{r.modified_by || '-'}</td>
                <td className="p-2 space-x-2">
                  <button className="text-blue-600 underline" onClick={()=>setViewCode(r.product_code)}>View</button>
                  <button className="text-amber-600 underline" onClick={()=>openEdit(r)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-2 md:hidden">
        {viewRows.length===0 && <div className="text-sm text-gray-500">No data</div>}
        {viewRows.map((r)=> (
          <div key={`${r.product_code}-${r.bom_id || r.id}`} className="rounded border bg-white p-3 flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.product_image ? <img src={r.product_image} alt={r.product_name} className="w-14 h-14 object-cover rounded"/> : <div className="w-14 h-14 bg-gray-100 rounded"/>}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.product_name}</div>
              <div className="text-xs text-gray-500">{r.product_code}</div>
              {r.specification && <div className="text-xs text-gray-500 truncate">{r.specification}</div>}
              <div className="mt-2 text-xs text-gray-600 flex items-center justify-between">
                <span>Status: {r.bom_status || 'active'}</span>
                <span>By: {r.created_by || '-'}</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-500">Modified By: {r.modified_by || '-'}</div>
              <div className="mt-2 flex gap-2 justify-end">
                <button className="px-2 py-1 rounded bg-blue-600 text-white text-xs" onClick={()=>setViewCode(r.product_code)}>View</button>
                <button className="px-2 py-1 rounded bg-amber-600 text-white text-xs" onClick={()=>openEdit(r)}>Edit</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewCode && (
        <ViewBomModal
          product_code={viewCode}
          onClose={()=>setViewCode(null)}
        />
      )}

    </div>
  );
}

function CreateBomModal({ onClose, onSaved, initialProduct = null, initialItems = null, mode = 'create' }) {
  const [step, setStep] = useState(1);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [product, setProduct] = useState(initialProduct || null);

  const [spareQuery, setSpareQuery] = useState("");
  const [spareResults, setSpareResults] = useState([]);
  const [items, setItems] = useState(initialItems || []); // { spare_id, spare_name, qty_in_product }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);

  // Existing BOM product codes (to prevent duplicates)
  const [bomCodes, setBomCodes] = useState([]);
  const bomSet = useMemo(() => new Set(bomCodes), [bomCodes]);

  // Load existing BOM list once (to mark products with BOM)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/productions/bom/list`, { cache: 'no-store' });
        const raw = await res.json();
        const rows = Array.isArray(raw) ? raw : raw.items || [];
        setBomCodes(rows.map(r => r.product_code));
      } catch {}
    })();
  }, []);

  // Search products (disabled in edit mode)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (mode === 'edit') return;
      if (!productQuery || product) return;
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(productQuery)}`);
        const data = await res.json();
        setProductResults(Array.isArray(data) ? data : data.items || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [productQuery, product]);

  // Search spares
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!spareQuery || !product) return;
      try {
        const res = await fetch(`/api/spare/search?q=${encodeURIComponent(spareQuery)}`);
        const data = await res.json();
        setSpareResults(Array.isArray(data) ? data : data.items || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [spareQuery, product]);

  // Calculate items with parsed values
  const computedItems = useMemo(() => {
    return items.map(it => ({ 
      ...it, 
      qty_in_product: Number(it.qty_in_product) || 0,
      weight_percent: Number(it.weight_percent) || 0
    }));
  }, [items]);

  const totalWeight = useMemo(() => computedItems.reduce((a,b)=> a + (Number(b.weight_percent)||0), 0), [computedItems]);

  // Fetch availability for a single spare and update the row
  const loadAvailability = async (spareId) => {
    try {
      const res = await fetch(`/api/spare/availability?spare_id=${encodeURIComponent(spareId)}`, { cache: 'no-store' });
      const data = await res.json();
      setItems(prev => prev.map(row => Number(row.spare_id) === Number(spareId)
        ? { ...row,
            total_available: Number(data?.total || 0),
            delhi_available: Number(data?.delhi || 0),
            south_available: Number(data?.south || 0),
          }
        : row
      ));
    } catch (e) {
      // ignore fetch errors in UI
    }
  };

  // When editing, fetch availability for preloaded items once
  useEffect(() => {
    if (mode === 'edit' && !availabilityLoaded && items && items.length > 0) {
      const ids = Array.from(new Set(items.map(it => it.spare_id).filter(Boolean)));
      ids.forEach((id) => loadAvailability(id));
      setAvailabilityLoaded(true);
    }
  }, [mode, items, availabilityLoaded]);

  const addSpare = (s) => {
    setItems((prev) => {
      if (prev.some((it)=> Number(it.spare_id) === Number(s.id))) return prev;
      return [
        ...prev,
        {
          spare_id: s.id,
          spare_name: s.item_name,
          qty_in_product: 1,
          weight_percent: 1,
          spare_image: s.image || null,
          spare_type: null,
          make: null,
          model: null,
          spec: s.specification || null,
          total_available: undefined,
          delhi_available: undefined,
          south_available: undefined,
        }
      ];
    });
    // Load availability for the newly added spare
    loadAvailability(s.id);
    setSpareQuery("");
    setSpareResults([]);
  };

  const removeSpare = (id) => setItems(prev=>prev.filter(i=>Number(i.spare_id)!==Number(id)));

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      if (!product) throw new Error("Select a product");
      if (items.length === 0) throw new Error("Add at least one spare");

      const payload = {
        product_code: product.item_code,
        items: computedItems.map(({ spare_id, qty_in_product, weight_percent }) => ({
          spare_id,
          qty_in_product: Number(qty_in_product)||0,
          weight_percent: Number(weight_percent)||0,
        })),
      };
      const url = mode === 'edit' ? "/api/productions/bom/update" : "/api/productions/bom/create";
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      onSaved?.();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2" onClick={onClose}>
      <div className="bg-white rounded shadow-lg w-[95vw] sm:w-full max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-4" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Create BOM</div>
          <button onClick={onClose} className="text-sm text-gray-500">Close</button>
        </div>
        {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}

        {!product && mode !== 'edit' ? (
          <div>
            <div className="text-sm mb-2">Search product</div>
            <input value={productQuery} onChange={(e)=>setProductQuery(e.target.value)} placeholder="Search name/code/spec" className="w-full border p-2 rounded" />
            <div className="max-h-64 overflow-auto mt-2 divide-y">
              {productResults.map((p)=>{
                const exists = bomSet.has(p.item_code);
                return (
                  <button
                    key={p.id || p.item_code}
                    className={`w-full text-left p-2 hover:bg-gray-50 flex gap-3 items-center ${exists ? 'opacity-70' : ''}`}
                    onClick={() => {
                      if (exists) { setError('BOM Exists for this product'); return; }
                      setProduct(p);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.product_image ? <img src={p.product_image} alt={p.item_name} className="w-12 h-12 object-cover rounded"/> : <div className="w-12 h-12 bg-gray-100 rounded"/>}
                    <div>
                      <div className="font-medium text-sm">{p.item_name}</div>
                      <div className="text-xs text-gray-500">{p.item_code} {exists && <span className="ml-2 inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">BOM Exists</span>}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {product && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {product.product_image ? <img src={product.product_image} alt={product.item_name} className="w-14 h-14 object-cover rounded"/> : <div className="w-14 h-14 bg-gray-100 rounded"/>}
                <div>
                  <div className="font-medium">{product.item_name}</div>
                  <div className="text-xs text-gray-500">{product.item_code}</div>
                </div>
              </div>
            )}

            <div>
              <div className="text-sm mb-1">Add spares</div>
              <input value={spareQuery} onChange={(e)=>setSpareQuery(e.target.value)} placeholder="Search spare by name/spec" className="w-full border p-2 rounded" />
              <div className="max-h-48 overflow-auto mt-2 divide-y">
                {spareResults.map((s)=>(
                  <button key={s.id} className="w-full text-left p-2 hover:bg-gray-50 flex gap-3 items-center" onClick={()=>addSpare(s)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.image ? <img src={s.image} alt={s.item_name} className="w-10 h-10 object-cover rounded"/> : <div className="w-10 h-10 bg-gray-100 rounded"/>}
                    <div>
                      <div className="font-medium text-sm">{s.item_name}</div>
                      <div className="text-xs text-gray-500">{s.compatible_machine || s.spare_number || ''}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded border">
              {/* Desktop table */}
              <table className="w-full text-sm hidden md:table">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-2">Spare</th>
                    <th className="p-2">Qty</th>
                    <th className="p-2">Weight %</th>
                    <th className="p-2">Total</th>
                    <th className="p-2">Delhi</th>
                    <th className="p-2">South</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {computedItems.map((it, idx)=>(
                    <tr key={it.spare_id} className="border-t">
                      <td className="p-2">{it.spare_name}</td>
                      <td className="p-2">
                        <input type="number" min={0} value={it.qty_in_product}
                          onChange={(e)=>{
                            const v = e.target.value;
                            setItems(prev=>prev.map((row,i)=> i===idx? { ...row, qty_in_product: v } : row));
                          }}
                          className="w-20 border rounded p-1"/>
                      </td>
                      <td className="p-2 align-middle">
                        <input type="number" min={0} step="0.01" value={it.weight_percent}
                          onChange={(e)=>{
                            const v = e.target.value;
                            setItems(prev=>prev.map((row,i)=> i===idx? { ...row, weight_percent: v } : row));
                          }}
                          className="w-20 border rounded p-1"/>
                      </td>
                      <td className="p-2 align-middle">{typeof it.total_available === 'number' ? it.total_available : '-'}</td>
                      <td className="p-2 align-middle">{typeof it.delhi_available === 'number' ? it.delhi_available : '-'}</td>
                      <td className="p-2 align-middle">{typeof it.south_available === 'number' ? it.south_available : '-'}</td>
                      <td className="p-2 text-right">
                        <button className="text-red-600" onClick={()=>removeSpare(it.spare_id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Mobile cards */}
              <div className="md:hidden p-2 grid grid-cols-1 gap-2">
                {computedItems.map((it, idx)=> (
                  <div key={it.spare_id} className="border rounded p-3 bg-white">
                    <div className="font-medium text-sm">{it.spare_name}</div>
                    <div className="mt-2 flex items-end gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Qty</label>
                        <input type="number" min={0} value={it.qty_in_product} onChange={(e)=>{
                          const v = e.target.value;
                          setItems(prev=>prev.map((row,i)=> i===idx? { ...row, qty_in_product: v } : row));
                        }} className="border rounded p-2 w-24" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Weight %</label>
                        <input type="number" min={0} step="0.01" value={it.weight_percent} onChange={(e)=>{
                          const v = e.target.value;
                          setItems(prev=>prev.map((row,i)=> i===idx? { ...row, weight_percent: v } : row));
                        }} className="border rounded p-2 w-24" />
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded bg-gray-50 p-2 text-center">
                        <div className="text-[10px] uppercase text-gray-500">Total</div>
                        <div className="font-medium">{typeof it.total_available === 'number' ? it.total_available : '-'}</div>
                      </div>
                      <div className="rounded bg-gray-50 p-2 text-center">
                        <div className="text-[10px] uppercase text-gray-500">Delhi</div>
                        <div className="font-medium">{typeof it.delhi_available === 'number' ? it.delhi_available : '-'}</div>
                      </div>
                      <div className="rounded bg-gray-50 p-2 text-center">
                        <div className="text-[10px] uppercase text-gray-500">South</div>
                        <div className="font-medium">{typeof it.south_available === 'number' ? it.south_available : '-'}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button className="text-red-600 text-sm" onClick={()=>removeSpare(it.spare_id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 p-2">Total weight: {Number(totalWeight||0).toFixed(2)}%</div>
            </div>

            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded border" onClick={onClose}>Cancel</button>
              <button disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white text-sm" onClick={save}>{saving?"Saving…":(mode==='edit'?"Update BOM":"Save BOM")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewBomModal({ product_code, onClose }) {
  const [data, setData] = useState({ items: [], product: null });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/productions/bom/get?product_code=${encodeURIComponent(product_code)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load');
        setData(json);
      } catch (e) {
        setError(String(e.message||e));
      } finally {
        setLoading(false);
      }
    })();
  }, [product_code]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2" onClick={onClose}>
      <div className="bg-white rounded shadow-lg w-[95vw] sm:w-full max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-4" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">BOM Details</div>
          <button onClick={onClose} className="text-sm text-gray-500">Close</button>
        </div>
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {data.product?.product_image ? (
                <img src={data.product.product_image} alt={data.product?.item_name || data.product_code} className="w-16 h-16 object-cover rounded"/>
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded" />
              )}
              <div>
                <div className="font-medium">{data.product?.item_name || data.product_code}</div>
                <div className="text-xs text-gray-500">{data.product_code}</div>
                {data.product?.specification && (
                  <div className="text-xs text-gray-500 max-w-[420px] truncate">{data.product.specification}</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded border">
              {/* Desktop table */}
              <table className="w-full text-sm hidden md:table">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-2">Spare</th>
                    <th className="p-2">Qty</th>
                    <th className="p-2">Weight %</th>
                    <th className="p-2">Total</th>
                    <th className="p-2">Delhi</th>
                    <th className="p-2">South</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items||[]).map((it, idx) => (
                    <tr key={`${it.spare_id}-${idx}`} className="border-t">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {it.spare_image ? (
                            <img src={it.spare_image} alt={it.spare_name || it.spare_id} className="w-10 h-10 object-cover rounded"/>
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded" />
                          )}
                          <div>
                            <div className="font-medium">{it.spare_name || `Spare #${it.spare_id}`}</div>
                            {it.specification && (
                              <div className="text-xs text-gray-500 max-w-[360px] truncate">{it.specification}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2">{it.qty_in_product}</td>
                      <td className="p-2">{it.weight_percent}</td>
                      <td className="p-2">{typeof it.total_available === 'number' ? it.total_available : '-'}</td>
                      <td className="p-2">{typeof it.delhi_available === 'number' ? it.delhi_available : '-'}</td>
                      <td className="p-2">{typeof it.south_available === 'number' ? it.south_available : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Mobile cards */}
              <div className="md:hidden p-2 grid grid-cols-1 gap-2">
                {(data.items||[]).map((it, idx) => (
                  <div key={`${it.spare_id}-${idx}`} className="rounded border bg-white p-3">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.spare_image ? (
                        <img src={it.spare_image} alt={it.spare_name || it.spare_id} className="w-10 h-10 object-cover rounded"/>
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.spare_name || `Spare #${it.spare_id}`}</div>
                        {it.specification && (
                          <div className="text-xs text-gray-500 truncate max-w-[220px]">{it.specification}</div>
                        )}
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-[10px] uppercase text-gray-500">Weight %</div>
                        <div className="text-sm font-medium">{it.weight_percent}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">Qty: {it.qty_in_product}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded bg-gray-50 p-2 text-center">
                        <div className="text-[10px] uppercase text-gray-500">Total</div>
                        <div className="font-medium">{typeof it.total_available === 'number' ? it.total_available : '-'}</div>
                      </div>
                      <div className="rounded bg-gray-50 p-2 text-center">
                        <div className="text-[10px] uppercase text-gray-500">Delhi</div>
                        <div className="font-medium">{typeof it.delhi_available === 'number' ? it.delhi_available : '-'}</div>
                      </div>
                      <div className="rounded bg-gray-50 p-2 text-center">
                        <div className="text-[10px] uppercase text-gray-500">South</div>
                        <div className="font-medium">{typeof it.south_available === 'number' ? it.south_available : '-'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
