"use client";

import { CalendarDays, Pencil, Phone, Briefcase, Sparkles } from "lucide-react";
import { getGradientColor } from "@/utils/getGradientColor";
import { getScheduleMsForFollowUpCard, getTrafficGradientForHours } from "@/utils/hiringFollowUpUrgency";

export const STATUS_CHIP_STYLES = {
  "Shortlisted for interview": "bg-white/20 text-white border-white/30 ring-1 ring-white/10",
  Rescheduled: "bg-amber-400/25 text-amber-50 border-amber-200/30 ring-1 ring-amber-300/20",
  "Waiting List": "bg-violet-400/20 text-violet-50 border-violet-200/25 ring-1 ring-violet-300/15",
  "next-follow-up": "bg-cyan-400/20 text-cyan-50 border-cyan-200/30 ring-1 ring-cyan-300/20",
  "follow-up": "bg-teal-400/20 text-teal-50 border-teal-200/30 ring-1 ring-teal-300/20",
  Hired: "bg-emerald-400/25 text-emerald-50 border-emerald-200/30 ring-1 ring-emerald-300/20",
  Reject: "bg-red-400/20 text-red-50 border-red-200/30 ring-1 ring-red-300/15",
};

/** Table / light background — original pastel chips */
export const STATUS_CHIP_STYLES_LIGHT = {
  "Shortlisted for interview": "bg-sky-50 text-sky-900 border-sky-200 ring-1 ring-sky-500/15",
  Rescheduled: "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/15",
  "Waiting List": "bg-violet-50 text-violet-900 border-violet-200 ring-1 ring-violet-500/15",
  "next-follow-up": "bg-cyan-50 text-cyan-900 border-cyan-200 ring-1 ring-cyan-500/15",
  "follow-up": "bg-teal-50 text-teal-900 border-teal-200 ring-1 ring-teal-500/15",
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

/** @param {"gradient" | "traffic"} colorScheme — traffic = red/yellow/green by due window (dashboard). */
function cardBackground(row, colorScheme = "gradient") {
  const st = String(row.status || "").trim();
  const hiredFollowUpTag = st === "Hired" && String(row.tag || "").trim() === "Follow-Up";
  if (hiredFollowUpTag && colorScheme === "traffic") {
    const ms = getScheduleMsForFollowUpCard(row);
    if (ms != null && !Number.isNaN(ms)) {
      const hours = (ms - Date.now()) / 3600000;
      return getTrafficGradientForHours(hours);
    }
  }
  if (st === "Hired") {
    return "linear-gradient(145deg, rgb(4, 84, 72) 0%, rgb(5, 150, 105) 42%, rgb(45, 212, 191) 100%)";
  }
  if (st === "Reject") {
    return "linear-gradient(145deg, rgb(51, 47, 74) 0%, rgb(91, 78, 120) 45%, rgb(120, 113, 150) 100%)";
  }

  const ms = getScheduleMsForFollowUpCard(row);
  if (ms == null || Number.isNaN(ms)) {
    return "linear-gradient(145deg, rgb(71, 85, 105) 0%, rgb(100, 116, 139) 50%, rgb(148, 163, 184) 100%)";
  }
  const hours = (ms - Date.now()) / 3600000;
  if (colorScheme === "traffic") {
    return getTrafficGradientForHours(hours);
  }
  return getGradientColor(hours);
}

function DetailRow({ icon: Icon, label, children, traffic }) {
  const iconBox =
    traffic === true
      ? "bg-black/20 shadow-none"
      : "bg-white/15 shadow-inner shadow-black/10";
  return (
    <div className="flex gap-3 px-3 py-2.5 sm:px-3.5 sm:py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBox}`}>
        <Icon className="h-4 w-4 text-white/95" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</p>
        <div className="mt-0.5 text-sm font-medium leading-snug text-white">{children}</div>
      </div>
    </div>
  );
}

export default function HiringEntryCard({ row, onEdit, showEditButton = true, colorScheme = "gradient" }) {
  const bg = cardBackground(row, colorScheme);
  const traffic = colorScheme === "traffic";
  const panelClass = traffic
    ? "divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/15 bg-black/10"
    : "divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/15 bg-black/15 shadow-inner backdrop-blur-[2px]";
  const schedIconBox = traffic
    ? "bg-black/20 shadow-none"
    : "bg-white/15 shadow-inner shadow-black/10";
  return (
    <div
      className="group relative flex h-full min-w-[288px] max-w-[308px] flex-shrink-0 flex-col justify-between overflow-hidden rounded-3xl p-0 text-white shadow-[0_22px_50px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/10 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_28px_60px_-12px_rgba(15,23,42,0.45)]"
      style={{ background: bg }}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              <Sparkles className="h-3 w-3 opacity-90" />
              Candidate
            </p>
            <h3
              className={`text-xl font-bold leading-tight tracking-tight text-white line-clamp-2 ${traffic ? "" : "drop-shadow-sm"}`}
            >
              {row.candidate_name || "—"}
            </h3>
          </div>
          <span
            className={
              traffic
                ? "shrink-0 rounded-full border border-black/20 bg-black/20 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white"
                : "shrink-0 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white shadow-inner backdrop-blur-sm"
            }
          >
            #{row.id}
          </span>
        </div>

        <div className={panelClass}>
          <DetailRow icon={Phone} label="Contact" traffic={traffic}>
            <span className="truncate">{row.emp_contact || "—"}</span>
          </DetailRow>
          <DetailRow icon={Briefcase} label="Role" traffic={traffic}>
            <span className="line-clamp-2">{row.designation || "—"}</span>
          </DetailRow>
          <div className="flex gap-3 px-3 py-2.5 sm:px-3.5 sm:py-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${schedIconBox}`}>
              <CalendarDays className="h-4 w-4 text-white/95" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">Schedule</p>
              <p className="text-sm font-medium text-white">
                <span className="text-white/80">Interview · </span>
                {formatInterviewAt(row.interview_at)}
              </p>
              {row.status === "Rescheduled" && row.rescheduled_at ? (
                <p className="text-xs font-medium text-amber-100">
                  Rescheduled → {formatInterviewAt(row.rescheduled_at)}
                </p>
              ) : null}
              {row.status === "next-follow-up" && row.next_followup_at ? (
                <p className="text-xs font-medium text-cyan-100">
                  Next follow-up · {formatInterviewAt(row.next_followup_at)}
                </p>
              ) : null}
              {row.status === "follow-up" && row.next_followup_at ? (
                <p className="text-xs font-medium text-teal-100">
                  Follow-up · {formatInterviewAt(row.next_followup_at)}
                </p>
              ) : null}
              {row.status === "Hired" && String(row.tag || "").trim() === "Follow-Up" && row.next_followup_at ? (
                <p className="text-xs font-medium text-emerald-100">
                  Tag follow-up · {formatInterviewAt(row.next_followup_at)}
                </p>
              ) : null}
              <p className="pt-0.5 text-xs text-white/85">
                <span className="text-white/60">Mode · </span>
                {row.interview_mode || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <HiringStatusChip status={row.status} variant="onCard" />
          {row.tag ? (
            <span
              className={
                traffic
                  ? "rounded-full border border-black/15 bg-black/15 px-2.5 py-1 text-[10px] font-semibold text-white/95"
                  : "rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/95 backdrop-blur-sm"
              }
            >
              {row.tag}
            </span>
          ) : null}
        </div>
      </div>

      {showEditButton ? (
        <div
          className={
            traffic
              ? "relative z-10 border-t border-black/15 bg-black/15 px-5 py-3"
              : "relative z-10 border-t border-white/15 bg-black/10 px-5 py-3 backdrop-blur-md"
          }
        >
          <button
            type="button"
            onClick={onEdit}
            className={
              traffic
                ? "flex w-full items-center justify-center gap-2 rounded-2xl border border-black/25 bg-black/25 py-2.5 text-sm font-semibold text-white shadow-md shadow-black/15 transition hover:bg-black/35"
                : "flex w-full items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/15 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-white/25"
            }
          >
            <Pencil className="h-4 w-4 shrink-0" />
            Edit
          </button>
        </div>
      ) : null}
    </div>
  );
}
