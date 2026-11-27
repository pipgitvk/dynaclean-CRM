"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ListFilter, Loader2, RotateCcw, Search } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { EMPTY_SBI_FILTERS } from "@/lib/serviceBeforeInstallationFilters";
import { INDIAN_STATES } from "@/lib/indianStates";

const filterSelectClass =
  "rounded-xl border-slate-200 py-2.5 text-slate-800 focus:border-violet-300 focus:ring-violet-500/20";

const SEARCH_PLACEHOLDER = {
  serviceRecord: "Search service id, serial, customer, model, engineer…",
  upcomingOrder: "Search order, service id, company, serial, model, invoice…",
  warranty: "Search customer, serial, model, invoice, address…",
  amc: "Search company, serial, model, contact…",
};

/** Common service_records.status values (matches Service Records filters). */
const SERVICE_RECORD_STATUS_PRESETS = [
  "PENDING",
  "PLANNED",
  { value: "PENDING FOR SPARES", label: "PENDING BY US" },
  "PENDING BY CUSTOMER",
  "IN PROGRESS",
  "WORKED",
  "COMPLETED",
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

function TableDistinctNameFilterSelect({
  label,
  placeholder,
  names = [],
  value,
  onChange,
  onRequestOptions,
  className = "xl:col-span-3",
}) {
  const options = useMemo(() => {
    const base = [{ value: "", label: placeholder }];
    const set = new Set(names);
    const current = String(value || "").trim();
    if (current) set.add(current);
    const sorted = [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return [...base, ...sorted.map((name) => ({ value: name, label: name }))];
  }, [names, value, placeholder]);

  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <SearchableSelect
        options={options}
        value={value || ""}
        onChange={onChange}
        onOpen={onRequestOptions}
        placeholder={placeholder}
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
        className={`w-full min-w-0 ${filterSelectClass}`}
      />
    </label>
  );
}

async function fetchActiveEngineerNames() {
  const [internalRes, thirdRes] = await Promise.all([
    fetch("/api/service-engineers/active", { cache: "force-cache" }),
    fetch("/api/third-party-engineers/active", { cache: "force-cache" }),
  ]);
  const internalData = internalRes.ok ? await internalRes.json() : {};
  const thirdData = thirdRes.ok ? await thirdRes.json() : [];
  const internal = (internalData.users || [])
    .map((u) => String(u.username || "").trim())
    .filter(Boolean);
  const thirdParty = (Array.isArray(thirdData) ? thirdData : [])
    .map((e) => String(e.name || "").trim())
    .filter(Boolean);
  return [...new Set([...internal, ...thirdParty])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function ServiceEngineerFilterSelect({ value, onChange, className = "xl:col-span-3" }) {
  const [engineers, setEngineers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const merged = await fetchActiveEngineerNames();
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

/** Open Installation — loads from small engineer master APIs (not slow filters DISTINCT). */
function InstCompletedByFilterSelect({
  value,
  onChange,
  extraNames = [],
  className = "xl:col-span-3",
}) {
  const [engineers, setEngineers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const merged = await fetchActiveEngineerNames();
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
    const base = [{ value: "", label: "All users" }];
    const names = new Set([...engineers, ...(extraNames || [])]);
    const current = String(value || "").trim();
    if (current) names.add(current);
    const sorted = [...names]
      .map((n) => String(n || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return [...base, ...sorted.map((name) => ({ value: name, label: name }))];
  }, [engineers, extraNames, value]);

  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Inst completed by
      </span>
      <SearchableSelect
        options={options}
        value={value || ""}
        onChange={onChange}
        placeholder="All users"
        searchPlaceholder="Search user…"
        className={`w-full min-w-0 ${filterSelectClass}`}
      />
    </label>
  );
}

function ServiceStatusFilterSelect({
  value,
  onChange,
  className = "xl:col-span-3",
  label = "Status",
  presets = SERVICE_RECORD_STATUS_PRESETS,
  excludeStatusValues = [],
}) {
  const options = useMemo(() => {
    const excluded = new Set(
      excludeStatusValues.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean),
    );
    const base = [{ value: "", label: "All statuses" }];
    const entries = [];
    for (const item of presets) {
      if (item && typeof item === "object" && "value" in item) {
        if (excluded.has(String(item.value).trim().toUpperCase())) continue;
        entries.push(item);
      } else {
        const v = String(item);
        if (excluded.has(v.trim().toUpperCase())) continue;
        entries.push({ value: v, label: v });
      }
    }
    const current = String(value || "").trim();
    if (current === "__no_installation_service__") {
      // Option removed from Open Installation filters — do not surface in dropdown.
    } else if (
      current &&
      !excluded.has(current.toUpperCase()) &&
      !entries.some((e) => e.value === current)
    ) {
      entries.push({ value: current, label: current });
    }
    entries.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return [...base, ...entries];
  }, [value, presets, excludeStatusValues]);

  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
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

const STATE_SUGGESTIONS = [
  ...INDIAN_STATES,
  "Chandigarh",
  "Puducherry",
  "Andaman and Nicobar Islands",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

function StateSuggestFilter({ value, onChange, className = "xl:col-span-3" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  const suggestions = useMemo(() => {
    const q = String(value || "").trim().toLowerCase();
    if (!q) return [];
    return STATE_SUGGESTIONS.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [value]);

  useEffect(() => {
    setActive(0);
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (name) => {
    onChange(name);
    setOpen(false);
  };

  const showList = open && suggestions.length > 0;

  return (
    <label className={`relative block min-w-0 sm:col-span-1 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        State
      </span>
      <div ref={boxRef} className="relative">
        <input
          type="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter" && suggestions[active]) {
              e.preventDefault();
              pick(suggestions[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Customer state…"
          autoComplete="off"
          className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
        {showList ? (
          <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {suggestions.map((name, idx) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(name)}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    idx === active ? "bg-violet-50 font-medium text-violet-800" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
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

function WarrantyRegistrationFilterSelect({ value, onChange, className = "xl:col-span-3" }) {
  const options = [
    { value: "", label: "All (Registered & not)" },
    { value: "registered", label: "Registered" },
    { value: "not_registered", label: "Not registered" },
  ];
  return (
    <label className={`block min-w-0 sm:col-span-1 ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Reg status
      </span>
      <SearchableSelect
        options={options}
        value={value || ""}
        onChange={onChange}
        placeholder="All (Registered & not)"
        searchPlaceholder="Search…"
        className={`w-full min-w-0 ${filterSelectClass}`}
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
  tableFilterOptions = null,
  onRequestTableFilterOptions,
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
            {segment !== "open-installation" ? (
              <ItemTypeFilterSelect
                value={draft.itemType}
                onChange={setField("itemType")}
                className={row2Field}
              />
            ) : null}
            <FilterInput
              label="Model"
              placeholder="Model number…"
              value={draft.model}
              onChange={setField("model")}
              className={row2Field}
            />
            <FilterInput
              label={
                segment === "open-installation" || segment === "overdue-delayed-installation"
                  ? "State"
                  : "Location"
              }
              placeholder={
                segment === "open-installation" || segment === "overdue-delayed-installation"
                  ? "Order state…"
                  : "Delivery location…"
              }
              value={draft.state}
              onChange={setField("state")}
              className={row2Field}
            />
            {segment === "open-installation" || segment === "overdue-delayed-installation" ? (
              <>
                <WarrantyRegistrationFilterSelect
                  value={draft.warrantyRegistration}
                  onChange={setField("warrantyRegistration")}
                  className={row2Field}
                />
                <TableDistinctNameFilterSelect
                  label="Sales person"
                  placeholder="All sales persons"
                  names={tableFilterOptions?.salesPersons || []}
                  value={draft.salesPerson}
                  onChange={setField("salesPerson")}
                  onRequestOptions={onRequestTableFilterOptions}
                  className={row2Field}
                />
                <InstCompletedByFilterSelect
                  value={draft.instCompletedBy}
                  onChange={setField("instCompletedBy")}
                  extraNames={
                    tableFilterOptions?.instCompletedBys?.length
                      ? tableFilterOptions.instCompletedBys
                      : [
                          ...(tableFilterOptions?.serviceEngineers || []),
                          ...(tableFilterOptions?.thirdPartyEngineers || []),
                        ]
                  }
                  className={row2Field}
                />
              </>
            ) : null}
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
            {segment === "total-registered" ? (
              <StateSuggestFilter
                value={draft.state}
                onChange={setField("state")}
                className={row2Field}
              />
            ) : (
              <FilterInput
                label="State"
                placeholder="Customer state…"
                value={draft.state}
                onChange={setField("state")}
                className={row2Field}
              />
            )}
            <FilterInput
              label="Serial"
              placeholder="Serial number…"
              value={draft.serial}
              onChange={setField("serial")}
              className={row2Field}
            />
            {segment === "active-warranty" ? (
              <TableDistinctNameFilterSelect
                label="Sales person"
                placeholder="All sales persons"
                names={tableFilterOptions?.salesPersons || []}
                value={draft.salesPerson}
                onChange={setField("salesPerson")}
                onRequestOptions={onRequestTableFilterOptions}
                className={row2Field}
              />
            ) : null}
            {segment === "total-registered" ? (
              <>
                <TableDistinctNameFilterSelect
                  label="Sales person"
                  placeholder="All sales persons"
                  names={tableFilterOptions?.salesPersons || []}
                  value={draft.salesPerson}
                  onChange={setField("salesPerson")}
                  onRequestOptions={onRequestTableFilterOptions}
                  className={row2Field}
                />
                <TableDistinctNameFilterSelect
                  label="Service engineer"
                  placeholder="All service engineers"
                  names={tableFilterOptions?.serviceEngineers || []}
                  value={draft.serviceEngineer}
                  onChange={setField("serviceEngineer")}
                  onRequestOptions={onRequestTableFilterOptions}
                  className={row2Field}
                />
                <TableDistinctNameFilterSelect
                  label="Third party engineer"
                  placeholder="All third party engineers"
                  names={tableFilterOptions?.thirdPartyEngineers || []}
                  value={draft.thirdPartyEngineer}
                  onChange={setField("thirdPartyEngineer")}
                  onRequestOptions={onRequestTableFilterOptions}
                  className={row2Field}
                />
              </>
            ) : null}
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
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ListFilter className="h-4 w-4" aria-hidden />
          )}
          {loading ? "Loading…" : "Apply Filters"}
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