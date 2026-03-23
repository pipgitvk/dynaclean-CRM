"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import toast from "react-hot-toast";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function numCell(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function numMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ImportCrmAgentQuoteSubmissionsClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/import-crm/agent-quotations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load");
      setRows(data.quotations || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = Object.values(r)
        .filter((v) => v != null && v !== "")
        .map((v) => String(v))
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, searchText]);

  const summaryHeaders = [
    "ID",
    "Supplier",
    "Submitted",
    "Shipment ID",
    "Agent ID",
    "Total (INR)",
    "Remarks",
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search agent, shipment, amounts, remarks…"
              autoComplete="off"
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="h-11 shrink-0 rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <p className="mb-3 text-sm text-slate-600">
        Data from the public agent quote link (one submission per agent link).
        Use a row to expand all freight / clearance fields.
      </p>

      <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-500">
            Loading…
          </div>
        ) : null}
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[56rem] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="w-10 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:text-xs"
                />
                {summaryHeaders.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3 sm:text-xs"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={summaryHeaders.length + 1}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    {searchText.trim()
                      ? "No rows match this search."
                      : "No submissions yet. When an agent opens the shared link and submits the form, it will appear here."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const open = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className="bg-white hover:bg-slate-50/80">
                        <td className="px-2 py-2.5 sm:px-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(open ? null : r.id)
                            }
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            aria-expanded={open}
                          >
                            {open ? "−" : "+"}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 font-medium text-slate-900 sm:px-4 sm:py-3">
                          {r.id}
                        </td>
                        <td className="max-w-[12rem] px-2 py-2.5 sm:max-w-[16rem] sm:px-4 sm:py-3">
                          <span className="line-clamp-2 font-medium text-slate-800">
                            {r.agent_name || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-700 sm:px-4 sm:py-3">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-2.5 font-mono text-xs sm:px-4 sm:py-3">
                          {r.shipment_id || "—"}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-2.5 font-mono text-xs sm:px-4 sm:py-3">
                          {r.agent_id || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-slate-800 sm:px-4 sm:py-3">
                          {numMoney(r.total_cost_inr)}
                        </td>
                        <td
                          className="max-w-[14rem] px-2 py-2.5 text-xs text-slate-600 sm:px-4 sm:py-3"
                          title={r.remarks || undefined}
                        >
                          <span className="line-clamp-2">
                            {r.remarks || "—"}
                          </span>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-slate-50/90">
                          <td
                            colSpan={summaryHeaders.length + 1}
                            className="px-3 py-4 sm:px-6"
                          >
                            <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
                              <DetailBlock
                                title="Ocean & origin"
                                items={[
                                  ["Ocean freight", numCell(r.ocean_freight)],
                                  ["Origin CFS", numCell(r.origin_cfs)],
                                  ["Origin customs", numCell(r.origin_customs)],
                                  ["Origin docs", numCell(r.origin_docs)],
                                  ["Origin VGM", numCell(r.origin_vgm)],
                                ]}
                              />
                              <DetailBlock
                                title="Destination"
                                items={[
                                  [
                                    "CC fee",
                                    numCell(r.destination_cc_fee),
                                  ],
                                  ["THC", numCell(r.destination_thc)],
                                  ["DO fee", numCell(r.destination_do_fee)],
                                  [
                                    "Deconsole fee",
                                    numCell(r.destination_deconsole_fee),
                                  ],
                                  ["GST", numCell(r.destination_gst)],
                                ]}
                              />
                              <DetailBlock
                                title="Clearance"
                                items={[
                                  [
                                    "Agency",
                                    numCell(r.clearance_agency),
                                  ],
                                  [
                                    "Loading",
                                    numCell(r.clearance_loading),
                                  ],
                                  ["EDI", numCell(r.clearance_edi)],
                                  ["Exam", numCell(r.clearance_exam)],
                                  [
                                    "CFS (actual)",
                                    numCell(r.clearance_cfs_actual),
                                  ],
                                  [
                                    "Transport (actual)",
                                    numCell(r.clearance_transport_actual),
                                  ],
                                  ["Misc", numCell(r.clearance_misc)],
                                ]}
                              />
                              <div className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-3">
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Exchange rate & full remarks
                                </p>
                                <p className="text-slate-800">
                                  <span className="text-slate-500">
                                    Exchange rate:{" "}
                                  </span>
                                  {numCell(r.exchange_rate)}
                                </p>
                                {r.remarks ? (
                                  <p className="mt-2 whitespace-pre-wrap text-slate-700">
                                    {r.remarks}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        <Link
          href="/admin-dashboard/import-crm/agents"
          className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          ← Agents
        </Link>
        <span className="mx-2 text-slate-300">·</span>
        <Link
          href="/admin-dashboard/import-crm/quote-submissions"
          className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          Supplier quote submissions
        </Link>
        <span className="mx-2 text-slate-300">·</span>
        <Link
          href="/admin-dashboard/import-crm/purchase-orders"
          className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          Purchase orders →
        </Link>
      </p>
    </>
  );
}

function DetailBlock({ title, items }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <dl className="space-y-1.5">
        {items.map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between gap-2 text-slate-800"
          >
            <dt className="text-slate-500">{k}</dt>
            <dd className="tabular-nums text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
