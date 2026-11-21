"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutList,
  Loader2,
  Tag,
  Users,
} from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import MetaFormAssignments from "@/components/MetaFormAssignments";
import MetaFormLeadsTable from "@/components/MetaFormLeadsTable";
import { LEADS_HUB_RANGE_OPTIONS, resolveLeadsHubRange } from "@/lib/leadsManageHubRange";

const TABS = [
  { id: "leads", label: "Form leads", icon: LayoutList },
  { id: "distribution", label: "Distribution", icon: Users },
  { id: "overview", label: "Overview", icon: FileText },
];

function formatCount(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

export default function LeadsManageMetaFormViewClient({
  dashboardBase = "admin-dashboard",
}) {
  const router = useRouter();
  const params = useParams();
  const credentialId = String(params?.id ?? "").trim();
  const hubHref = `/${dashboardBase}/leads-manage`;

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [credential, setCredential] = useState(null);
  const [activeTab, setActiveTab] = useState("leads");

  const [range, setRange] = useState("month");
  const monthDefaultResolved = useMemo(() => resolveLeadsHubRange("month"), []);
  const [customFrom, setCustomFrom] = useState(monthDefaultResolved.from);
  const [customTo, setCustomTo] = useState(monthDefaultResolved.to);
  const [appliedCustom, setAppliedCustom] = useState({
    from: monthDefaultResolved.from,
    to: monthDefaultResolved.to,
  });

  const [stats, setStats] = useState({ total: 0, distributed: 0, duplicate: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

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
    LEADS_HUB_RANGE_OPTIONS.find((o) => o.id === range)?.label ||
    "";

  useEffect(() => {
    if (!credentialId) return;
    fetchCredential();
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when route id changes
  }, [credentialId]);

  useEffect(() => {
    if (!credentialId || !startDate || !endDate) {
      setStats({ total: 0, distributed: 0, duplicate: 0 });
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
        const row = res.data?.byCredentialId?.[credentialId];
        if (res.data?.success && row) {
          setStats({
            total: row.total ?? 0,
            distributed: row.distributed ?? 0,
            duplicate: row.duplicate ?? 0,
          });
        } else {
          setStats({ total: 0, distributed: 0, duplicate: 0 });
        }
      })
      .catch(() => {
        if (!cancelled) setStats({ total: 0, distributed: 0, duplicate: 0 });
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [credentialId, startDate, endDate]);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await axios.get("/api/employees/active");
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchCredential = async () => {
    if (!credentialId) return;
    try {
      setLoading(true);
      const response = await axios.get(`/api/meta-credentials/${credentialId}`);
      if (response.data.success) {
        setCredential(response.data.data);
      } else {
        router.push(hubHref);
      }
    } catch (error) {
      toast.error("Failed to fetch credential");
      console.error(error);
      router.push(hubHref);
    } finally {
      setLoading(false);
    }
  };

  const formIds = useMemo(
    () => (Array.isArray(credential?.formIds) ? credential.formIds : []),
    [credential],
  );

  const title =
    String(credential?.employeeName || "").trim() ||
    (credentialId ? `Credential #${credentialId}` : "Meta form");

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-600" aria-hidden />
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="px-4 py-12 text-center text-slate-600">This Meta form could not be found.</div>
    );
  }

  return (
    <div className="w-full px-2 py-4 sm:px-4 sm:py-6">
      <Link
        href={hubHref}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Leads Manage
      </Link>

      <header className="relative mb-6 overflow-hidden rounded-2xl border border-violet-100/90 bg-gradient-to-br from-white via-violet-50/50 to-indigo-50/40 p-4 shadow-sm sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-300/25 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/25">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  credential.isActive !== false
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {credential.isActive !== false ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              {formIds.length} linked form{formIds.length === 1 ? "" : "s"}
              {rangeLabel ? (
                <>
                  {" "}
                  · counts for{" "}
                  <span className="font-medium text-violet-700">{rangeLabel}</span>
                </>
              ) : null}
            </p>
            {credential.latestProductInterest ? (
              <p
                className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-lg bg-indigo-100/90 px-2.5 py-1.5 text-xs font-medium text-indigo-900"
                title={credential.latestProductInterest}
              >
                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="break-words">{credential.latestProductInterest}</span>
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {statsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden />
              ) : null}
              <div className="relative inline-flex items-center">
                <CalendarDays
                  className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-violet-500"
                  aria-hidden
                />
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="min-w-[10.5rem] appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-semibold text-slate-800 shadow-sm hover:border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
                >
                  {LEADS_HUB_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>
            {range === "custom" ? (
              <div className="flex flex-wrap items-end justify-end gap-2 rounded-lg border border-violet-100 bg-white/80 p-2 shadow-sm">
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
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
              {statsLoading ? "…" : formatCount(stats.total)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60 p-4 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
              Distributed
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 sm:text-3xl">
              {statsLoading ? "…" : formatCount(stats.distributed)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-white to-rose-50/50 p-4 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">
              Duplicate
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-600 sm:text-3xl">
              {statsLoading ? "…" : formatCount(stats.duplicate)}
            </p>
          </div>
        </div>
      </header>

      <nav
        className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200/90 bg-slate-50/80 p-1"
        aria-label="Meta form sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:flex-none sm:px-4 ${
                active
                  ? "bg-white text-violet-800 shadow-sm ring-1 ring-violet-100"
                  : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        {activeTab === "overview" && (
          <div className="p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Credential overview</h2>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page ID
                </dt>
                <dd className="mt-1 break-all font-mono text-sm text-slate-900">
                  {credential.pageId || "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employee / label
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{title}</dd>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <dt className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Form IDs
                </dt>
                <dd className="flex flex-wrap gap-2">
                  {formIds.length > 0 ? (
                    formIds.map((formId) => (
                      <span
                        key={formId}
                        className="rounded-lg bg-violet-100 px-2.5 py-1 font-mono text-xs text-violet-900"
                      >
                        {formId}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">No form IDs linked</span>
                  )}
                </dd>
              </div>
              {(credential.productInterestByFormId &&
                Object.keys(credential.productInterestByFormId).length > 0) ||
              credential.latestProductInterest ? (
                <div className="sm:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <dt className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    Product interest by form
                  </dt>
                  <dd className="space-y-2">
                    {formIds.map((fid) => {
                      const pi =
                        credential.productInterestByFormId?.[fid] ||
                        (formIds.length === 1 ? credential.latestProductInterest : "");
                      if (!pi) return null;
                      return (
                        <div
                          key={fid}
                          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
                        >
                          <span className="font-mono text-xs text-slate-500">{fid}</span>
                          <span className="text-sm text-indigo-900">{pi}</span>
                        </div>
                      );
                    })}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        )}

        {activeTab === "distribution" && (
          <div className="p-2 sm:p-4">
            {loadingEmployees ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
              </div>
            ) : (
              <MetaFormAssignments
                formIds={formIds}
                employees={employees}
                embedded
                appearance="hub"
              />
            )}
          </div>
        )}

        {activeTab === "leads" && (
          <div className="p-2 sm:p-4">
            <MetaFormLeadsTable
              formIds={formIds}
              productInterestByFormId={credential.productInterestByFormId || {}}
              appearance="hub"
            />
          </div>
        )}
      </div>
    </div>
  );
}