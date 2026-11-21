"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { CalendarDays, ChevronDown, FileText, Loader2 } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { metaCredentialsBase } from "@/lib/metaCredentialsPaths";
import { LEADS_HUB_RANGE_OPTIONS, resolveLeadsHubRange } from "@/lib/leadsManageHubRange";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";

function credentialViewHref(dashboardBase, id) {
  return `/${dashboardBase}/leads-manage/meta-forms/${encodeURIComponent(String(id))}`;
}

function formatCount(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function formatLeadReceivingStart(value) {
  if (!value) return "—";
  return formatCrmDatetimeForISTDisplay(value) || "—";
}

function formatProductLabel(raw) {
  if (raw == null || raw === "") return "—";
  let s = String(raw).trim();
  s = s.replace(/^[-–—\s]+/, "");
  return s || "—";
}

function resolveModelName(cred, formId) {
  const byForm = cred.productInterestByFormId || {};
  const fromForm = byForm[formId] || byForm[String(formId)];
  if (fromForm) return formatProductLabel(fromForm);
  if (formIdsLength(cred) === 1 && cred.latestProductInterest) {
    return formatProductLabel(cred.latestProductInterest);
  }
  return "—";
}

function formIdsLength(cred) {
  return Array.isArray(cred.formIds) ? cred.formIds.length : 0;
}

function MetaCardDetailRow({
  label,
  children,
  valueClassName = "",
  labelClassName = "",
  rowClassName = "",
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-0.5 border-b border-slate-100 py-2.5 last:border-0 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:items-center sm:gap-4 ${rowClassName}`}
    >
      <dt
        className={`text-sm font-bold leading-snug text-slate-700 ${labelClassName}`}
      >
        {label}
      </dt>
      <dd
        className={`min-w-0 text-[15px] font-semibold leading-snug text-slate-900 sm:text-base ${valueClassName}`}
      >
        {children}
      </dd>
    </div>
  );
}

const META_FORM_RANGE_OPTIONS = LEADS_HUB_RANGE_OPTIONS;

function MetaSummaryKpiCard({ rangeLabel, statsLoading, summaryTotals }) {
  const items = [
    {
      label: "Total lead received",
      value: summaryTotals.total,
      valueClass: "text-slate-900",
      borderClass: "border-slate-200",
    },
    {
      label: "Distribute to sales",
      value: summaryTotals.distributed,
      valueClass: "text-emerald-800",
      borderClass: "border-emerald-300",
      surfaceClass: "bg-emerald-50",
      labelClass: "text-emerald-900",
    },
    {
      label: "Duplicate leads",
      value: summaryTotals.duplicate,
      valueClass: "text-red-700",
      borderClass: "border-red-300",
      surfaceClass: "bg-red-50",
      labelClass: "text-red-900",
    },
  ];

  return (
    <div className="mb-5 rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/60 to-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">Summary</h2>
        {rangeLabel ? (
          <p className="text-sm font-semibold text-violet-800">{rangeLabel}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border-2 px-4 py-4 text-center shadow-sm ${item.borderClass} ${item.surfaceClass || "bg-white"}`}
          >
            <p
              className={`text-sm font-bold leading-snug sm:text-[15px] ${item.labelClass || "text-slate-700"}`}
            >
              {item.label}
            </p>
            <p
              className={`mt-2 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl ${item.valueClass}`}
            >
              {statsLoading ? "…" : formatCount(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeadsManageMetaCredentialCards({
  dashboardBase = "admin-dashboard",
  variant = "embedded",
}) {
  const isPage = variant === "page";
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsById, setStatsById] = useState({});
  const [statsLoading, setStatsLoading] = useState(false);

  const [range, setRange] = useState("month");
  const monthDefaultResolved = useMemo(() => resolveLeadsHubRange("month"), []);
  const [customFrom, setCustomFrom] = useState(monthDefaultResolved.from);
  const [customTo, setCustomTo] = useState(monthDefaultResolved.to);
  const [appliedCustom, setAppliedCustom] = useState({
    from: monthDefaultResolved.from,
    to: monthDefaultResolved.to,
  });

  const activeRange = useMemo(() => {
    if (range === "custom") {
      return resolveLeadsHubRange("custom", appliedCustom);
    }
    return resolveLeadsHubRange(range);
  }, [range, appliedCustom]);

  const startDate = activeRange.from;
  const endDate = activeRange.to;
  const rangeLabel =
    activeRange.rangeLabel ||
    META_FORM_RANGE_OPTIONS.find((o) => o.id === range)?.label ||
    "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get("/api/meta-credentials", { params: { activeOnly: true } })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          setCredentials(
            res.data.data.filter((cred) => cred.isActive !== false),
          );
        } else {
          setCredentials([]);
        }
      })
      .catch(() => {
        if (!cancelled) setCredentials(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) {
      setStatsById({});
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    axios
      .get("/api/leads-manage/meta-credential-stats", {
        params: { from: startDate, to: endDate },
      })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && res.data.byCredentialId) {
          setStatsById(res.data.byCredentialId);
        } else {
          setStatsById({});
        }
      })
      .catch(() => {
        if (!cancelled) setStatsById({});
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const summaryTotals = useMemo(() => {
    return Object.values(statsById).reduce(
      (acc, row) => ({
        total: acc.total + (Number(row?.total) || 0),
        distributed: acc.distributed + (Number(row?.distributed) || 0),
        duplicate: acc.duplicate + (Number(row?.duplicate) || 0),
      }),
      { total: 0, distributed: 0, duplicate: 0 },
    );
  }, [statsById]);

  if (!loading && credentials === null) {
    if (!isPage) return null;
    return (
      <p className="py-8 text-center text-sm text-rose-600">
        Could not load Meta credentials. Try again or check Meta credentials setup.
      </p>
    );
  }

  if (!loading && credentials?.length === 0) {
    if (!isPage) return null;
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No active Meta credentials. Add credentials under{" "}
        <Link
          href={metaCredentialsBase(`/${dashboardBase}/leads-manage`)}
          className="font-medium text-violet-700 hover:underline"
        >
          Meta credentials
        </Link>
        .
      </p>
    );
  }

  return (
    <div
      className={
        isPage ? "space-y-1" : "mt-6 border-t border-slate-200/90 pt-5"
      }
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {!isPage ? (
            <h4 className="text-base font-bold text-slate-900">Meta lead forms</h4>
          ) : null}
          {rangeLabel ? (
            <p
              className={
                isPage
                  ? "text-sm text-slate-600"
                  : "mt-0.5 text-xs text-slate-500"
              }
            >
              Counts for{" "}
              <span className="font-medium text-violet-700">{rangeLabel}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {statsLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" />
            ) : null}
            <div className="relative inline-flex items-center">
              <CalendarDays className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-violet-500" />
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="min-w-[10.5rem] appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-semibold text-slate-800 shadow-sm hover:border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
              >
                {META_FORM_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>
          {range === "custom" ? (
            <div className="flex flex-wrap items-end justify-end gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-2">
              <label className="min-w-[8.5rem]">
                <span className="mb-0.5 block text-xs font-medium text-slate-500">From</span>
                <TypeableDateFilterInput
                  value={customFrom}
                  onChange={setCustomFrom}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                />
              </label>
              <label className="min-w-[8.5rem]">
                <span className="mb-0.5 block text-xs font-medium text-slate-500">To</span>
                <TypeableDateFilterInput
                  value={customTo}
                  onChange={setCustomTo}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => setAppliedCustom({ from: customFrom, to: customTo })}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Apply
              </button>
            </div>
          ) : null}
          <Link
            href={metaCredentialsBase(`/${dashboardBase}/leads-manage`)}
            className="text-right text-sm font-medium text-violet-700 hover:text-violet-900 hover:underline"
          >
            Meta credentials
          </Link>
        </div>
      </div>

      {isPage && !loading && credentials?.length ? (
        <MetaSummaryKpiCard
          rangeLabel={rangeLabel}
          statsLoading={statsLoading}
          summaryTotals={summaryTotals}
        />
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          Loading forms…
        </div>
      ) : (
        <div
          className={
            isPage
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "grid grid-cols-1 gap-3 sm:grid-cols-2"
          }
        >
          {credentials.map((cred) => {
            const credId = String(cred._id ?? cred.id ?? "");
            const href = credentialViewHref(dashboardBase, credId);
            const formIds = Array.isArray(cred.formIds) ? cred.formIds : [];
            const title =
              String(cred.employeeName || "").trim() || `Credential #${credId}`;
            const stats = statsById[credId] || {
              total: 0,
              distributed: 0,
              duplicate: 0,
            };
            const leadStart = formatLeadReceivingStart(cred.leadReceivingStartAt);

            return (
              <Link
                key={credId}
                href={href}
                className="group flex flex-col rounded-xl border border-violet-100/90 bg-gradient-to-br from-white to-violet-50/40 p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 group-hover:bg-violet-200">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900 group-hover:text-violet-900">
                        {title}
                      </p>
                      <p className="text-sm font-medium text-slate-600">
                        Leads in selected period:{" "}
                        <span className="font-bold tabular-nums text-slate-900">
                          {statsLoading ? "…" : formatCount(stats.total)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
                    Active
                  </span>
                </div>

                <dl className="rounded-lg border border-slate-100 bg-white/95 px-3 py-0.5">
                  {formIds.length > 0 ? (
                    formIds.map((formId, idx) => (
                      <div
                        key={formId}
                        className={
                          idx > 0
                            ? "border-t border-dashed border-violet-100 pt-1"
                            : ""
                        }
                      >
                        {formIds.length > 1 ? (
                          <p className="pb-0.5 pt-2 text-xs font-bold uppercase tracking-wide text-violet-700">
                            Form {idx + 1} of {formIds.length}
                          </p>
                        ) : null}
                        <MetaCardDetailRow label="Form name">
                          <span className="break-all font-mono text-sm font-bold text-violet-900">
                            {formId}
                          </span>
                        </MetaCardDetailRow>
                        <MetaCardDetailRow label="Product">
                          <span className="break-words font-bold text-indigo-950">
                            {resolveModelName(cred, formId)}
                          </span>
                        </MetaCardDetailRow>
                      </div>
                    ))
                  ) : (
                    <>
                      <MetaCardDetailRow label="Form name">—</MetaCardDetailRow>
                      <MetaCardDetailRow label="Product">—</MetaCardDetailRow>
                    </>
                  )}

                  <MetaCardDetailRow label="First lead received">
                    <span className="font-bold tabular-nums text-slate-900">{leadStart}</span>
                  </MetaCardDetailRow>

                  {rangeLabel ? (
                    <p className="border-b border-slate-100 py-2.5 text-xs font-semibold text-slate-600">
                      Distribution counts for{" "}
                      <span className="font-bold text-violet-800">{rangeLabel}</span>
                    </p>
                  ) : null}

                  <MetaCardDetailRow
                    label="Distributed to sales"
                    labelClassName="text-emerald-900"
                    rowClassName="-mx-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2"
                    valueClassName="text-lg font-bold tabular-nums text-emerald-800"
                  >
                    {statsLoading ? "…" : formatCount(stats.distributed)}
                  </MetaCardDetailRow>

                  <MetaCardDetailRow
                    label="Not distributed"
                    labelClassName="text-red-900"
                    rowClassName="-mx-1 rounded-lg border border-red-200 bg-red-50 px-2"
                    valueClassName="text-lg font-bold tabular-nums text-red-700"
                  >
                    <span>
                      {statsLoading ? "…" : formatCount(stats.duplicate)}
                      <span className="ml-1 text-sm font-semibold text-red-600/90">
                        (duplicate / pending)
                      </span>
                    </span>
                  </MetaCardDetailRow>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}