"use client";

import { ListFilter, RotateCcw, Search } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { EMPTY_SBI_FILTERS } from "@/lib/serviceBeforeInstallationFilters";

function FilterInput({ label, placeholder, value, onChange, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
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

  const setField = (key) => (val) => {
    onChange?.({ ...draft, [key]: val });
  };

  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5 ${className}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <label className="relative block sm:col-span-2 xl:col-span-4">
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
            placeholder="Search table — customer, serial, model, invoice…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </label>

        <label className="block xl:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
          </span>
          <TypeableDateFilterInput
            value={draft.from}
            onChange={setField("from")}
            wrapperClassName="relative flex w-full min-w-0 items-stretch"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 text-sm"
          />
        </label>

        <label className="block xl:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
          </span>
          <TypeableDateFilterInput
            value={draft.to}
            onChange={setField("to")}
            wrapperClassName="relative flex w-full min-w-0 items-stretch"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 text-sm"
          />
        </label>

        {segment === "overdue-delayed-installation" || segment === "open-installation" ? (
          <label className="block xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Item type
            </span>
            <select
              value={draft.itemType || ""}
              onChange={(e) => setField("itemType")(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">All (Products & Spares)</option>
              <option value="products">Products</option>
              <option value="spares">Spares</option>
            </select>
          </label>
        ) : null}

        <FilterInput
          label="Model"
          placeholder="Search model number…"
          value={draft.model}
          onChange={setField("model")}
          className="xl:col-span-1"
        />
        <FilterInput
          label="State"
          placeholder="Search state…"
          value={draft.state}
          onChange={setField("state")}
          className="xl:col-span-1"
        />
        <FilterInput
          label="Serial"
          placeholder="Search serial number…"
          value={draft.serial}
          onChange={setField("serial")}
          className="xl:col-span-2"
        />
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
            onChange?.({ ...EMPTY_SBI_FILTERS });
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