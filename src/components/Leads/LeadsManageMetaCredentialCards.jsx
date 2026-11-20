"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { CalendarDays, ChevronDown, FileText, Loader2, Tag } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { metaCredentialsBase } from "@/lib/metaCredentialsPaths";
import { LEADS_HUB_RANGE_OPTIONS, resolveLeadsHubRange } from "@/lib/leadsManageHubRange";

function credentialViewHref(dashboardBase, id) {
  return `/${dashboardBase}/leads-manage/meta-forms/${encodeURIComponent(String(id))}`;
}

function formatCount(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

const META_FORM_RANGE_OPTIONS = LEADS_HUB_RANGE_OPTIONS;

export default function LeadsManageMetaCredentialCards({
  dashboardBase = "admin-dashboard",
}) {
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsById, setStatsById] = useState({});
  const [statsLoading, setStatsLoading] = useState(false);

  const [range, setRange] = useState("today");
  const todayResolved = useMemo(() => resolveLeadsHubRange("today"), []);
  const [customFrom, setCustomFrom] = useState(todayResolved.from);
  const [customTo, setCustomTo] = useState(todayResolved.to);
  const [appliedCustom, setAppliedCustom] = useState({
    from: todayResolved.from,
    to: todayResolved.to,
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

  if (!loading && credentials === null) {
    return null;
  }

  if (!loading && credentials?.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-slate-200/90 pt-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-base font-bold text-slate-900">Meta lead forms</h4>
          {rangeLabel ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Counts for <span className="font-medium text-violet-700">{rangeLabel}</span>
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

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          Loading forms…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            return (
              <Link
                key={credId}
                href={href}
                className="group flex flex-col rounded-xl border border-violet-100/90 bg-gradient-to-br from-white to-violet-50/40 p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              >
                <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-white/90 p-2 text-center">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Total
                    </p>
                    <p className="text-lg font-bold tabular-nums text-slate-900">
                      {statsLoading ? "…" : formatCount(stats.total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                      Distributed
                    </p>
                    <p className="text-lg font-bold tabular-nums text-emerald-700">
                      {statsLoading ? "…" : formatCount(stats.distributed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                      Duplicate
                    </p>
                    <p className="text-lg font-bold tabular-nums text-rose-600">
                      {statsLoading ? "…" : formatCount(stats.duplicate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 group-hover:bg-violet-200">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-violet-900">
                        {title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formIds.length} form{formIds.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                    Active
                  </span>
                </div>

                {formIds.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {formIds.slice(0, 4).map((formId) => (
                      <span
                        key={formId}
                        className="max-w-full truncate rounded-md bg-violet-100/80 px-2 py-0.5 font-mono text-[10px] text-violet-900"
                        title={formId}
                      >
                        {formId}
                      </span>
                    ))}
                    {formIds.length > 4 ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        +{formIds.length - 4} more
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">No form IDs</p>
                )}

                {cred.latestProductInterest ? (
                  <p
                    className="mt-2 flex items-center gap-1 truncate text-xs text-indigo-700"
                    title={cred.latestProductInterest}
                  >
                    <Tag className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{cred.latestProductInterest}</span>
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}