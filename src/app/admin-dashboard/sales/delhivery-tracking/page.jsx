"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PackageSearch,
  Search,
  AlertCircle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  buildDelhiveryTrackingTimeline,
  formatDelhiveryTimelineDate,
  orderStatusHeadline,
} from "@/lib/delhiveryB2bTrackingUi";
import DelhiveryOrderDetailsPanel from "./DelhiveryOrderDetailsPanel";

function CopyLine({ label, value }) {
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
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
      <span className="font-semibold">#{value}</span>
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
  const searchWrapRef = useRef(null);
  const lrUrlBootstrapped = useRef(false);

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
        throw new Error(json.error || "Tracking failed");
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
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
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

      {!activeId && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-gray-500">
          <PackageSearch className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p className="font-medium text-gray-700">
            Search a delivery order LR above
          </p>
          <p className="mt-1 text-sm">
            Pick from recent Delhivery shipments or type order ID / LR, then
            Track.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="bg-[#3B966F] px-5 pb-6 pt-5 text-white">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">
                {orderStatusHeadline(result.status)}
              </h2>
              {String(result.status || "")
                .toUpperCase()
                .includes("DELIVER") && (
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
      )}
    </div>
  );
}
