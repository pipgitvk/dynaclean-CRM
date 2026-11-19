import Link from "next/link";
import { format } from "date-fns";
import { Loader2, Search } from "lucide-react";
import { REASSIGN_NO_FOLLOWUP_DAYS } from "@/lib/reassignNoFollowupConstants";

function formatFollowupAt(value) {
  if (!value) return "—";
  const s = String(value);
  if (s.startsWith("0000-00-00")) return "—";
  try {
    return format(new Date(s), "dd MMM yyyy, HH:mm");
  } catch {
    return s;
  }
}

/** Last follow-up datetime plus remark (truncated with full text in title). */
export function LeadsLastFollowupWithRemark({ at, notes, className = "" }) {
  const when = formatFollowupAt(at);
  const remark = notes != null && String(notes).trim() !== "" ? String(notes).trim() : "";
  if (when === "—" && !remark) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className={`max-w-[min(16rem,28vw)] ${className}`.trim()}>
      <div className="text-xs text-slate-600">{when}</div>
      {remark ? (
        <div className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-slate-500" title={remark}>
          {remark}
        </div>
      ) : null}
    </div>
  );
}

/** @typedef {'emerald' | 'amber' | 'rose'} LeadsFilterTheme */

const THEME_STYLES = {
  emerald: {
    panel: "border-emerald-100/90 bg-emerald-50/35",
    icon: "text-emerald-600",
    searchShell:
      "focus-within:border-emerald-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/15",
    selectShell:
      "focus-within:border-emerald-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/15",
    primaryBtn: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  amber: {
    panel: "border-amber-100/90 bg-amber-50/35",
    icon: "text-amber-600",
    searchShell:
      "focus-within:border-amber-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-amber-500/15",
    selectShell:
      "focus-within:border-amber-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-amber-500/15",
    primaryBtn: "bg-amber-600 text-white hover:bg-amber-700",
  },
  rose: {
    panel: "border-rose-100/90 bg-rose-50/35",
    icon: "text-rose-600",
    searchShell:
      "focus-within:border-rose-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-rose-500/15",
    selectShell:
      "focus-within:border-rose-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-rose-500/15",
    primaryBtn: "bg-rose-600 text-white hover:bg-rose-700",
  },
};

const TOTAL_STAT_THEME = {
  emerald: {
    shell: "border-emerald-200/90 bg-gradient-to-br from-emerald-100/90 to-emerald-50/50",
    label: "text-emerald-800/90",
    value: "text-emerald-900",
    spinner: "text-emerald-600",
  },
  emeraldDark: {
    shell: "border-emerald-800/95 bg-gradient-to-br from-emerald-800 to-emerald-950 shadow-md",
    label: "text-emerald-100/95",
    value: "text-white",
    spinner: "text-emerald-200",
  },
  amber: {
    shell: "border-amber-200/90 bg-gradient-to-br from-amber-100/90 to-amber-50/50",
    label: "text-amber-900/90",
    value: "text-amber-950",
    spinner: "text-amber-600",
  },
  rose: {
    shell: "border-rose-200/90 bg-gradient-to-br from-rose-100/90 to-rose-50/50",
    label: "text-rose-900/90",
    value: "text-rose-950",
    spinner: "text-rose-600",
  },
  roseDark: {
    shell: "border-rose-800/95 bg-gradient-to-br from-rose-800 to-rose-950 shadow-md",
    label: "text-rose-100/95",
    value: "text-white",
    spinner: "text-rose-200",
  },
};

/** @typedef {{ total: number; superseded: number; too_recent: number; owner_changed: number }} LeadsOutsideCohortStats */

export function LeadsReassignFollowupOverview({
  cohortTotal = 0,
  followed = 0,
  notFollowed = 0,
  reassignEventsTotal = null,
  outside = null,
  loading = false,
  outsideLoading = false,
  showOutside = true,
  filterActive = false,
  variant = "full",
  days = REASSIGN_NO_FOLLOWUP_DAYS,
}) {
  const notFollowedOnly = variant === "not_followed_only";
  const showOutsidePanel =
    showOutside && !filterActive && (outsideLoading || (outside && reassignEventsTotal != null));

  const gridCols = notFollowedOnly
    ? showOutsidePanel
      ? "xl:grid-cols-2"
      : "xl:grid-cols-1"
    : showOutsidePanel
      ? "xl:grid-cols-4"
      : "xl:grid-cols-3";

  return (
    <div
      className={`grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:items-stretch ${gridCols}`}
    >
      {notFollowedOnly ? (
        <div className="flex flex-col rounded-2xl border border-rose-300/90 bg-gradient-to-br from-rose-100/95 via-rose-50/80 to-rose-50/40 px-4 py-3.5 shadow-sm sm:col-span-2 xl:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-900">
            Not followed after re-assign ({days}+ days)
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-rose-600" aria-hidden />
            ) : (
              notFollowed.toLocaleString()
            )}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Sales owner · no follow-up after re-assign
            {filterActive ? " · counts match filters below" : null}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-100/90 to-rose-50/50 px-4 py-3.5 shadow-sm sm:col-span-2 xl:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-900/90">Total in this check</p>
            <p className="mt-auto text-3xl font-bold tabular-nums text-rose-950">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-rose-600" aria-hidden />
              ) : (
                cohortTotal.toLocaleString()
              )}
            </p>
            <p className="mt-2 text-xs leading-snug text-slate-600">
              Followed + not followed · latest reassign · still on assignee · {days}+ days
              {filterActive ? " · counts match filters below" : null}
            </p>
          </div>

          <div className="flex flex-col rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Followed</p>
            <p className="mt-auto text-2xl font-bold tabular-nums text-slate-900">
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600" aria-hidden />
              ) : (
                followed.toLocaleString()
              )}
            </p>
          </div>

          <div className="flex flex-col rounded-xl border border-rose-200/90 bg-rose-50/70 px-4 py-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-900">Not followed</p>
            <p className="mt-auto text-2xl font-bold tabular-nums text-slate-900">
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-rose-600" aria-hidden />
              ) : (
                notFollowed.toLocaleString()
              )}
            </p>
          </div>
        </>
      )}

      {showOutsidePanel ? (
        <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3.5 sm:col-span-2 xl:col-span-1">
          {outsideLoading || !outside || reassignEventsTotal == null ? (
            <div className="flex flex-1 items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" aria-hidden />
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase leading-snug tracking-wide text-slate-600">
                Not in this check ({outside.total.toLocaleString()} of {reassignEventsTotal.toLocaleString()} reassign
                events)
              </p>
              <ul className="mt-2 flex flex-1 flex-col justify-center space-y-1.5 text-sm text-slate-600">
                <li className="flex justify-between gap-3">
                  <span className="min-w-0">Older reassign (superseded)</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {outside.superseded.toLocaleString()}
                  </span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Under {days}+ days window</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {outside.too_recent.toLocaleString()}
                  </span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Moved off assignee</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {outside.owner_changed.toLocaleString()}
                  </span>
                </li>
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function LeadsDetailDualTotalStat({
  theme = "rose",
  primaryLabel = "Followed",
  secondaryLabel = "No-followup",
  primaryTotal = 0,
  secondaryTotal = 0,
  loading = false,
}) {
  const t = TOTAL_STAT_THEME[theme] || TOTAL_STAT_THEME.rose;
  const valueClass = `text-2xl font-bold tabular-nums leading-none ${t.value}`;
  return (
    <div
      className={`flex shrink-0 gap-3 rounded-2xl border px-4 py-3.5 shadow-sm sm:gap-5 sm:px-5 ${t.shell}`}
      aria-live="polite"
    >
      <div className="min-w-[5.5rem]">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${t.label}`}>{primaryLabel}</p>
        <p className={`mt-1 ${valueClass}`}>
          {loading ? <Loader2 className={`h-7 w-7 animate-spin ${t.spinner}`} aria-hidden /> : primaryTotal.toLocaleString()}
        </p>
      </div>
      <div className="w-px bg-slate-300/60" aria-hidden />
      <div className="min-w-[5.5rem]">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${t.label}`}>{secondaryLabel}</p>
        <p className={`mt-1 ${valueClass}`}>
          {loading ? <Loader2 className={`h-7 w-7 animate-spin ${t.spinner}`} aria-hidden /> : secondaryTotal.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function LeadsDetailTotalStat({
  theme = "emerald",
  label = "Total re-assign",
  total = 0,
  loading = false,
}) {
  const t = TOTAL_STAT_THEME[theme] || TOTAL_STAT_THEME.emerald;
  return (
    <div
      className={`shrink-0 rounded-2xl border px-5 py-3.5 shadow-sm sm:min-w-[11rem] ${t.shell}`}
      aria-live="polite"
    >
      <p className={`text-[11px] font-bold uppercase tracking-wide ${t.label}`}>{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums leading-none ${t.value}`}>
        {loading ? (
          <Loader2 className={`h-8 w-8 animate-spin ${t.spinner}`} aria-hidden />
        ) : (
          Number(total || 0).toLocaleString()
        )}
      </p>
    </div>
  );
}

export function LeadsFilterPanel({ theme = "emerald", children, className = "" }) {
  const t = THEME_STYLES[theme] || THEME_STYLES.emerald;
  return (
    <div
      className={`mt-6 rounded-2xl border p-4 shadow-sm sm:p-5 ${t.panel} ${className}`}
    >
      <p className="mb-4 text-sm font-bold text-slate-800">Filters</p>
      {children}
    </div>
  );
}

export function LeadsFilterLabel({ children, icon: Icon }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function LeadsFilterSearch({
  theme = "emerald",
  value,
  onChange,
  onApply,
  placeholder,
}) {
  const t = THEME_STYLES[theme] || THEME_STYLES.emerald;
  return (
    <label className="block w-full min-w-0">
      <LeadsFilterLabel>Search</LeadsFilterLabel>
      <div
        className={`relative flex min-h-[2.75rem] items-center rounded-xl border border-slate-200/90 bg-white/90 shadow-sm transition ${t.searchShell}`}
      >
        <Search className={`pointer-events-none absolute left-3 h-4 w-4 ${t.icon}`} aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onApply?.()}
          placeholder={placeholder}
          className="w-full rounded-xl border-0 bg-transparent py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
    </label>
  );
}

export function LeadsFilterSelectShell({ theme = "emerald", icon: Icon, children }) {
  const t = THEME_STYLES[theme] || THEME_STYLES.emerald;
  return (
    <div
      className={`relative flex min-h-[2.75rem] min-w-0 items-stretch rounded-xl border border-slate-200/90 bg-white/90 py-0.5 pl-10 pr-1.5 shadow-sm transition ${t.selectShell}`}
    >
      {Icon ? (
        <Icon className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.icon}`} aria-hidden />
      ) : null}
      <div className="w-full min-w-0 flex-1 self-center">{children}</div>
    </div>
  );
}

const controlBtn =
  "rounded-xl px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

export function LeadsFilterActions({
  theme = "emerald",
  onApply,
  onClear,
  hubHref,
}) {
  const t = THEME_STYLES[theme] || THEME_STYLES.emerald;
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onApply} className={`${controlBtn} ${t.primaryBtn}`}>
          Apply filters
        </button>
        <button
          type="button"
          onClick={onClear}
          className={`${controlBtn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          Clear
        </button>
      </div>
      {hubHref ? (
        <Link href={hubHref} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
          Leads hub
        </Link>
      ) : null}
    </div>
  );
}

/** Search + 1–2 more filters in one row from sm breakpoint. */
export function LeadsFilterRow({ children, className = "", columns = 2 }) {
  const colClass =
    columns === 3
      ? "sm:grid-cols-[minmax(0,1fr)_minmax(11rem,18rem)_minmax(10rem,15rem)]"
      : "sm:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)]";
  return (
    <div className={`grid grid-cols-1 items-end gap-4 ${colClass} ${className}`}>{children}</div>
  );
}

export function LeadsFilterFieldsGrid({ children, columns = 2 }) {
  const colClass =
    columns === 5
      ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : columns === 4
        ? "sm:grid-cols-2 xl:grid-cols-4"
        : columns === 3
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "sm:grid-cols-2";
  return <div className={`mt-4 grid grid-cols-1 gap-4 ${colClass}`}>{children}</div>;
}

export function LeadsFilterField({ label, icon: Icon, children }) {
  return (
    <label className="block w-full min-w-0">
      <LeadsFilterLabel icon={Icon}>{label}</LeadsFilterLabel>
      {children}
    </label>
  );
}

export const dateInputClass =
  "w-full min-h-[2.75rem] rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pl-3 pr-3 text-sm text-slate-800 shadow-sm transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200/80";

export const dateInputWrapperClass = "relative flex w-full min-w-0 items-stretch";