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

function textOrDash(v) {
  if (v == null) return "—";
  const s = String(v).trim();
  return s === "" ? "—" : s;
}

function fileLabel(path) {
  if (path == null || String(path).trim() === "") return "—";
  const parts = String(path).replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function parseOtherDocsJson(raw) {
  if (raw == null || String(raw).trim() === "") return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function totalInrNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Quote row ids whose total (INR) is the lowest among rows with the same shipment_id (ties → all L1). */
function computeL1QuoteIds(quoteRows) {
  const byShipment = new Map();
  for (const r of quoteRows) {
    const sid =
      r.shipment_id != null && String(r.shipment_id).trim() !== ""
        ? String(r.shipment_id).trim()
        : null;
    if (!sid) continue;
    const n = totalInrNumber(r.total_cost_inr);
    if (n == null) continue;
    const list = byShipment.get(sid) ?? [];
    const idNorm = Number(r.id);
    list.push({ idKey: Number.isFinite(idNorm) ? idNorm : r.id, n });
    byShipment.set(sid, list);
  }
  const l1 = new Set();
  for (const list of byShipment.values()) {
    if (list.length === 0) continue;
    const minN = Math.min(...list.map((x) => x.n));
    for (const x of list) {
      if (x.n === minN) l1.add(x.idKey);
    }
  }
  return l1;
}

export default function ImportCrmQuoteSubmissionsClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [awardBusyId, setAwardBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/import-crm/quotations");
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

  const l1QuoteIds = useMemo(() => computeL1QuoteIds(rows), [rows]);

  const summaryHeaders = [
    "ID",
    "Submitted",
    "Shipment ID",
    "Submitter email",
    "Agent ID",
    "Total (INR)",
    "Remarks",
    "Award",
  ];

  const postAward = useCallback(async (quoteId, clear) => {
    setAwardBusyId(quoteId);
    try {
      const res = await fetch(`/api/import-crm/quotations/${quoteId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clear ? { clear: true } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      toast.success(data.message || (clear ? "Award cleared" : "Awarded"));
      if (!clear && data.emailError) {
        toast.error(`Email: ${data.emailError}`, { duration: 8000 });
      }
      if (!clear && data.portalUrl) {
        if (data.emailSkipped) {
          toast.error(
            "No valid submitter email — the form link was not sent.",
            { duration: 8000 },
          );
        } else {
          toast.error(
            "Email did not send — fix SMTP and NEXT_PUBLIC_BASE_URL, then award again to resend.",
            { duration: 10000 },
          );
        }
      }
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Could not update award");
    } finally {
      setAwardBusyId(null);
    }
  }, [load]);

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
              placeholder="Search shipment, email, agent, amounts, remarks…"
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

      <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-500">
            Loading…
          </div>
        ) : null}
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[64rem] w-full divide-y divide-slate-200 text-sm">
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
                      : "No submissions yet. When someone submits the form on a shipment share link, it will appear here."}
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
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-700 sm:px-4 sm:py-3">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-2.5 font-mono text-xs sm:px-4 sm:py-3">
                          {r.shipment_id || "—"}
                        </td>
                        <td className="max-w-[12rem] break-all px-2 py-2.5 text-xs text-slate-800 sm:px-4 sm:py-3">
                          {r.submitter_email?.trim() ? (
                            <span title={r.submitter_email}>
                              {r.submitter_email}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-2.5 font-mono text-xs sm:px-4 sm:py-3">
                          {r.agent_id || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-slate-800 sm:px-4 sm:py-3">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {numMoney(r.total_cost_inr)}
                            {l1QuoteIds.has(
                              Number.isFinite(Number(r.id)) ? Number(r.id) : r.id,
                            ) ? (
                              <span
                                className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900"
                                title="Lowest total (INR) for this shipment in the list"
                              >
                                L1
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td
                          className="max-w-[14rem] px-2 py-2.5 text-xs text-slate-600 sm:px-4 sm:py-3"
                          title={r.remarks || undefined}
                        >
                          <span className="line-clamp-2">
                            {r.remarks || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 sm:px-4 sm:py-3">
                          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                            {r.awarded_at ? (
                              <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                                Awarded
                              </span>
                            ) : null}
                            {r.awarded_at ? (
                              <span
                                className={`shrink-0 text-[10px] font-medium ${
                                  r.award_form_submitted_at
                                    ? "text-emerald-700"
                                    : "text-slate-500"
                                }`}
                                title={
                                  r.award_form_submitted_at
                                    ? `Follow-up form submitted ${formatDate(r.award_form_submitted_at)}`
                                    : "Follow-up form not submitted yet"
                                }
                              >
                                {r.award_form_submitted_at
                                  ? "Form ✓"
                                  : "Form pending"}
                              </span>
                            ) : null}
                            {r.awarded_at ? (
                              r.award_form_submitted_at ? null : (
                                <button
                                  type="button"
                                  disabled={awardBusyId === r.id}
                                  title="Remove award for this shipment"
                                  onClick={() => postAward(r.id, true)}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  {awardBusyId === r.id ? "…" : "Revoke"}
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                disabled={awardBusyId === r.id}
                                onClick={() => postAward(r.id, false)}
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {awardBusyId === r.id ? "…" : "Award"}
                              </button>
                            )}
                          </div>
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
                              {r.award_form_submitted_at ? (
                                <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
                                    Award follow-up (submitted{" "}
                                    {formatDate(r.award_form_submitted_at)})
                                  </p>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        Pickup & supplier
                                      </p>
                                      <AwardText
                                        label="Pickup person details"
                                        value={r.af_pickup_person_details}
                                      />
                                      <AwardText
                                        label="Supplier address"
                                        value={r.af_supplier_address}
                                      />
                                      <AwardText
                                        label="Cargo ready confirmation"
                                        value={r.af_cargo_ready_confirmation}
                                      />
                                    </div>
                                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        Booking & movement
                                      </p>
                                      <AwardText
                                        label="Booking details"
                                        value={r.af_booking_details}
                                      />
                                      <AwardText
                                        label="Vessel / flight"
                                        value={r.af_vessel_flight_details}
                                      />
                                      <AwardText
                                        label="Container (FCL)"
                                        value={r.af_container_details}
                                      />
                                    </div>
                                  </div>
                                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Uploaded files (server paths)
                                    </p>
                                    <ul className="space-y-1 font-mono text-[11px] text-slate-700">
                                      <li>
                                        BL: {fileLabel(r.af_bl_file)}
                                      </li>
                                      <li>
                                        Invoice: {fileLabel(r.af_invoice_file)}
                                      </li>
                                      <li>
                                        Packing list:{" "}
                                        {fileLabel(r.af_packing_list_file)}
                                      </li>
                                    </ul>
                                    {parseOtherDocsJson(r.af_other_documents_json)
                                      .length ? (
                                      <ul className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 font-mono text-[11px] text-slate-600">
                                        {parseOtherDocsJson(
                                          r.af_other_documents_json,
                                        ).map((o, i) => (
                                          <li key={i}>
                                            Other: {o.name || fileLabel(o.path)}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
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
          href="/admin-dashboard/import-crm/shipments"
          className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          ← Shipments
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

function AwardText({ label, value }) {
  const v = textOrDash(value);
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{v}</p>
    </div>
  );
}
