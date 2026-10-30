"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PackageSearch,
  Search,
  AlertCircle,
  CheckCircle2,
  Copy,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  buildDelhiveryTrackingTimeline,
  formatDelhiveryTimelineDate,
  formatDelhiveryDateTime,
  orderStatusHeadline,
  isDelhiveryShipmentDelivered,
  delhiveryDisplayText,
} from "@/lib/delhiveryB2bTrackingUi";
import DelhiveryOrderDetailsPanel from "./DelhiveryOrderDetailsPanel";

function CopyLine({ label, value }) {
  const text = delhiveryDisplayText(value, "");
  if (!text || text === "—") return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="group flex w-full items-center gap-2 text-left text-sm text-white/95 hover:text-white"
    >
      <span className="text-white/80">{label}</span>
      <span className="font-semibold">#{text}</span>
      <Copy className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
    </button>
  );
}

export default function DelhiveryTrackingPage() {
  const searchParams = useSearchParams();
  const [trackingInput, setTrackingInput] = useState("");
  const [activeId, setActiveId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("tracking");
  const [lrSuggestions, setLrSuggestions] = useState([]);
  const [lrSuggestLoading, setLrSuggestLoading] = useState(false);
  const [lrDropdownOpen, setLrDropdownOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [syncProgress, setSyncProgress] = useState("");
  const [storedRows, setStoredRows] = useState([]);
  const [storedLoading, setStoredLoading] = useState(false);
  const searchWrapRef = useRef(null);
  const lrUrlBootstrapped = useRef(false);

  const fetchStoredTracking = useCallback(async () => {
    setStoredLoading(true);
    try {
      const res = await fetch("/api/delhivery/tracking-data?limit=500", {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setStoredRows(json.data);
      } else {
        setStoredRows([]);
      }
    } catch {
      setStoredRows([]);
    } finally {
      setStoredLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStoredTracking();
  }, [fetchStoredTracking]);

  const runSyncBatches = async ({ retryErrorsOnly = false, force = false } = {}) => {
    setSyncLoading(true);
    setSyncSummary(null);
    setSyncProgress("");
    let offset = 0;
    let saved = 0;
    let failed = 0;
    let totalEligible = 0;
    let skippedRecent = 0;

    try {
      for (;;) {
        setSyncProgress(
          retryErrorsOnly
            ? `Retrying failed LRs… (${offset} processed)`
            : `Syncing… (${offset} / ${totalEligible || "?"})`,
        );
        const res = await fetch("/api/delhivery/sync-tracking-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offset,
            batchSize: 12,
            retryErrorsOnly,
            force,
            freshHours: 6,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Sync failed");
        }
        totalEligible = json.totalEligible ?? totalEligible;
        skippedRecent = json.skippedRecent ?? skippedRecent;
        saved += Number(json.saved) || 0;
        failed += Number(json.failed) || 0;
        offset = json.nextOffset ?? offset;

        if (!json.hasMore) break;
        await new Promise((r) => setTimeout(r, 800));
      }

      const summary = {
        saved,
        failed,
        total: totalEligible,
        skippedRecent,
        retryErrorsOnly,
      };
      setSyncSummary(summary);
      toast.success(
        retryErrorsOnly
          ? `Retry done: ${saved} OK, ${failed} still failed`
          : `Sync done: ${saved} saved${skippedRecent ? ` · ${skippedRecent} skipped (fresh)` : ""}${failed ? ` · ${failed} failed` : ""}`,
      );
      await fetchStoredTracking();
    } catch (e) {
      toast.error(e?.message || "Could not sync tracking data");
    } finally {
      setSyncLoading(false);
      setSyncProgress("");
    }
  };

  const syncAllTracking = () => runSyncBatches({ retryErrorsOnly: false });
  const retryFailedTracking = () =>
    runSyncBatches({ retryErrorsOnly: true, force: true });

  const formatFetchedAt = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const fetchLrSuggestions = useCallback(async (query) => {
    setLrSuggestLoading(true);
    try {
      const params = new URLSearchParams({ limit: "25" });
      const q = String(query || "").trim();
      if (q) params.set("q", q);
      const res = await fetch(`/api/delhivery/order-lr-list?${params}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setLrSuggestions(json.data);
      } else {
        setLrSuggestions([]);
      }
    } catch {
      setLrSuggestions([]);
    } finally {
      setLrSuggestLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (lrDropdownOpen) fetchLrSuggestions(trackingInput);
    }, 200);
    return () => clearTimeout(t);
  }, [trackingInput, lrDropdownOpen, fetchLrSuggestions]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target)
      ) {
        setLrDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const pickLrSuggestion = (row) => {
    const lr = String(row?.lr_number || "").trim();
    if (!lr) return;
    setTrackingInput(lr);
    setLrDropdownOpen(false);
  };

  const runTrack = useCallback(async (idOverride) => {
    const id = String(idOverride ?? trackingInput).trim();
    if (!id) {
      setError("Please enter a tracking ID.");
      setResult(null);
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setTab("tracking");
    try {
      const params = new URLSearchParams({ trackingId: id });
      const res = await fetch(`/api/delhivery/b2b-track?${params}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = delhiveryDisplayText(
          json.error,
          "Tracking failed",
        );
        throw new Error(msg === "—" ? "Tracking failed" : msg);
      }
      setActiveId(id);
      setResult(json.data);
    } catch (e) {
      setError(e?.message || "Could not load tracking");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [trackingInput]);

  const lrFromUrl = String(searchParams?.get("lr") || "").trim();

  useEffect(() => {
    if (!lrFromUrl || lrUrlBootstrapped.current) return;
    lrUrlBootstrapped.current = true;
    setTrackingInput(lrFromUrl);
    runTrack(lrFromUrl);
  }, [lrFromUrl, runTrack]);

  const onSubmit = (e) => {
    e.preventDefault();
    runTrack();
  };

  const timeline = result ? buildDelhiveryTrackingTimeline(result) : [];
  const awb = result?.mwbn || "";
  const lr = result?.lrnum || activeId;

  return (
    <div className="mx-auto w-full max-w-[min(100%,90rem)] p-4 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <PackageSearch className="h-8 w-8 text-[#3B966F]" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Delhivery B2B Tracking
          </h1>
          <p className="text-sm text-gray-600">
            Track shipment by LR / waybill number
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Tracking ID
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div ref={searchWrapRef} className="relative flex-1">
            <input
              type="text"
              value={trackingInput}
              onChange={(e) => {
                setTrackingInput(e.target.value);
                setLrDropdownOpen(true);
              }}
              onFocus={() => {
                setLrDropdownOpen(true);
                fetchLrSuggestions(trackingInput);
              }}
              placeholder="Search order ID or LR number (e.g. 20261027007, 321588333)"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#3B966F] focus:outline-none focus:ring-2 focus:ring-[#3B966F]/20"
              autoComplete="off"
              role="combobox"
              aria-expanded={lrDropdownOpen}
              aria-autocomplete="list"
            />
            {lrDropdownOpen && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                {lrSuggestLoading && lrSuggestions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">Loading…</p>
                ) : lrSuggestions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    No Delhivery LRs found. Type order ID or LR to search.
                  </p>
                ) : (
                  lrSuggestions.map((row) => (
                    <button
                      key={`${row.order_id}-${row.lr_number}-${row.source || "n"}-${row.batch_sequence_no ?? "x"}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickLrSuggestion(row)}
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-[#3B966F]/10"
                    >
                      <span className="font-medium text-gray-900">
                        LR {row.lr_number}
                        <span className="font-normal text-gray-500">
                          {" "}
                          · Order {row.order_id}
                        </span>
                      </span>
                      {row.booking_url ? (
                        <span className="truncate text-xs text-gray-400">
                          {row.booking_url}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3B966F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#338664] disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading ? "Loading…" : "Track"}
          </button>
        </div>
      </form>

      <div className="mb-6 space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {result ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
            <div className="bg-[#3B966F] px-5 pb-6 pt-5 text-white">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  {orderStatusHeadline(result.status)}
                </h2>
                {isDelhiveryShipmentDelivered(
                  result.status,
                  result.delivered_date,
                ) && (
                  <CheckCircle2 className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                )}
              </div>
              <div className="mt-4 space-y-2">
                {awb ? <CopyLine label="AWB" value={awb} /> : null}
                {lr ? <CopyLine label="LR Number" value={lr} /> : null}
              </div>
            </div>

            <div className="px-3 pb-1 pt-3">
              <div className="flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setTab("tracking")}
                  className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
                    tab === "tracking"
                      ? "bg-black text-white shadow-sm"
                      : "text-gray-800 hover:bg-white/60"
                  }`}
                >
                  Tracking
                </button>
                <button
                  type="button"
                  onClick={() => setTab("details")}
                  className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
                    tab === "details"
                      ? "bg-black text-white shadow-sm"
                      : "text-gray-800 hover:bg-white/60"
                  }`}
                >
                  Order Details
                </button>
              </div>
            </div>

            {tab === "tracking" ? (
              <div className="px-5 py-6">
                {timeline.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">
                    No tracking milestones available for this shipment.
                  </p>
                ) : (
                  <ul className="list-none">
                    {timeline.map((step, idx) => {
                      const isLast = idx === timeline.length - 1;
                      const highlight = step.highlight || isLast;
                      const isDelivered =
                        String(step.label).toLowerCase() === "delivered";
                      const dotFilled = isDelivered && highlight;

                      return (
                        <li
                          key={`${step.key}-${step.at}`}
                          className="relative pl-9 pb-8 last:pb-0"
                        >
                          {!isLast ? (
                            <span
                              className="absolute left-[7px] top-[1.125rem] bottom-0 w-0.5 bg-[#3B966F]"
                              aria-hidden
                            />
                          ) : null}
                          <span
                            className={`absolute left-0 top-0.5 box-border h-4 w-4 shrink-0 rounded-full border-2 border-[#3B966F] ${
                              dotFilled ? "bg-[#3B966F]" : "bg-white"
                            }`}
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] leading-snug">
                              <span
                                className={`inline-flex items-center gap-1.5 font-semibold ${
                                  highlight ? "text-[#3B966F]" : "text-gray-800"
                                }`}
                              >
                                {step.label}
                                {isDelivered && highlight ? (
                                  <CheckCircle2
                                    className="h-4 w-4 text-[#3B966F]"
                                    strokeWidth={2.5}
                                  />
                                ) : null}
                              </span>
                              <span className="text-gray-300">|</span>
                              <span className="text-gray-500 italic">
                                {formatDelhiveryTimelineDate(step.at)}
                              </span>
                            </div>
                            {step.footnote ? (
                              <p className="mt-1.5 text-sm text-gray-500">
                                {step.footnote}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <DelhiveryOrderDetailsPanel result={result} awb={awb} lr={lr} />
            )}
          </div>
        ) : null}

        {!activeId && !loading && !error ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-gray-500">
            <PackageSearch className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <p className="font-medium text-gray-700">
              Search a delivery order LR above
            </p>
            <p className="mt-1 text-sm">
              Pick from recent Delhivery shipments or type order ID / LR, then
              Track.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Saved tracking data
            </h2>
            <p className="text-sm text-gray-500">
              Table <code className="text-xs">tracking_data</code> — synced in
              small batches (~2s/LR). Saved rows are kept; failed refresh does
              not erase last good data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retryFailedTracking}
              disabled={syncLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              Retry failed only
            </button>
            <button
              type="button"
              onClick={syncAllTracking}
              disabled={syncLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#3B966F] bg-[#3B966F]/10 px-4 py-2.5 text-sm font-semibold text-[#2d7358] hover:bg-[#3B966F]/20 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncLoading ? "animate-spin" : ""}`}
              />
              {syncLoading ? "Syncing…" : "Fetch all tracking data"}
            </button>
          </div>
        </div>
        {syncProgress ? (
          <p className="mb-2 text-sm font-medium text-[#2d7358]">
            {syncProgress}
          </p>
        ) : null}
        {syncSummary ? (
          <p className="mb-3 text-sm text-gray-600">
            Last run: {syncSummary.saved} saved, {syncSummary.failed} failed
            {syncSummary.skippedRecent
              ? ` · ${syncSummary.skippedRecent} skipped (synced in last 6h)`
              : ""}{" "}
            (of {syncSummary.total} to update)
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[96rem] table-auto text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  Tracking ID (LR)
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  Order
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  Type
                </th>
                <th className="min-w-[8rem] px-3 py-2.5 font-semibold">Status</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  Pickup date
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  Est. delivery
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  Delivery date
                </th>
                <th className="min-w-[14rem] px-3 py-2.5 font-semibold">
                  Latest remark
                </th>
                <th className="min-w-[12rem] px-3 py-2.5 font-semibold">
                  Location
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  Fetched
                </th>
                <th className="min-w-[16rem] px-3 py-2.5 font-semibold">Error</th>
              </tr>
            </thead>
            <tbody>
              {storedLoading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                    Loading saved data…
                  </td>
                </tr>
              ) : storedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                    No rows yet. Click &quot;Fetch all tracking data&quot; to pull
                    Delhivery status for every LR in tracking_id.
                  </td>
                </tr>
              ) : (
                storedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-3 py-2 align-top font-medium text-gray-900">
                      <button
                        type="button"
                        className="text-[#3B966F] hover:underline"
                        onClick={() => {
                          setTrackingInput(row.tracking_id);
                          runTrack(row.tracking_id);
                        }}
                      >
                        {row.tracking_id}
                      </button>
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top text-gray-700">
                      {row.order_id || "—"}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top capitalize text-gray-600">
                      {row.shipment_type || "—"}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top text-gray-800">
                      {row.status || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-gray-700">
                      {formatDelhiveryDateTime(row.pickup_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-gray-700">
                      {formatDelhiveryDateTime(row.estimated_delivery_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-gray-700">
                      {formatDelhiveryDateTime(row.delivered_date)}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top text-gray-600">
                      {row.scan_remark || "—"}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top text-gray-600">
                      {row.location || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-gray-500">
                      {formatFetchedAt(row.fetched_at)}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top text-sm leading-snug text-red-700">
                      {row.fetch_error || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
