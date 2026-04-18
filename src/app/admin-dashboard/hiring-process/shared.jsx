"use client";

/** Shared UI + helpers for Hiring Process list / view / edit pages */

export const fieldClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400";
export const filterSelectClass = `w-full ${fieldClass} min-h-[44px]`;
export const formFieldClass = `w-full ${fieldClass}`;
export const formSelectClass = `w-full ${fieldClass} min-h-[44px] text-slate-900`;

/** @type {Record<string, string>} */
export const STATUS_CHIP_STYLES = {
  "Follow-up": "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  Shortlisted: "bg-sky-50 text-sky-900 border-sky-200 ring-1 ring-sky-500/15",
  Selected: "bg-indigo-50 text-indigo-900 border-indigo-200 ring-1 ring-indigo-500/15",
  Negotiation: "bg-orange-50 text-orange-900 border-orange-200 ring-1 ring-orange-500/15",
  Hold: "bg-yellow-50 text-yellow-900 border-yellow-200 ring-1 ring-yellow-500/15",
  Backup: "bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-400/20",
  Hired: "bg-emerald-50 text-emerald-900 border-emerald-200 ring-1 ring-emerald-500/20",
  Rejected: "bg-red-50 text-red-900 border-red-200 ring-1 ring-red-500/15",
  "Shortlisted for interview": "bg-sky-50 text-sky-900 border-sky-200 ring-1 ring-sky-500/15",
  Rescheduled: "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  "next-follow-up": "bg-cyan-50 text-cyan-900 border-cyan-200 ring-1 ring-cyan-500/15",
  "follow-up": "bg-teal-50 text-teal-900 border-teal-200 ring-1 ring-teal-500/15",
  "Waiting List": "bg-violet-50 text-violet-900 border-violet-200 ring-1 ring-violet-500/15",
  Reject: "bg-red-50 text-red-900 border-red-200 ring-1 ring-red-500/15",
};

export const MONTH_FILTER_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1;
  const label = new Date(2024, i, 1).toLocaleString("en-IN", { month: "long" });
  return { value: String(m), label };
});

export const YEAR_FILTER_OPTIONS = (() => {
  const y = new Date().getFullYear();
  return Array.from({ length: 14 }, (_, i) => y + 1 - i);
})();

export const STATUS_OPTIONS = [
  "Follow-up",
  "Have not talked",
  "Shortlisted",
  "Selected",
  "Negotiation",
  "Hold",
  "Backup",
  "Hired",
  "Rejected",
];

export function hiringStatusSelectOptions(rowStatus) {
  const s = String(rowStatus || "").trim();
  if (s && !STATUS_OPTIONS.includes(s)) {
    return [...STATUS_OPTIONS, s];
  }
  return STATUS_OPTIONS;
}

export const MARITAL_OPTIONS = ["Unmarried", "Married"];
export const EXPERIENCE_OPTIONS = [
  { value: "fresher", label: "Fresher" },
  { value: "experience", label: "Experience" },
];
export const INTERVIEW_MODE_OPTIONS = ["Virtual", "Walk-in"];

export function formatInterviewAt(v) {
  if (!v) return "—";
  try {
    // API returns local datetime string like "2024-05-15T14:30:00.000Z" from MySQL
    // If it's from MySQL and we just want to treat it as local time, we should append "Z" only if we want to parse it as UTC
    // Since MySQL stores local time, we replace Z or append nothing and let browser parse it as local time
    const s = String(v).replace("Z", "");
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.slice(0, 16);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function StatusChip({ status }) {
  const s = String(status || "").trim();
  if (!s) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  const style = STATUS_CHIP_STYLES[s] || "bg-gray-50 text-gray-800 border-gray-200 ring-1 ring-gray-400/10";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold whitespace-normal text-left leading-snug max-w-[9rem] sm:max-w-[11rem] ${style}`}
      title={s}
    >
      {s}
    </span>
  );
}

export function CreatedByChip({ name, role }) {
  const displayName = String(name || "").trim();
  const displayRole = String(role || "").trim();
  if (!displayName) {
    return <span className="text-slate-400 text-xs">—</span>;
  }
  return (
    <span
      className="inline-flex max-w-[14rem] flex-col items-start rounded-lg border border-indigo-200/90 bg-indigo-50 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs leading-snug ring-1 ring-indigo-500/10"
      title={displayRole ? `${displayName} — ${displayRole}` : displayName}
    >
      <span className="truncate font-semibold text-indigo-900">{displayName}</span>
      {displayRole && <span className="truncate font-medium text-indigo-500">{displayRole}</span>}
    </span>
  );
}

export function formatDt(v) {
  if (v == null || v === "") return "—";
  try {
    const s = String(v).replace("Z", "");
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.slice(0, 19);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatExperienceLabel(v) {
  if (v == null || String(v).trim() === "") return "—";
  const found = EXPERIENCE_OPTIONS.find((o) => o.value === v);
  return found ? found.label : String(v);
}

export function HistoryDetailField({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}

export function toDatetimeLocalValue(v) {
  if (v == null || v === "") return "";
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const s = String(v).replace("Z", "");
  if (s.length >= 16) return s.slice(0, 16).replace(" ", "T");
  return "";
}
