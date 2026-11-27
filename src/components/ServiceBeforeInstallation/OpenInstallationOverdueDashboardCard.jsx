"use client";

import { AlertTriangle } from "lucide-react";
import { OPEN_INSTALLATION_OVERDUE_DASHBOARD_CARD } from "@/lib/serviceBeforeInstallationHub";
import {
  formatSbiNum,
  SbiCardWave,
} from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

/** Compact header KPI — same layout as Leads Manage meta_leads card. */
export default function OpenInstallationOverdueDashboardCard({
  total,
  loading = false,
  active = false,
  onClick,
}) {
  const card = OPEN_INSTALLATION_OVERDUE_DASHBOARD_CARD;
  const numericTotal = Number(total);
  const hasNumber = total != null && total !== "" && Number.isFinite(numericTotal);
  const waiting = !hasNumber || (Boolean(loading) && !(numericTotal > 0));
  const displayTotal = hasNumber ? numericTotal : 0;

  const activeRing = active
    ? "ring-2 ring-rose-500/75 ring-offset-2 ring-offset-rose-50/60"
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex min-h-[6.5rem] w-full min-w-[14rem] max-w-[19rem] items-stretch overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:-translate-y-px hover:shadow-md ${card.surface} ${activeRing}`}
    >
      <div
        className={`absolute -left-8 -top-8 h-20 w-20 rounded-full opacity-80 blur-2xl ${card.glow}`}
        aria-hidden
      />
      <div className="relative z-10 flex w-full items-center gap-3 px-4 py-4 sm:px-4 sm:py-4">
        <div
          className={`shrink-0 rounded-xl p-2.5 text-white shadow-lg shadow-black/10 ${card.iconSurface}`}
        >
          <AlertTriangle className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-slate-900">Overdue (Delayed)</h2>
          <p className="truncate text-xs font-semibold text-rose-700/90 sm:text-[13px]">
            {card.subtitle}
          </p>
          <div className="mt-1.5">
            <span className="text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-900 sm:text-[2.125rem]">
              {waiting ? "…" : formatSbiNum(displayTotal)}
            </span>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 h-10 w-full overflow-hidden opacity-70">
        <SbiCardWave color={card.chartColor} gradientId="sbi-wave-open-installation-overdue-header" />
      </div>
    </button>
  );
}