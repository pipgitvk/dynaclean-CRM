"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateBomPage() {
  const router = useRouter();
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [product, setProduct] = useState(null);

  const [spareQuery, setSpareQuery] = useState("");
  const [spareResults, setSpareResults] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  // Search products
  useEffect(() => {
    const t = setTimeout(async () => {
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
      const res = await fetch("/api/productions/bom/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      router.push("/admin-dashboard/productions/bom-list");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Create BOM</h1>
        <button onClick={() => router.back()} className="px-3 py-2 rounded border text-sm">
          Back
        </button>
      </div>

      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}

      {!product ? (
        <div className="bg-white rounded border p-4">
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
          <div className="bg-white rounded border p-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {product.product_image ? <img src={product.product_image} alt={product.item_name} className="w-14 h-14 object-cover rounded"/> : <div className="w-14 h-14 bg-gray-100 rounded"/>}
              <div>
                <div className="font-medium">{product.item_name}</div>
                <div className="text-xs text-gray-500">{product.item_code}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded border p-4">
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
            <button className="px-3 py-2 rounded border" onClick={() => router.back()}>Cancel</button>
            <button disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white text-sm" onClick={save}>{saving?"Saving…":"Save BOM"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
