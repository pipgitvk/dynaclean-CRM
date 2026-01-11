"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function ProcessModal({ productionId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issue, setIssue] = useState(null); // { spare_id, qty, warehouse, assembly }
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const res = await fetch(`/api/productions/process?production_id=${encodeURIComponent(productionId)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load');
        setData(json);
      }catch(e){
        setError(String(e.message||e));
      }finally{ setLoading(false); }
    })();
  }, [productionId]);

  const startIssue = (spare_id)=>{
    setIssue({ spare_id, qty: 1, warehouse: 'Delhi - Mundka', assembly: '' });
  };

  const submitIssue = async ()=>{
    try{
      setSaving(true);
      setError("");
      if (!issue?.spare_id || !issue?.qty || !issue?.warehouse) throw new Error('Fill all fields');
      const body = {
        production_id: productionId,
        product_code: data?.header?.product_code,
        spare_id: issue.spare_id,
        qty: Number(issue.qty)||0,
        warehouse: issue.warehouse,
        assembly: issue.assembly || null,
      };
      const res = await fetch('/api/productions/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      // reload
      setIssue(null);
      setLoading(true);
      const r2 = await fetch(`/api/productions/process?production_id=${encodeURIComponent(productionId)}`, { cache: 'no-store' });
      const j2 = await r2.json();
      setData(j2);
      setLoading(false);
      onChanged?.();
    }catch(e){
      setError(String(e.message||e));
    }finally{
      setSaving(false);
    }
  };

  const status = (data?.header?.status) || 'planned';
  const statusStyle = status === 'completed'
    ? 'bg-green-100 text-green-700 border-green-200'
    : (status === 'in_process' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-700 border-gray-200');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2" onClick={onClose}>
      <div className="bg-white rounded shadow-lg w-[95vw] sm:w-full max-w-5xl max-h-[85vh] overflow-y-auto overflow-x-auto p-4" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Production Process</div>
          <button onClick={onClose} className="text-sm text-gray-500">Close</button>
        </div>
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
        {data && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {data.header?.product_image ? (
                  <img src={data.header.product_image} alt={data.header?.product_name} className="w-16 h-16 object-cover rounded"/>
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded"/>
                )}
                <div className="min-w-0">
                  <div className="text-lg font-semibold truncate">{data.header?.product_name}</div>
                  <div className="text-xs text-gray-500">{data.header?.product_code}</div>
                </div>
                <div className="ml-auto">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${statusStyle}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                    {(data.header?.status || 'planned').replace('_',' ').toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-3 w-full bg-white border rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: `${Math.round(data.header?.progress_percent || 0)}%` }} />
                </div>
                <div className="text-xs text-gray-600 mt-1">{Math.round(data.header?.progress_percent || 0)}% Complete</div>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded border bg-white p-2">
                  <div className="text-[10px] uppercase text-gray-400">Expected Date</div>
                  <div className="text-sm">{data.header?.expected_date ? new Date(data.header.expected_date).toLocaleDateString() : '-'}</div>
                </div>
                <div className="rounded border bg-white p-2">
                  <div className="text-[10px] uppercase text-gray-400">Created By</div>
                  <div className="text-sm">{data.header?.created_by || '-'}</div>
                </div>
                <div className="rounded border bg-white p-2">
                  <div className="text-[10px] uppercase text-gray-400">Created At</div>
                  <div className="text-sm">{data.header?.created_at ? new Date(data.header.created_at).toLocaleString() : '-'}</div>
                </div>
                <div className="rounded border bg-white p-2">
                  <div className="text-[10px] uppercase text-gray-400">Updated At</div>
                  <div className="text-sm">{data.header?.updated_at ? new Date(data.header.updated_at).toLocaleString() : '-'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded border">
              {/* Desktop table */}
              <table className="w-full text-sm hidden md:table">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50">
                    <th className="p-2">Spare</th>
                    <th className="p-2">Required</th>
                    <th className="p-2">Issued</th>
                    <th className="p-2">Remain</th>
                    <th className="p-2">Weight %</th>
                    <th className="p-2">Total</th>
                    <th className="p-2">Delhi</th>
                    <th className="p-2">South</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.bom?.items||[]).map((it, idx)=>{
                    const req = Number(it.qty_in_product ?? it.qty ?? 0) || 0;
                    const used = Number(it.used_qty || 0);
                    const remain = Math.max(req - used, 0);
                    return (
                      <tr key={`${it.spare_id}-${idx}`} className="border-t">
                        <td className="p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {it.spare_image ? (
                              <img src={it.spare_image} alt={it.spare_name || it.spare_id} className="w-8 h-8 object-cover rounded"/>
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 rounded"/>
                            )}
                            <div className="truncate">
                              <div className="font-medium truncate">{it.spare_name || `#${it.spare_id}`}</div>
                              {it.specification && <div className="text-xs text-gray-500 truncate max-w-[320px]">{it.specification}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">{req}</td>
                        <td className="p-2">{used}</td>
                        <td className="p-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${remain>0? 'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>{remain}</span>
                        </td>
                        <td className="p-2">{it.weight_percent ?? it.weight ?? 0}</td>
                        <td className="p-2">{typeof it.total_available === 'number' ? it.total_available : '-'}</td>
                        <td className="p-2">{typeof it.delhi_available === 'number' ? it.delhi_available : '-'}</td>
                        <td className="p-2">{typeof it.south_available === 'number' ? it.south_available : '-'}</td>
                        <td className="p-2 text-right">
                          <button disabled={remain<=0} className={`px-2 py-1 rounded text-sm ${remain>0? 'bg-blue-600 text-white hover:bg-blue-700':'bg-gray-200 text-gray-500 cursor-not-allowed'}`} onClick={()=>startIssue(it.spare_id)}>Issue</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Mobile cards */}
              <div className="md:hidden p-2 grid grid-cols-1 gap-2">
                {(data.bom?.items||[]).map((it, idx)=>{
                  const req = Number(it.qty_in_product ?? it.qty ?? 0) || 0;
                  const used = Number(it.used_qty || 0);
                  const remain = Math.max(req - used, 0);
                  return (
                    <div key={`${it.spare_id}-${idx}`} className="border rounded p-3 bg-white">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.spare_image ? <img src={it.spare_image} alt={it.spare_name || it.spare_id} className="w-10 h-10 object-cover rounded"/> : <div className="w-10 h-10 bg-gray-100 rounded"/>}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.spare_name || `#${it.spare_id}`}</div>
                          {it.specification && <div className="text-xs text-gray-500 truncate max-w-[220px]">{it.specification}</div>}
                        </div>
                        <div className="ml-auto">
                          <button disabled={remain<=0} className={`px-2 py-1 rounded text-xs ${remain>0? 'bg-blue-600 text-white':'bg-gray-200 text-gray-500'}`} onClick={()=>startIssue(it.spare_id)}>Issue</button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-gray-50 p-2 text-center">
                          <div className="text-[10px] uppercase text-gray-500">Required</div>
                          <div className="font-medium">{req}</div>
                        </div>
                        <div className="rounded bg-gray-50 p-2 text-center">
                          <div className="text-[10px] uppercase text-gray-500">Issued</div>
                          <div className="font-medium">{used}</div>
                        </div>
                        <div className="rounded bg-gray-50 p-2 text-center">
                          <div className="text-[10px] uppercase text-gray-500">Remain</div>
                          <div className={`font-medium ${remain>0? 'text-amber-700':'text-green-700'}`}>{remain}</div>
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
                    </div>
                  );
                })}
              </div>
            </div>

            {issue && (() => {
              const it = (data.bom?.items||[]).find(x => Number(x.spare_id) === Number(issue.spare_id));
              const req = Number(it?.qty_in_product ?? it?.qty ?? 0) || 0;
              const used = Number(it?.used_qty || 0);
              const remain = Math.max(req - used, 0);
              const block = (
                <div className="border rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-sm font-medium">Issue Spare {it?.spare_name ? `- ${it.spare_name}` : `#${issue.spare_id}`}</div>
                    <span className={`ml-2 inline-block px-2 py-0.5 rounded text-xs ${remain>0? 'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>Remain: {remain}</span>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Quantity</label>
                      <input type="number" min={1} max={remain} value={issue.qty} onChange={(e)=>{
                        const v = Number(e.target.value)||0;
                        setIssue(prev=>({ ...prev, qty: v>remain?remain:v }));
                      }} className="border rounded p-2 w-28" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Warehouse</label>
                      <select value={issue.warehouse} onChange={(e)=>setIssue(prev=>({ ...prev, warehouse: e.target.value }))} className="border rounded p-2 w-56">
                        <option>Delhi - Mundka</option>
                        <option>Tamil_Nadu - Coimbatore</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Assembly</label>
                      <input type="text" value={issue.assembly} onChange={(e)=>setIssue(prev=>({ ...prev, assembly: e.target.value }))} className="border rounded p-2 w-56" placeholder="Assembly/Section" />
                    </div>
                    <div className="ml-auto flex gap-2">
                      <button className="px-3 py-2 rounded border" onClick={()=>setIssue(null)}>Cancel</button>
                      <button disabled={saving || issue.qty<1} className="px-3 py-2 rounded bg-green-600 text-white text-sm" onClick={submitIssue}>{saving? 'Issuing…':'Issue'}</button>
                    </div>
                  </div>
                </div>
              );
              return block;
            })()}

            {Array.isArray(data.transactions) && data.transactions.length>0 && (
              <div>
                <div className="text-sm font-medium mb-2">Transactions</div>
                {/* Desktop table */}
                <table className="w-full text-sm hidden md:table">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="p-2">When</th>
                      <th className="p-2">Spare</th>
                      <th className="p-2">Qty</th>
                      <th className="p-2">Warehouse</th>
                      <th className="p-2">Assembly</th>
                      <th className="p-2">Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map(tx => (
                      <tr key={tx.id} className="border-t">
                        <td className="p-2">{new Date(tx.created_at).toLocaleString()}</td>
                        <td className="p-2">{tx.spare_name || `#${tx.spare_id}`}</td>
                        <td className="p-2">{tx.qty_used}</td>
                        <td className="p-2">{tx.warehouse}</td>
                        <td className="p-2">{tx.assembly || '-'}</td>
                        <td className="p-2">{tx.created_by || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Mobile cards */}
                <div className="md:hidden grid grid-cols-1 gap-2">
                  {data.transactions.map(tx => (
                    <div key={tx.id} className="rounded border bg-white p-3">
                      <div className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</div>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="font-medium text-sm">{tx.spare_name || `#${tx.spare_id}`}</div>
                        <div className="text-xs bg-gray-100 px-2 py-0.5 rounded">Qty: {tx.qty_used}</div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Warehouse: {tx.warehouse}</div>
                      <div className="text-xs text-gray-600">Assembly: {tx.assembly || '-'}</div>
                      <div className="text-xs text-gray-600">By: {tx.created_by || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}


export default function ProductionStatusPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();

  // Filters
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/productions/status/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setRows(Array.isArray(data) ? data : data.items || []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ load(); }, []);

  const viewRows = useMemo(() => {
    const qt = q.trim().toLowerCase();
    return rows.filter(r => {
      const okStatus = statusF === 'all' ? true : String(r.status || '').toLowerCase() === statusF;
      const okQ = !qt ? true : (
        String(r.product_name||'').toLowerCase().includes(qt) ||
        String(r.product_code||'').toLowerCase().includes(qt)
      );
      return okStatus && okQ;
    });
  }, [rows, q, statusF]);

  return (
    <>
    <div className="p-3 md:p-6 space-y-4 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <h1 className="text-xl font-semibold">Production Status</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search code/name" className="border rounded p-2 text-sm w-full sm:w-64" />
          <select value={statusF} onChange={(e)=>setStatusF(e.target.value)} className="border rounded p-2 text-sm w-full sm:w-40">
            <option value="all">All statuses</option>
            <option value="planned">Planned</option>
            <option value="in_process">In Process</option>
            <option value="completed">Completed</option>
          </select>
          <button className="px-3 py-2 rounded bg-green-600 text-white text-sm w-full sm:w-auto" onClick={()=>setShowAdd(true)}>Add in Production</button>
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
              <th className="p-2">Production ID</th>
              <th className="p-2">Product Code</th>
              <th className="p-2">Product Name</th>
              <th className="p-2">Expected Date</th>
              <th className="p-2">Progress</th>
              <th className="p-2">Status</th>
              <th className="p-2">Created By</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.length===0 && (
              <tr><td className="p-2 text-gray-500" colSpan={8}>No data</td></tr>
            )}
            {viewRows.map((r)=>(
              <tr key={r.production_id} className="border-t">
                <td className="p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.product_image ? <img src={r.product_image} alt={r.product_name} className="w-12 h-12 object-cover rounded"/> : <div className="w-12 h-12 bg-gray-100 rounded"/>}
                </td>
                <td className="p-2">{r.production_id}</td>
                <td className="p-2">{r.product_code}</td>
                <td className="p-2">{r.product_name}</td>
                <td className="p-2">{r.expected_date ? new Date(r.expected_date).toLocaleDateString() : '-'}</td>
                <td className="p-2">
                  <div className="w-40 bg-gray-100 rounded h-2">
                    <div className="bg-green-600 h-2 rounded" style={{ width: `${Math.round(r.progress_percent || 0)}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{Math.round(r.progress_percent || 0)}%</div>
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.created_by || '-'}</td>
                <td className="p-2 space-y-1">
                  <button
                    className="text-blue-600 underline block text-left"
                    onClick={() => router.push(`/user-dashboard/productions/status/${encodeURIComponent(r.production_id)}/process`)}
                  >
                    Process
                  </button>
                  <button
                    className="text-amber-600 underline block text-left"
                    onClick={() => router.push(`/user-dashboard/productions/status/${encodeURIComponent(r.production_id)}/update-bom`)}
                  >
                    Update BOM
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-2 md:hidden">
        {viewRows.length===0 && <div className="text-sm text-gray-500">No data</div>}
        {viewRows.map((r) => (
          <div key={r.production_id} className="rounded border bg-white p-3 flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.product_image ? <img src={r.product_image} alt={r.product_name} className="w-14 h-14 object-cover rounded"/> : <div className="w-14 h-14 bg-gray-100 rounded"/>}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{r.product_name}</div>
                <div className="text-xs text-gray-500 shrink-0">{r.created_by || '-'}</div>
              </div>
              <div className="text-xs text-gray-500">ID: {r.production_id}</div>
              <div className="text-xs text-gray-500">{r.product_code}</div>
              <div className="text-xs text-gray-500">{r.expected_date ? new Date(r.expected_date).toLocaleDateString() : '-'}</div>
              <div className="mt-2">
                <div className="h-2 bg-gray-100 rounded">
                  <div className="h-2 bg-green-600 rounded" style={{ width: `${Math.round(r.progress_percent || 0)}%` }} />
                </div>
                <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                  <span>Status: {r.status}</span>
                  <span>{Math.round(r.progress_percent || 0)}%</span>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  className="px-3 py-1 rounded bg-blue-600 text-white text-xs"
                  onClick={() => router.push(`/user-dashboard/productions/status/${encodeURIComponent(r.production_id)}/process`)}
                >
                  Process
                </button>
                <button
                  className="px-3 py-1 rounded bg-amber-600 text-white text-xs"
                  onClick={() => router.push(`/user-dashboard/productions/status/${encodeURIComponent(r.production_id)}/update-bom`)}
                >
                  Update BOM
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddProductionModal onClose={()=>setShowAdd(false)} onSaved={()=>{ setShowAdd(false); load(); }} />
      )}
    </div>

    </>
  );
}

function AddProductionModal({ onClose, onSaved }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [expected, setExpected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{
    const t = setTimeout(async ()=>{
      if (!query || product) return;
      try {
        // Fetch products that have active BOMs, then filter by query
        const res = await fetch(`/api/productions/bom/list`, { cache: 'no-store' });
        const raw = await res.json();
        const rows = Array.isArray(raw) ? raw : raw.items || [];
        const q = query.toLowerCase();
        const filtered = rows.filter(r => {
          const name = String(r.product_name || '').toLowerCase();
          const code = String(r.product_code || '').toLowerCase();
          const spec = String(r.specification || '').toLowerCase();
          return name.includes(q) || code.includes(q) || spec.includes(q);
        });
        // Map to shape expected by the UI
        setResults(filtered.map(r => ({
          item_code: r.product_code,
          item_name: r.product_name,
          product_image: r.product_image,
        })));
      } catch {}
    }, 250);
    return ()=>clearTimeout(t);
  }, [query, product]);

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      if (!product) throw new Error("Select a product");
      if (!qty || Number(qty) < 1) throw new Error("Enter quantity >= 1");
      if (!expected) throw new Error("Expected date is required");
      const body = { product_code: product.item_code, qty: Number(qty)||0, expected_date: expected };
      const res = await fetch("/api/productions/status/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded shadow-lg w-[95vw] sm:w-full max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-4" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Add in Production</div>
          <button onClick={onClose} className="text-sm text-gray-500">Close</button>
        </div>
        {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}

        {!product ? (
          <div>
            <div className="text-sm mb-1">Search product</div>
            <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search name/code/spec" className="w-full border p-2 rounded" />
            <div className="max-h-64 overflow-auto mt-2 divide-y">
              {results.map((p)=>(
                <button key={p.id || p.item_code} className="w-full text-left p-2 hover:bg-gray-50 flex gap-3 items-center" onClick={()=> setProduct(p)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.product_image ? <img src={p.product_image} alt={p.item_name} className="w-12 h-12 object-cover rounded"/> : <div className="w-12 h-12 bg-gray-100 rounded"/>}
                  <div>
                    <div className="font-medium text-sm">{p.item_name}</div>
                    <div className="text-xs text-gray-500">{p.item_code}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="font-medium">{product.item_name} <span className="text-xs text-gray-500">({product.item_code})</span></div>
            <div className="flex items-center gap-3">
              <label className="w-28 text-sm">Quantity<span className="text-red-600">*</span></label>
              <input required type="number" min={1} value={qty} onChange={(e)=>setQty(e.target.value)} className="w-32 border p-2 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <label className="w-28 text-sm">Expected Date<span className="text-red-600">*</span></label>
              <input required type="date" value={expected} onChange={(e)=>setExpected(e.target.value)} className="w-48 border p-2 rounded" />
            </div>

            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded border" onClick={onClose}>Cancel</button>
              <button disabled={saving || !expected || !qty || Number(qty) < 1} className="px-3 py-2 rounded bg-green-600 text-white text-sm" onClick={save}>{saving?"Saving…":"Save"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
