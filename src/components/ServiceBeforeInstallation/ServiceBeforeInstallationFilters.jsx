"use client";

import { useEffect, useMemo, useState } from "react";
import { ListFilter, RotateCcw, Search } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { EMPTY_SBI_FILTERS } from "@/lib/serviceBeforeInstallationFilters";

const filterSelectClass =
  "rounded-xl border-slate-200 py-2.5 text-slate-800 focus:border-violet-300 focus:ring-violet-500/20";

const SEARCH_PLACEHOLDER = {
  serviceRecord: "Search service id, serial, customer, model, engineer…",
  upcomingOrder: "Search order, company, serial, model, invoice…",
  warranty: "Search customer, serial, model, invoice, address…",
  amc: "Search company, serial, model, contact…",
};

/** Common service_records.status values (matches Service Records filters). */
const SERVICE_RECORD_STATUS_PRESETS = [
  "PENDING",
  "PLANNED",
  "PENDING FOR SPARES",
  "PENDING BY CUSTOMER",
  "IN PROGRESS",
  "WORKED",
];

function getSegmentFilterKind(segment) {
  if (segment === "open-completions") {
    return "serviceRecord";
  }
  if (segment === "open-installation" || segment === "overdue-delayed-installation") {
    return "upcomingOrder";
  }
  if (segment === "active-amc" || segment === "due-amc-expiring") {
    return "amc";
  }
  return "warranty";
}

function ServiceEngineerFilterSelect({ value, onChange, className = "xl:col-span-3" }) {
  const [engineers, setEngineers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [internalRes, thirdRes] = await Promise.all([
          fetch("/api/service-engineers/active", { cache: "no-store" }),
          fetch("/api/third-party-engineers/active", { cache: "no-store" }),
        ]);
        const internalData = internalRes.ok ? await internalRes.json() : {};
        const thirdData = thirdRes.ok ? await thirdRes.json() : [];
        const internal = (internalData.users || []).map((u) => String(u.username || "").trim()).filter(Boolean);
        const thirdParty = (Array.isArray(thirdData) ? thirdData : [])
          .map((e) => String(e.name || "").trim())
          .filter(Boolean);
        const merged = [...new Set([...internal, ...thirdParty])].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" }),
        );
        if (!cancelled) setEngineers(merged);
      } catch {
        if (!cancelled) setEngineers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    const base = [{ value: "", label: "All engineers" }];
    const names = new Set(engineers);
    const current = String(value || "").trim();
    if (current) names.add(current);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return [...base, ...sorted.map((name) => ({ value: name, label: name }))];
  }, [engineers, value]);

  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Service engineer
      </span>
      <SearchableSelect
        options={options}
        value={value || ""}
        onChange={onChange}
        placeholder="All engineers"
        searchPlaceholder="Search engineer…"
        className={`w-full min-w-0 ${filterSelectClass}`}
      />
    </label>
  );
}

function ServiceStatusFilterSelect({ value, onChange, className = "xl:col-span-3" }) {
  const options = useMemo(() => {
    const base = [{ value: "", label: "All statuses" }];
    const statuses = new Set(SERVICE_RECORD_STATUS_PRESETS);
    const current = String(value || "").trim();
    if (current) statuses.add(current);
    const sorted = [...statuses].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    return [...base, ...sorted.map((status) => ({ value: status, label: status }))];
  }, [value]);

  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Status
      </span>
      <SearchableSelect
        options={options}
        value={value || ""}
        onChange={onChange}
        placeholder="All statuses"
        searchPlaceholder="Search status…"
        className={`w-full min-w-0 ${filterSelectClass}`}
      />
    </label>
  );
}

