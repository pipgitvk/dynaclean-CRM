"use client";

import { CalendarDays, Pencil, Phone, Briefcase } from "lucide-react";
import { getGradientColor } from "@/utils/getGradientColor";

export const STATUS_CHIP_STYLES = {
  "Shortlisted for interview": "bg-white/20 text-white border-white/30 ring-1 ring-white/10",
  Rescheduled: "bg-amber-400/25 text-amber-50 border-amber-200/30 ring-1 ring-amber-300/20",
  "Waiting List": "bg-violet-400/20 text-violet-50 border-violet-200/25 ring-1 ring-violet-300/15",
  "next-follow-up": "bg-cyan-400/20 text-cyan-50 border-cyan-200/30 ring-1 ring-cyan-300/20",
  Hired: "bg-emerald-400/25 text-emerald-50 border-emerald-200/30 ring-1 ring-emerald-300/20",
  Reject: "bg-red-400/20 text-red-50 border-red-200/30 ring-1 ring-red-300/15",
};

/** Table / light background — original pastel chips */
export const STATUS_CHIP_STYLES_LIGHT = {
  "Shortlisted for interview": "bg-sky-50 text-sky-900 border-sky-200 ring-1 ring-sky-500/15",
  Rescheduled: "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  "Waiting List": "bg-violet-50 text-violet-900 border-violet-200 ring-1 ring-violet-500/15",
  "next-follow-up": "bg-cyan-50 text-cyan-900 border-cyan-200 ring-1 ring-cyan-500/15",
  Hired: "bg-emerald-50 text-emerald-900 border-emerald-200 ring-1 ring-emerald-500/20",
  Reject: "bg-red-50 text-red-900 border-red-200 ring-1 ring-red-500/15",
};

export function formatInterviewAt(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 16);
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

/** @param {{ variant?: "light" | "onCard" }} props */
export function HiringStatusChip({ status, variant = "light" }) {
  const s = String(status || "").trim();
  if (!s) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  const map = variant === "onCard" ? STATUS_CHIP_STYLES : STATUS_CHIP_STYLES_LIGHT;
  const style =
    map[s] || (variant === "onCard"
      ? "bg-white/15 text-white border-white/25 ring-1 ring-white/10"
      : "bg-gray-50 text-gray-800 border-gray-200 ring-1 ring-gray-400/10");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold whitespace-normal text-left leading-snug max-w-[9rem] sm:max-w-[11rem] ${style}`}
      title={s}
    >
      {s}
    </span>
  );
}

function cardBackground(row) {
  const st = String(row.status || "").trim();
  if (st === "Hired") return "linear-gradient(160deg, rgb(5 120 85) 0%, rgb(16 185 129) 100%)";
  if (st === "Reject") return "linear-gradient(160deg, rgb(71 85 105) 0%, rgb(100 116 139) 100%)";

  let ms = null;
  if (st === "Rescheduled" && row.rescheduled_at) {
    ms = new Date(row.rescheduled_at).getTime();
  } else if (st === "next-follow-up" && row.next_followup_at) {
    ms = new Date(row.next_followup_at).getTime();
  } else if (row.interview_at) {
    ms = new Date(row.interview_at).getTime();
  }
  if (ms == null || Number.isNaN(ms)) return "rgb(100 116 139)";
  const hours = (ms - Date.now()) / 3600000;
  return getGradientColor(hours);
}

export default function HiringEntryCard({ row, onEdit, showEditButton = true }) {
  const bg = cardBackground(row);
  return (
    <div
      className="flex h-full min-w-[272px] max-w-[300px] flex-shrink-0 flex-col justify-between rounded-2xl border border-white/20 p-5 text-white shadow-lg shadow-slate-900/15 transition hover:shadow-xl hover:shadow-slate-900/20"
      style={{ background: bg }}
    >
      <div className="min-w-0 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold leading-tight line-clamp-2 text-white">{row.candidate_name || "—"}</h3>
          <span className="shrink-0 rounded-md bg-black/15 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/90">
            #{row.id}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/90">
          <Phone size={14} className="shrink-0 opacity-80" />
          <span className="truncate">{row.emp_contact || "—"}</span>
        </div>

        <div className="flex items-start gap-2 text-xs text-white/90">
          <Briefcase size={14} className="mt-0.5 shrink-0 opacity-80" />
          <span className="line-clamp-2">{row.designation || "—"}</span>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-start gap-2 text-white/95">
            <CalendarDays size={14} className="mt-0.5 shrink-0 opacity-80" />
            <div>
              <span className="font-medium">Interview:</span>{" "}
              <span className="text-white/95">{formatInterviewAt(row.interview_at)}</span>
              {row.status === "Rescheduled" && row.rescheduled_at ? (
                <span className="mt-1 block text-amber-100">
                  Rescheduled → {formatInterviewAt(row.rescheduled_at)}
                </span>
              ) : null}
              {row.status === "next-follow-up" && row.next_followup_at ? (
                <span className="mt-1 block text-cyan-100">
                  Next follow-up: {formatInterviewAt(row.next_followup_at)}
                </span>
              ) : null}
            </div>
          </div>
          <p>
            <span className="text-white/80">Mode:</span> {row.interview_mode || "—"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <HiringStatusChip status={row.status} variant="onCard" />
          {row.tag ? (
            <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/95">
              {row.tag}
            </span>
          ) : null}
        </div>

        {(row.hire_date || row.package) && (
          <div className="rounded-lg border border-white/20 bg-black/10 px-2.5 py-2 text-[11px] leading-snug text-white/90">
            {row.hire_date ? (
              <p>
                <span className="text-white/75">Joining:</span> {String(row.hire_date).slice(0, 10)}
              </p>
            ) : null}
            {row.package ? (
              <p className={row.hire_date ? "mt-0.5" : ""}>
                <span className="text-white/75">Package:</span> {row.package}
              </p>
            ) : null}
          </div>
        )}

        {row.note ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-white/85" title={row.note}>
            {row.note}
          </p>
        ) : null}
      </div>

      {showEditButton ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <Pencil className="h-4 w-4 shrink-0" />
          Edit
        </button>
      ) : null}
    </div>
  );
}
