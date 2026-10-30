"use client";

import { ArrowRight, CalendarDays, MapPin, Package } from "lucide-react";
import {
  DELHIVERY_ORDER_DETAIL_SECTIONS,
  delhiveryStatusBadgeClass,
  formatDelhiveryStatusLabel,
  delhiveryDisplayText,
} from "@/lib/delhiveryB2bTrackingUi";

function fieldDisplay(data, field) {
  const raw = data?.[field.key];
  if (raw == null || raw === "") return null;
  if (field.format) return field.format(raw);
  const text = delhiveryDisplayText(raw, "");
  return text === "—" || text === "" ? null : text;
}

function DetailRow({ label, value, highlight }) {
  if (value == null || value === "") return null;
  return (
    <div
      className={`grid grid-cols-1 gap-1 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-4 ${
        highlight ? "bg-emerald-50/60" : ""
      }`}
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="text-sm font-medium leading-snug text-gray-900 break-words">
        {value}
      </dd>
    </div>
  );
}

function RouteCard({ data }) {
  const originCity = delhiveryDisplayText(data?.origin_city, "");
  const originBranch = delhiveryDisplayText(data?.origin_branch, "");
  const destCity = delhiveryDisplayText(data?.destination_city, "");
  const destBranch = delhiveryDisplayText(data?.destination_branch, "");
  const hasOrigin =
    (originCity && originCity !== "—") ||
    (originBranch && originBranch !== "—");
  const hasDest =
    (destCity && destCity !== "—") || (destBranch && destBranch !== "—");
  if (!hasOrigin && !hasDest) return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3B966F]">
            Origin
          </p>
          <p className="mt-1 text-base font-semibold text-gray-900">
            {originCity && originCity !== "—" ? originCity : "—"}
          </p>
          {originBranch && originBranch !== "—" ? (
            <p className="mt-0.5 text-sm text-gray-600">{originBranch}</p>
          ) : null}
        </div>
        <div
          className="flex shrink-0 items-center justify-center text-[#3B966F]"
          aria-hidden
        >
          <span className="hidden h-px flex-1 bg-[#3B966F]/30 sm:block sm:w-8" />
          <ArrowRight className="h-5 w-5 sm:mx-2" />
          <span className="hidden h-px flex-1 bg-[#3B966F]/30 sm:block sm:w-8" />
        </div>
        <div className="min-w-0 flex-1 sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3B966F]">
            Destination
          </p>
          <p className="mt-1 text-base font-semibold text-gray-900">
            {destCity && destCity !== "—" ? destCity : "—"}
          </p>
          {destBranch && destBranch !== "—" ? (
            <p className="mt-0.5 text-sm text-gray-600">{destBranch}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-snug text-gray-900 break-words">
        {value}
      </p>
    </div>
  );
}

export default function DelhiveryOrderDetailsPanel({ result, awb, lr }) {
  if (!result) return null;

  const statusLabel = formatDelhiveryStatusLabel(result.status);
  const badgeClass = delhiveryStatusBadgeClass(result.status);

  return (
    <div className="space-y-5 px-5 py-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}
        >
          {statusLabel}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {lr ? (
            <span>
              <span className="text-gray-500">LR </span>
              <span className="font-semibold text-gray-900">
                {delhiveryDisplayText(lr, "")}
              </span>
            </span>
          ) : null}
          {awb ? (
            <span>
              <span className="text-gray-500">AWB </span>
              <span className="font-semibold text-gray-900">
                {delhiveryDisplayText(awb, "")}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {DELHIVERY_ORDER_DETAIL_SECTIONS.map((section) => {
        if (section.route) {
          const hasRoute =
            result.origin_city ||
            result.destination_city ||
            result.origin_branch ||
            result.destination_branch;
          if (!hasRoute) return null;
          return (
            <section key={section.id}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <MapPin className="h-4 w-4 text-[#3B966F]" />
              {section.title}
            </h3>
              <RouteCard data={result} />
            </section>
          );
        }

        const tiles = [];
        const rows = [];
        for (const field of section.fields) {
          const display = fieldDisplay(result, field);
          if (display == null) continue;
          if (section.columns === 2) {
            tiles.push({ label: field.label, value: display });
          } else {
            rows.push({ label: field.label, value: display, field });
          }
        }

        if (tiles.length === 0 && rows.length === 0) return null;

        return (
          <section key={section.id}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
              {section.id === "shipment" ? (
                <Package className="h-4 w-4 text-[#3B966F]" />
              ) : section.id === "schedule" ? (
                <CalendarDays className="h-4 w-4 text-[#3B966F]" />
              ) : null}
              {section.title}
            </h3>
            {section.columns === 2 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {tiles.map((t) => (
                  <StatTile key={t.label} label={t.label} value={t.value} />
                ))}
              </div>
            ) : (
              <dl className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {rows.map(({ label, value, field }) => (
                  <DetailRow
                    key={field.key}
                    label={label}
                    value={value}
                    highlight={field.key === "delivered_date"}
                  />
                ))}
              </dl>
            )}
          </section>
        );
      })}
    </div>
  );
}