function FilterInput({ label, placeholder, value, onChange, className = "xl:col-span-3" }) {
  return (
    <label className={`block min-w-0 sm:col-span-1 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
    </label>
  );
}

function ItemTypeFilterSelect({ value, onChange, className = "xl:col-span-3" }) {
  const options = [
    { value: "", label: "All (Products & Spares)" },
    { value: "products", label: "Products" },
    { value: "spares", label: "Spares" },
  ];
  return (
    <label className={`block min-w-0 sm:col-span-1 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Item type
      </span>
      <SearchableSelect
        options={options}
        value={value || ""}
        onChange={onChange}
        placeholder="All (Products & Spares)"
        searchPlaceholder="Search type…"
        className={`w-full min-w-0 ${filterSelectClass}`}
      />
    </label>
  );
}

export default function ServiceBeforeInstallationFilters({
  value,
  onChange,
  onApply,
  onClear,
  loading = false,
  className = "",
  segment = "",
}) {
  const draft = value || EMPTY_SBI_FILTERS;
  const kind = getSegmentFilterKind(segment);

  const setField = (key) => (val) => {
    onChange?.({ ...draft, [key]: val });
  };

  const row1Field = "col-span-full sm:col-span-2 xl:col-span-6";
  const row1Date = "col-span-full sm:col-span-1 xl:col-span-3";
  const row2Field = "xl:col-span-3";

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${className}`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <label className={`relative block min-w-0 ${row1Field}`}>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
          </span>
          <Search className="pointer-events-none absolute left-3 top-[2.15rem] h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={draft.search}
            onChange={(e) => setField("search")(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onApply?.();
            }}
            placeholder={SEARCH_PLACEHOLDER[kind] || SEARCH_PLACEHOLDER.warranty}
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </label>

        <label className={`block min-w-0 ${row1Date}`}>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
          </span>
          <TypeableDateFilterInput
            value={draft.from}
            onChange={setField("from")}
            wrapperClassName="relative flex w-full min-w-0 items-stretch"
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-3 text-sm"
          />
        </label>

        <label className={`block min-w-0 ${row1Date}`}>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
          </span>
          <TypeableDateFilterInput
            value={draft.to}
            onChange={setField("to")}
            wrapperClassName="relative flex w-full min-w-0 items-stretch"
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-3 text-sm"
          />
        </label>

        {kind === "serviceRecord" ? (
          <>
            <FilterInput
              label="Model"
              placeholder="Model number…"
              value={draft.model}
              onChange={setField("model")}
              className={row2Field}
            />
            <FilterInput
              label="Serial"
              placeholder="Serial number…"
              value={draft.serial}
              onChange={setField("serial")}
              className={row2Field}
            />
            <ServiceEngineerFilterSelect
              value={draft.assignedTo}
              onChange={setField("assignedTo")}
              className={row2Field}
            />
            <ServiceStatusFilterSelect
              value={draft.serviceStatus}
              onChange={setField("serviceStatus")}
              className={row2Field}
            />
          </>
        ) : null}

        {kind === "upcomingOrder" ? (
          <>
            <ItemTypeFilterSelect
              value={draft.itemType}
              onChange={setField("itemType")}
              className={row2Field}
            />
            <FilterInput
              label="Model"
              placeholder="Model number…"
              value={draft.model}
              onChange={setField("model")}
              className={row2Field}
            />
            <FilterInput
              label="Location"
              placeholder="Delivery location…"
              value={draft.state}
              onChange={setField("state")}
              className={row2Field}
            />
            <FilterInput
              label="Serial"
              placeholder="Serial number…"
              value={draft.serial}
              onChange={setField("serial")}
              className={row2Field}
            />
          </>
        ) : null}

        {kind === "warranty" ? (
          <>
            <FilterInput
              label="Model"
              placeholder="Model number…"
              value={draft.model}
              onChange={setField("model")}
              className={row2Field}
            />
            <FilterInput
              label="State"
              placeholder="Customer state…"
              value={draft.state}
              onChange={setField("state")}
              className={row2Field}
            />
            <FilterInput
              label="Serial"
              placeholder="Serial number…"
              value={draft.serial}
              onChange={setField("serial")}
              className={row2Field}
            />
          </>
        ) : null}

        {kind === "amc" ? (
          <>
            <FilterInput
              label="Model"
              placeholder="Model number…"
              value={draft.model}
              onChange={setField("model")}
              className={row2Field}
            />
            <FilterInput
              label="Company"
              placeholder="Company name…"
              value={draft.state}
              onChange={setField("state")}
              className={row2Field}
            />
            <FilterInput
              label="Serial"
              placeholder="Serial number…"
              value={draft.serial}
              onChange={setField("serial")}
              className={row2Field}
            />
          </>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => onApply?.()}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
        >
          <ListFilter className="h-4 w-4" aria-hidden />
          Apply Filters
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            onClear?.();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Clear
        </button>
      </div>
    </div>
  );
}