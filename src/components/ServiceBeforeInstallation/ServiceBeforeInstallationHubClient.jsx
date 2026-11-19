"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CalendarDays, ChevronDown, Layers, Loader2, MapPin } from "lucide-react";
import { getServiceBeforeInstallationCards } from "@/lib/serviceBeforeInstallationHub";
import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

const TECHNICIAN_SRC = "/new pages image/Technician.png";

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

function FilterSelect({ icon: Icon, label, defaultValue, children }) {
  return (
    <label className="relative flex min-w-[9.5rem] flex-1 cursor-pointer items-center gap-2 rounded-xl border border-violet-200/70 bg-white/95 px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-violet-300 sm:max-w-[11.5rem]">
      <Icon className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        defaultValue={defaultValue}
        className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-sm font-semibold text-slate-800 focus:outline-none"
        aria-label={label}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400" aria-hidden />
    </label>
  );
}

export default function ServiceBeforeInstallationHubClient({
  dashboardBase = "admin-dashboard",
  initialCounts = null,
  initialPrevCounts = null,
}) {
  const cards = useMemo(
    () => getServiceBeforeInstallationCards(dashboardBase),
    [dashboardBase],
  );
  const [counts, setCounts] = useState(initialCounts || {});
  const [prevCounts, setPrevCounts] = useState(initialPrevCounts || {});
  const [loading, setLoading] = useState(!initialCounts);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/service-before-installation/hub");
      if (res.data?.success) {
        setCounts(res.data.counts || {});
        setPrevCounts(res.data.prevCounts || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialCounts) load();
  }, [initialCounts, load]);

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
              Service Before{" "}
              <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                Installation
              </span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
              Registered machines, pending installation, service cases, warranty and AMC — click a
              card for details.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
              <FilterSelect icon={CalendarDays} label="Time period" defaultValue="this_month">
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </FilterSelect>
              <FilterSelect icon={MapPin} label="Location" defaultValue="all">
                <option value="all">All Locations</option>
              </FilterSelect>
              <FilterSelect icon={Layers} label="Products" defaultValue="all">
                <option value="all">All Products</option>
              </FilterSelect>
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