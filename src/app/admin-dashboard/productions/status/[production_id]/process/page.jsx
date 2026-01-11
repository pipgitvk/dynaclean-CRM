"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ProductionProcessPage() {
  const { production_id } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issue, setIssue] = useState(null); // { spare_id, qty, warehouse, assembly }
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const res = await fetch(`/api/productions/process?production_id=${encodeURIComponent(production_id)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load');
        setData(json);
      }catch(e){
        setError(String(e.message||e));
      }finally{ setLoading(false); }
    })();
  }, [production_id]);

  const startIssue = (spare_id)=>{
    setIssue({ spare_id, qty: 1, warehouse: 'Delhi - Mundka', assembly: '' });
  };

  const submitIssue = async ()=>{
    try{
      setSaving(true);
      setError("");
      if (!issue?.spare_id || !issue?.qty || !issue?.warehouse) throw new Error('Fill all fields');
      const body = {
        production_id,
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
      const r2 = await fetch(`/api/productions/process?production_id=${encodeURIComponent(production_id)}`, { cache: 'no-store' });
      const j2 = await r2.json();
      setData(j2);
      setLoading(false);
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
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Production Process</h1>
        <button onClick={() => router.back()} className="px-3 py-2 rounded border text-sm">Back</button>
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
  );
}
