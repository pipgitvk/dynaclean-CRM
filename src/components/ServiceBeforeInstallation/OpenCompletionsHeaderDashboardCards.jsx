"use client";

import { AlertTriangle, MessageCircle } from "lucide-react";
import { OPEN_COMPLETIONS_COMPLAINT_KPI_CARDS } from "@/lib/serviceBeforeInstallationHub";
import {
  formatSbiNum,
  SbiCardWave,
} from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

const HEADER_CARDS = [
  {
    id: "oc-pending-48h",
    bucket: "pending_over_48h_no_plan",
    Icon: AlertTriangle,
    title: "No Follow-up > 48h",
    subtitleClass: "text-rose-700/90",
    activeRing: "ring-2 ring-rose-500/75 ring-offset-2 ring-offset-rose-50/60",
    waveId: "sbi-wave-oc-no-followup-header",
  },
  {
    id: "oc-google-feedback",
    bucket: "google_feedback",
    Icon: MessageCircle,
    title: "Google Feedback",
    subtitleClass: "text-sky-700/90",
    activeRing: "ring-2 ring-sky-500/75 ring-offset-2 ring-offset-sky-50/60",
    waveId: "sbi-wave-oc-google-feedback-header",
  },
];

function OpenCompletionsHeaderMiniCard({
  def,
  card,
  total,
  loading,
  active,
  onClick,
}) {
  const numericTotal = Number(total);
  const hasNumber = total != null && total !== "" && Number.isFinite(numericTotal);
  const waiting = !hasNumber || (Boolean(loading) && !(numericTotal > 0));
  const displayTotal = hasNumber ? numericTotal : 0;
  const Icon = def.Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex min-h-[6.5rem] min-w-0 flex-1 basis-0 items-stretch overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:-translate-y-px hover:shadow-md sm:max-w-[19rem] sm:flex-none sm:basis-auto sm:min-w-[14rem] ${card.surface} ${
        active ? def.activeRing : ""
      }`}
    >
      <div
        className={`absolute -left-8 -top-8 h-20 w-20 rounded-full opacity-80 blur-2xl ${card.glow}`}
        aria-hidden
      />
      <div className="relative z-10 flex w-full items-center gap-3 px-4 py-4">
        <div
          className={`shrink-0 rounded-xl p-2.5 text-white shadow-lg shadow-black/10 ${card.iconSurface}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold leading-snug text-slate-900">
            {def.title}
          </h2>
          <p
            className={`mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-500 sm:text-xs ${def.subtitleClass}`}
          >
            {card.subtitle}
          </p>
          <div className="mt-1">
            <span className="text-2xl font-bold tabular-nums leading-none tracking-tight text-slate-900 sm:text-[1.875rem]">
              {waiting ? "…" : formatSbiNum(displayTotal)}
            </span>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 h-10 w-full overflow-hidden opacity-70">
        <SbiCardWave color={card.chartColor} gradientId={def.waveId} />
      </div>
    </button>
  );
}

export default function OpenCompletionsHeaderDashboardCards({
  totals = {},
  loading = false,
  activeBucket = "",
  onSelect,
}) {
  const active = String(activeBucket || "").trim();

  return (
    <div className="flex w-full min-w-0 flex-row items-stretch gap-3">
      {HEADER_CARDS.map((def) => {
        const card = OPEN_COMPLETIONS_COMPLAINT_KPI_CARDS.find((c) => c.id === def.id);
        if (!card) return null;
        return (
          <OpenCompletionsHeaderMiniCard
            key={def.id}
            def={def}
            card={card}
            total={totals[card.field]}
            loading={loading}
            active={active === def.bucket}
            onClick={() => onSelect?.(def.bucket)}
          />
        );
      })}
    </div>
  );
}
