"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { CalendarDays, ChevronDown, Loader2 } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { getCurrentMonthThroughTodayIso } from "@/lib/crmDateFormat";
import { SBI_HUB_PERIOD_OPTIONS, SBI_RANGE_SELECT } from "@/lib/serviceBeforeInstallationFilters";
import { getServiceBeforeInstallationCards } from "@/lib/serviceBeforeInstallationHub";
import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

const TECHNICIAN_SRC = "/images/service-before-installation-technician.png";

function pctChange(current, previous) {
  if (previous === undefined || previous === null) return null;
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function HeaderTechnicianArt() {
  return (
    <div className="relative flex min-h-[10.5rem] w-full items-center justify-end overflow-hidden bg-gradient-to-br from-violet-100/70 via-violet-50/40 to-white md:h-[11rem] md:min-h-0 lg:h-[11.5rem]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={TECHNICIAN_SRC}
        alt=""
        width={900}
        height={520}
        className="h-full w-full max-h-full object-contain object-center md:object-right"
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}

function SbiHubDateRangeControl({
  range,
  setRange,
  loading,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="relative inline-flex min-w-[12.5rem] flex-1 items-center sm:max-w-[19rem]">
        <CalendarDays className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-violet-600" aria-hidden />
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-violet-200/70 bg-white/95 py-2.5 pl-10 pr-9 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm transition hover:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          aria-label="Time period"
        >
          {SBI_HUB_PERIOD_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400" aria-hidden />
      </div>
      {range === "custom" ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-violet-100 bg-white/95 p-2.5 shadow-sm">
          <div className="min-w-[8.5rem]">
            <label className="mb-1 block text-xs font-semibold text-slate-500">From</label>
            <TypeableDateFilterInput
              value={customFrom}
              onChange={onCustomFromChange}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
          </div>
          <div className="min-w-[8.5rem]">
            <label className="mb-1 block text-xs font-semibold text-slate-500">To</label>
            <TypeableDateFilterInput
              value={customTo}
              onChange={onCustomToChange}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={onApplyCustom}
            disabled={loading}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            Apply
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function ServiceBeforeInstallationHubClient({
  dashboardBase = "admin-dashboard",
  initialCounts = null,
}) {
  const cards = useMemo(
    () => getServiceBeforeInstallationCards(dashboardBase),
    [dashboardBase],
  );
  const monthDefault = useMemo(() => getCurrentMonthThroughTodayIso(), []);
  const [counts, setCounts] = useState(initialCounts || {});
  const [prevCounts, setPrevCounts] = useState({});
  const [loading, setLoading] = useState(!initialCounts);
  const [range, setRange] = useState(SBI_RANGE_SELECT.id);
  const skipInitialFetch = useRef(Boolean(initialCounts));
  const [customFrom, setCustomFrom] = useState(monthDefault.from);
  const [customTo, setCustomTo] = useState(monthDefault.to);
  const [appliedCustom, setAppliedCustom] = useState({
    from: monthDefault.from,
    to: monthDefault.to,
  });
  const customDraftRef = useRef(appliedCustom);
  useEffect(() => {
    customDraftRef.current = { from: customFrom, to: customTo };
  }, [customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { range };
      if (range === "custom") {
        params.from = appliedCustom.from;
        params.to = appliedCustom.to;
      }
      const res = await axios.get("/api/service-before-installation/hub", {
        params,
        timeout: 25_000,
      });
      if (res.data?.success) {
        setCounts(res.data.counts || {});
        setPrevCounts(res.data.prevCounts || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [range, appliedCustom.from, appliedCustom.to]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    if (range === "custom") return;
    load();
  }, [range, load]);

  const applyCustomRange = useCallback(() => {
    const { from, to } = customDraftRef.current;
    setAppliedCustom({ from, to });
    setLoading(true);
    axios
      .get("/api/service-before-installation/hub", {
        params: { range: "custom", from, to },
        timeout: 25_000,
      })
      .then((res) => {
        if (res.data?.success) {
          setCounts(res.data.counts || {});
          setPrevCounts(res.data.prevCounts || {});
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const changes = useMemo(() => {
    const out = {};
    for (const card of cards) {
      const key = card.countKey;
      out[key] = pctChange(counts[key], prevCounts[key]);
    }
    return out;
  }, [cards, counts, prevCounts]);

  return (
    <div className="relative min-h-screen w-full pb-8 pt-2 sm:pt-3">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-violet-100/45 via-violet-50/20 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 bottom-40 h-48 w-48 rounded-full bg-sky-200/20 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 px-1 sm:px-2">
        <header className="mb-6 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-[0_4px_24px_-6px_rgba(124,58,237,0.12)] backdrop-blur-sm md:grid md:grid-cols-2 md:items-center">
          <div className="flex min-w-0 flex-col justify-center px-4 py-4 sm:px-6 sm:py-5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-[2rem]">
              All Service{" "}
              <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                After Sales
              </span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
              Registered machines, pending installation, service cases, warranty and AMC — click a
              card for details.
            </p>

            <div className="mt-4 flex flex-wrap items-start gap-2 sm:gap-3">
              <SbiHubDateRangeControl
                range={range}
                setRange={setRange}
                loading={loading}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFromChange={setCustomFrom}
                onCustomToChange={setCustomTo}
                onApplyCustom={applyCustomRange}
              />
              {loading ? (
                <span className="inline-flex items-center self-center pl-1 text-violet-600">
                  <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading counts" />
                </span>
              ) : null}
            </div>
          </div>

          <HeaderTechnicianArt />
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <ServiceBeforeInstallationKpiCard
              key={card.id}
              card={card}
              total={counts[card.countKey] ?? 0}
              changePct={changes[card.countKey]}
              loading={loading}
            />
          ))}
        </div>
      </div>
    </div>
  );
}