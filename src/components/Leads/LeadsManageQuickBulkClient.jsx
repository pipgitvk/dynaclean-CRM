"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpDown,
  ChevronRight,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Hash,
  Info,
  ListChecks,
  ListTodo,
  Clock,
  Loader2,
  Mail,
  Megaphone,
  MoreHorizontal,
  Phone,
  Search,
  Square,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { REASSIGN_NO_FOLLOWUP_DAYS } from "@/lib/reassignNoFollowupConstants";

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "New", label: "New" },
  { value: "verygud", label: "Very Good" },
  { value: "average", label: "Average" },
  { value: "poor", label: "Poor" },
  { value: "denied", label: "Denied" },
  { value: "invalid", label: "Invalid" },
  { value: "old_reassign", label: "Old Reassign" },
];

/** Matches Add Customer → Lead Campaign options. */
const CAMPAIGN_OPTIONS = [
  { value: "", label: "All Lead Campaigns" },
  { value: "india_mart", label: "India Mart" },
  { value: "social_media", label: "Social Media" },
  { value: "google_ads", label: "Google Ads" },
  { value: "website_visit", label: "Website Visit" },
  { value: "direct_call", label: "Direct Call" },
  { value: "manager_assigned", label: "Manager Assign" },
];

const STAGE_OPTIONS = [
  { value: "", label: "All Stage" },
  { value: "New", label: "New" },
  { value: "Contacted", label: "Contacted" },
  { value: "Interested", label: "Interested" },
  { value: "Demo Scheduled", label: "Demo Scheduled" },
  { value: "Demo Completed", label: "Demo Completed" },
  { value: "Qualified", label: "Qualified" },
  { value: "Quotation Sent", label: "Quotation Sent" },
  { value: "Quotation Revised", label: "Quotation Revised" },
  { value: "Negotiation / Follow-up", label: "Negotiation / Follow-up" },
  { value: "Decision Pending", label: "Decision Pending" },
  { value: "Won (Order Received)", label: "Won (Order Received)" },
  { value: "Lost", label: "Lost" },
  { value: "Disqualified / Invalid Lead", label: "Disqualified / Invalid Lead" },
];

const TABLE_STAGE_OPTIONS = [{ value: "", label: "Stage" }, ...STAGE_OPTIONS.slice(1)];

const PROFILE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const PAGE_SIZE_OPTIONS = [50, 100, 150];

function customerName(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || "—";
}

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("denied")) return "bg-rose-100 text-rose-800 ring-1 ring-rose-200/80";
  if (s.includes("invalid") || s.includes("disqual")) return "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80";
  if (s === "new") return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
}

function formatStatusLabel(status) {
  const s = String(status || "").trim();
  if (!s) return "—";
  const lower = s.toLowerCase();
  if (lower === "denied") return "Denied";
  if (lower === "invalid") return "Invalid";
  if (lower === "verygud") return "Very Good";
  if (lower === "old_reassign") return "Old Reassign";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatCampaign(raw) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function leadSourceForCustomer(row) {
  const v = String(row.lead_source || "").trim();
  return v || "—";
}

function isSalesLead(row) {
  return Boolean(String(row.lead_source || "").trim());
}

function filterEmployeesByProfile(list, profile) {
  const employees = Array.isArray(list) ? list : [];
  if (profile === "inactive") {
    return employees.filter((e) => Number(e.status) === 0);
  }
  if (profile === "active") {
    return employees.filter((e) => Number(e.status) !== 0);
  }
  return employees;
}

const inputShellClass =
  "relative flex min-w-0 items-center rounded-xl border border-slate-200 bg-white shadow-sm";

function BulkFilterField({ label, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1.5 block text-sm font-bold text-slate-900">{label}</span>
      {children}
    </div>
  );
}

function IconSelect({ icon: Icon, value, onChange, options, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <div className="relative flex items-center rounded-xl border border-slate-200 bg-white shadow-sm">
        <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-emerald-500" aria-hidden />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border-0 bg-transparent py-3 pl-10 pr-9 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
        >
          {options.map((opt) => (
            <option key={opt.value || opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" aria-hidden />
      </div>
    </label>
  );
}

function IconSearchableSelect({ icon: Icon, options, value, onChange, placeholder, searchPlaceholder }) {
  return (
    <div className={`${inputShellClass} items-stretch`}>
      <Icon className="ml-3 h-4 w-4 shrink-0 self-center text-emerald-500" aria-hidden />
      <div className="min-w-0 flex-1 py-0.5 pr-1">
        <SearchableSelect
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          className="border-0 bg-transparent shadow-none"
        />
      </div>
    </div>
  );
}

function employeeToOptions(employees, profile, emptyLabel = "Select employee") {
  const filtered = filterEmployeesByProfile(employees, profile);
  return [
    { value: "", label: emptyLabel },
    ...filtered.map((e) => ({
      value: e.username,
      label:
        Number(e.status) === 0 ? `${e.username} (Inactive)` : String(e.username),
    })),
  ];
}

export default function LeadsManageQuickBulkClient({ dashboardBase = "admin-dashboard" }) {
  const hubHref = `/${dashboardBase}/leads-manage`;

  const [fromSalesperson, setFromSalesperson] = useState("");
  const [toSalesperson, setToSalesperson] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [profileFilter, setProfileFilter] = useState("active");
  const [transferCount, setTransferCount] = useState("");

  const [employees, setEmployees] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [tableSearch, setTableSearch] = useState("");
  const [tableCustomer, setTableCustomer] = useState("");
  const [tableStage, setTableStage] = useState("");
  const [dateSort, setDateSort] = useState("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [reassignTotal, setReassignTotal] = useState(null);
  const [reassignTotalLoading, setReassignTotalLoading] = useState(true);
  const [pendingTotal, setPendingTotal] = useState(null);
  const [pendingTotalLoading, setPendingTotalLoading] = useState(true);
  const [noFollowupTotal, setNoFollowupTotal] = useState(null);
  const [noFollowupTotalLoading, setNoFollowupTotalLoading] = useState(true);

  const historyHref = `/${dashboardBase}/leads-manage/reassign-history`;
  const pendingHref = `/${dashboardBase}/leads-manage/pending-reassign`;
  const noFollowupHref = `/${dashboardBase}/leads-manage/reassign-no-followup`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bulk-lead-reassign-history?summary=1");
        const data = await res.json();
        if (!cancelled && data.success) setReassignTotal(Number(data.total || 0));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setReassignTotalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/pending-lead-reassign?summary=1");
        const data = await res.json();
        if (!cancelled && data.success) setPendingTotal(Number(data.total || 0));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setPendingTotalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/reassign-no-followup?summary=1");
        const data = await res.json();
        if (!cancelled && data.success) {
          setNoFollowupTotal(Number(data.not_followed ?? data.total ?? 0));
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setNoFollowupTotalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/lead-sources?type=sales&sales_from_rep_list=1");
        const data = await res.json();
        if (!cancelled && data.success) setEmployees(data.employees || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fromOptions = useMemo(
    () => employeeToOptions(employees, profileFilter, "From salesperson"),
    [employees, profileFilter],
  );

  const toOptions = useMemo(
    () => employeeToOptions(employees, profileFilter, "Select Employee"),
    [employees, profileFilter],
  );

  useEffect(() => {
    const allowed = new Set(filterEmployeesByProfile(employees, profileFilter).map((e) => e.username));
    if (fromSalesperson && !allowed.has(fromSalesperson)) setFromSalesperson("");
    if (toSalesperson && !allowed.has(toSalesperson)) setToSalesperson("");
  }, [profileFilter, employees, fromSalesperson, toSalesperson]);

  const fetchLeads = useCallback(async () => {
    if (!fromSalesperson) {
      setAllCustomers([]);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      params.set("lead_source", fromSalesperson);
      params.set("sales_only", "1");
      if (statusFilter) params.set("status", statusFilter);
      if (campaignFilter) params.set("lead_campaign", campaignFilter);
      const res = await fetch(`/api/bulk-leads-data?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAllCustomers(data.customers || []);
        setSelectedIds(new Set());
        setPage(0);
      } else {
        setLoadError(data.error || "Failed to load leads");
        setAllCustomers([]);
      }
    } catch (e) {
      console.error(e);
      setLoadError("Failed to load leads");
      setAllCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [fromSalesperson, statusFilter, campaignFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchLeads();
    }, 250);
    return () => clearTimeout(t);
  }, [fetchLeads]);

  const tableFiltered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const cq = tableCustomer.trim().toLowerCase();
    const rows = allCustomers.filter((row) => {
      if (!isSalesLead(row)) return false;
      if (tableStage && row.stage !== tableStage) return false;
      if (cq) {
        const name = customerName(row).toLowerCase();
        const phone = String(row.phone || "").toLowerCase();
        const email = String(row.email || "").toLowerCase();
        const phoneDigits = phone.replace(/\D/g, "");
        const cqDigits = cq.replace(/\D/g, "");
        const id = String(row.customer_id || "");
        const matchesCustomer =
          name.includes(cq) ||
          id.includes(cq) ||
          email.includes(cq) ||
          phone.includes(cq) ||
          (cqDigits.length >= 3 && phoneDigits.includes(cqDigits));
        if (!matchesCustomer) return false;
      }
      if (!q) return true;
      const hay = [
        customerName(row),
        row.phone,
        row.email,
        row.customer_id,
        row.lead_source,
        row.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    rows.sort((a, b) => {
      const ta = a.date_created ? Date.parse(a.date_created) : 0;
      const tb = b.date_created ? Date.parse(b.date_created) : 0;
      return dateSort === "asc" ? ta - tb : tb - ta;
    });
    return rows;
  }, [allCustomers, tableSearch, tableCustomer, tableStage, dateSort]);

  const totalRows = tableFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = tableFiltered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const transferN = Math.max(0, Math.min(Number(transferCount) || 0, totalRows));
  const remaining = Math.max(0, totalRows - transferN);
  const availableLeads = totalRows;

  /** Count field drives selection: first N rows in the current filtered list (date sort). */
  useEffect(() => {
    if (!fromSalesperson || totalRows === 0) {
      setSelectedIds(new Set());
      return;
    }
    const n = Math.max(0, Number(transferCount) || 0);
    const ids = tableFiltered.slice(0, n).map((r) => r.customer_id);
    setSelectedIds(new Set(ids));
  }, [transferCount, tableFiltered, fromSalesperson, totalRows]);

  const pageWindow = useMemo(() => {
    const out = [];
    const p = safePage;
    const last = totalPages - 1;
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) out.push(i);
      return out;
    }
    out.push(0);
    if (p > 2) out.push("…");
    for (let i = Math.max(1, p - 1); i <= Math.min(last - 1, p + 1); i++) out.push(i);
    if (p < last - 2) out.push("…");
    out.push(last);
    return out;
  }, [safePage, totalPages]);

  const allFilteredSelected =
    tableFiltered.length > 0 && tableFiltered.every((r) => selectedIds.has(r.customer_id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setTransferCount("");
      return;
    }
    setTransferCount(String(tableFiltered.length));
  };

  const toggleRow = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleReassign = async () => {
    if (!fromSalesperson) {
      alert("Select the salesperson to reassign from.");
      return;
    }
    if (!toSalesperson) {
      alert("Select the employee to assign leads to.");
      return;
    }
    if (toSalesperson === fromSalesperson) {
      alert("From and To salesperson must be different.");
      return;
    }
    if (transferN <= 0) {
      alert("Enter a valid number of leads to transfer.");
      return;
    }

    const picked = tableFiltered.filter((r) => selectedIds.has(r.customer_id));
    const ids = (picked.length ? picked : tableFiltered.slice(0, transferN))
      .slice(0, transferN)
      .map((r) => r.customer_id);

    const confirmed = window.confirm(
      `Reassign ${ids.length} lead(s) from ${fromSalesperson} to ${toSalesperson}?`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/bulk-assign-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_ids: ids,
          employee_username: toSalesperson,
          lead_type: "sales",
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "Reassignment completed.");
        setToSalesperson("");
        fetchLeads();
        try {
          const [c, p, n] = await Promise.all([
            fetch("/api/bulk-lead-reassign-history?summary=1"),
            fetch("/api/pending-lead-reassign?summary=1"),
            fetch("/api/reassign-no-followup?summary=1"),
          ]);
          const j = await c.json();
          const pj = await p.json();
          const nj = await n.json();
          if (j.success) setReassignTotal(Number(j.total || 0));
          if (pj.success) setPendingTotal(Number(pj.total || 0));
          if (nj.success) {
            setNoFollowupTotal(Number(nj.not_followed ?? nj.total ?? 0));
          }
        } catch {
          /* ignore count refresh */
        }
      } else {
        alert(data.error || "Reassignment failed.");
      }
    } catch (e) {
      console.error(e);
      alert("Reassignment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full pb-10 pt-2 sm:pt-3">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-50 to-transparent"
        aria-hidden
      />
      <div className="relative z-10 w-full min-w-0 px-1 sm:px-2">
        <Link
          href={hubHref}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Leads Hub
        </Link>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            href={historyHref}
            className="group flex flex-col justify-between rounded-2xl border border-emerald-300/90 bg-gradient-to-br from-emerald-100/95 via-emerald-50/80 to-emerald-50/40 p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                  No. of leads reassigned
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                  {reassignTotalLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
                  ) : (
                    (reassignTotal ?? 0).toLocaleString()
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">Sales reps only · bulk reassign events</p>
              </div>
              <div className="rounded-xl bg-emerald-700 p-2.5 text-white shadow-sm">
                <ArrowLeftRight className="h-5 w-5" aria-hidden />
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 group-hover:underline">
              Open details
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>

          <Link
            href={pendingHref}
            className="group flex flex-col justify-between rounded-2xl border border-amber-300/90 bg-gradient-to-br from-amber-100/95 via-amber-50/80 to-amber-50/40 p-5 text-left shadow-sm transition hover:border-amber-400 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                  No. of leads pending re-assign
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                  {pendingTotalLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-amber-600" aria-hidden />
                  ) : (
                    (pendingTotal ?? 0).toLocaleString()
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">Inactive sales role · lead source</p>
              </div>
              <div className="rounded-xl bg-amber-600 p-2.5 text-white shadow-sm">
                <ListTodo className="h-5 w-5" aria-hidden />
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-900 group-hover:underline">
              Open details
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>

          <Link
            href={noFollowupHref}
            className="group flex flex-col justify-between rounded-2xl border border-rose-300/90 bg-gradient-to-br from-rose-100/95 via-rose-50/80 to-rose-50/40 p-5 text-left shadow-sm transition hover:border-rose-400 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rose-900">
                  Not followed after re-assign ({REASSIGN_NO_FOLLOWUP_DAYS}+ days)
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                  {noFollowupTotalLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-rose-600" aria-hidden />
                  ) : (
                    (noFollowupTotal ?? 0).toLocaleString()
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">Sales owner · no follow-up after re-assign</p>
              </div>
              <div className="rounded-xl bg-rose-700 p-2.5 text-white shadow-sm">
                <Clock className="h-5 w-5" aria-hidden />
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-rose-900 group-hover:underline">
              Open details
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(16,185,129,0.18)] sm:p-6 lg:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <ArrowLeftRight className="h-6 w-6" strokeWidth={2.2} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
                Quick Bulk Reassignment
              </h1>
              <p className="mt-1 text-sm text-slate-500 sm:text-base">
                Reassign multiple leads from one salesperson to another.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <BulkFilterField label="From Salesperson">
              <IconSearchableSelect
                icon={User}
                options={fromOptions}
                value={fromSalesperson}
                onChange={setFromSalesperson}
                placeholder="From salesperson"
                searchPlaceholder="Search employee…"
              />
            </BulkFilterField>
            <BulkFilterField label="To Salesperson">
              <IconSearchableSelect
                icon={UserPlus}
                options={toOptions}
                value={toSalesperson}
                onChange={setToSalesperson}
                placeholder="Select Employee"
                searchPlaceholder="Search employee…"
              />
            </BulkFilterField>
            <BulkFilterField label="All Status">
              <IconSelect
                icon={ListChecks}
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
              />
            </BulkFilterField>
            <BulkFilterField label="All Lead Campaigns">
              <IconSelect
                icon={Megaphone}
                value={campaignFilter}
                onChange={setCampaignFilter}
                options={CAMPAIGN_OPTIONS}
              />
            </BulkFilterField>
            <BulkFilterField label="Profile">
              <IconSelect
                icon={User}
                value={profileFilter}
                onChange={setProfileFilter}
                options={PROFILE_OPTIONS}
              />
            </BulkFilterField>
            <BulkFilterField label="Number of Leads">
              <label className={`flex ${inputShellClass}`}>
                <Hash className="ml-3 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={transferCount}
                  onChange={(e) => setTransferCount(e.target.value)}
                  placeholder="Number of leads"
                  aria-label="Number of leads to reassign"
                  className="w-full rounded-xl border-0 bg-transparent py-3 pl-2 pr-8 text-sm font-medium text-slate-800 [appearance:textfield] focus:outline-none focus:ring-2 focus:ring-emerald-500/25 [&::-webkit-inner-spin-button]:opacity-100"
                />
              </label>
            </BulkFilterField>
          </div>

          <div className="mt-6 grid grid-cols-1 divide-y rounded-xl border border-slate-100 bg-slate-50/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <StatCell
              icon={Users}
              label="Available Leads"
              value={loading ? "…" : availableLeads}
              tone="accent"
            />
            <StatCell
              icon={ArrowLeftRight}
              label="Total to Transfer"
              value={loading ? "…" : transferN}
              tone="accent"
            />
            <StatCell
              icon={User}
              label="Remaining (Old Employee)"
              value={loading ? "…" : remaining}
              tone="slate"
            />
          </div>

          <button
            type="button"
            disabled={
              submitting || loading || !fromSalesperson || !toSalesperson || transferN <= 0
            }
            onClick={handleReassign}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowLeftRight className="h-5 w-5" />}
            {submitting
              ? "Reassigning…"
              : transferN > 0
                ? `Reassign ${transferN} Leads`
                : "Reassign Leads"}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Selected leads will be automatically reassigned as per filters.
          </p>
          {loadError ? <p className="mt-2 text-center text-sm text-rose-600">{loadError}</p> : null}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
          <div className="border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  disabled={!tableFiltered.length}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {allFilteredSelected ? (
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-500" />
                  )}
                  Select All
                </button>
                <span className="text-sm text-slate-500 xl:hidden">
                  {fromSalesperson
                    ? `Showing: ${totalRows} rows (${totalRows} customers) / ${allCustomers.length} loaded`
                    : null}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
                <ToolbarCustomerFilter
                  value={tableCustomer}
                  onChange={(v) => {
                    setTableCustomer(v);
                    setPage(0);
                  }}
                />
              <ToolbarFilterSelect
                value={tableStage}
                  onChange={setTableStage}
                  options={TABLE_STAGE_OPTIONS}
                  onAfterChange={() => setPage(0)}
                />
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end xl:w-auto xl:min-w-[16rem]">
                <label className="relative block w-full sm:min-w-[14rem]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search leads..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                  />
                </label>
                <span className="hidden shrink-0 text-sm text-slate-500 xl:inline">
                  {fromSalesperson
                    ? `Showing: ${totalRows} rows (${totalRows} customers) / ${allCustomers.length} loaded`
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  <th className="w-12 px-4 py-3.5">Select</th>
                  <th className="min-w-[13rem] px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Lead Type</th>
                  <th className="px-4 py-3.5">Lead Source</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Stage</th>
                  <th className="px-4 py-3.5">Tags</th>
                  <th className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => setDateSort((d) => (d === "desc" ? "asc" : "desc"))}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 hover:text-slate-700"
                    >
                      Date Created
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-slate-500">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                    </td>
                  </tr>
                ) : null}
                {!loading && !fromSalesperson ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-500">
                      Select a &quot;From salesperson&quot; to load leads.
                    </td>
                  </tr>
                ) : null}
                {!loading && fromSalesperson && pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-500">
                      No leads match your filters.
                    </td>
                  </tr>
                ) : null}
                {!loading
                  ? pageRows.map((row) => {
                      const checked = selectedIds.has(row.customer_id);
                      return (
                        <tr
                          key={row.customer_id}
                          className={`transition-colors ${
                            checked
                              ? "bg-emerald-50/90 ring-1 ring-inset ring-emerald-200"
                              : "hover:bg-slate-50/90"
                          }`}
                        >
                          <td className="px-4 py-5 align-top">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRow(row.customer_id)}
                              className="h-[1.05rem] w-[1.05rem] rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-5 align-top">
                            <div className="text-[15px] font-semibold leading-snug text-slate-900">
                              {customerName(row)}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                              <span className="inline-flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                                {row.phone || "—"}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                ID: {row.customer_id}
                              </span>
                            </div>
                            {row.email ? (
                              <div className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-slate-500">
                                <Mail className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                                {row.email}
                              </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-5 align-top">
                            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Sales
                            </span>
                          </td>
                          <td className="px-4 py-5 align-top">
                            <Link
                              href={`/${dashboardBase}/customers/${row.customer_id}`}
                              className="font-medium text-emerald-600 hover:text-emerald-800 hover:underline"
                            >
                              {leadSourceForCustomer(row)}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-5 align-top">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                            >
                              {formatStatusLabel(row.status)}
                            </span>
                          </td>
                          <td className="max-w-[14rem] px-4 py-5 align-top text-sm leading-snug text-slate-700">
                            {row.stage || "—"}
                          </td>
                          <td className="px-4 py-5 align-top text-sm text-slate-500">{row.tags?.trim() ? row.tags : "—"}</td>
                          <td className="whitespace-nowrap px-4 py-5 align-top text-sm text-slate-700">
                            {row.date_created && !Number.isNaN(Date.parse(row.date_created))
                              ? format(new Date(row.date_created), "dd MMM yyyy")
                              : "—"}
                          </td>
                          <td className="px-4 py-5 text-right align-top">
                            <Link
                              href={`/${dashboardBase}/customers/${row.customer_id}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              title="Open customer"
                            >
                              <MoreHorizontal className="h-5 w-5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm font-medium text-slate-600">
              {totalRows === 0
                ? "No results"
                : `Showing ${safePage * pageSize + 1} – ${Math.min(totalRows, safePage * pageSize + pageSize)} of ${totalRows}`}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-1">
              <PagerBtn
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </PagerBtn>
              {pageWindow.map((item, i) =>
                item === "…" ? (
                  <span key={`e-${i}`} className="px-1.5 text-slate-400">
                    …
                  </span>
                ) : (
                  <PagerBtn key={item} active={item === safePage} onClick={() => setPage(item)}>
                    {item + 1}
                  </PagerBtn>
                ),
              )}
              <PagerBtn
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </PagerBtn>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              Rows per page:
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 shadow-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ icon: Icon, label, value, tone = "accent" }) {
  const valueClass = tone === "accent" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <Icon className={`h-5 w-5 ${tone === "accent" ? "text-emerald-500" : "text-slate-500"}`} aria-hidden />
      <div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</div>
      </div>
    </div>
  );
}

function ToolbarFilterSelect({ value, onChange, options, onAfterChange }) {
  const current = options.find((o) => o.value === value)?.label || options[0]?.label;
  return (
    <label className="relative inline-flex min-w-[7.5rem] items-center">
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onAfterChange?.();
        }}
        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
        aria-label={current}
      >
        {options.map((opt) => (
          <option key={opt.value || opt.label} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400" aria-hidden />
    </label>
  );
}

function ToolbarCustomerFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(value.trim());
  return (
    <p className="relative inline-flex min-w-[7.5rem]">
      {!open && !hasValue ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-3 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300"
        >
          Customer
          <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
        </button>
      ) : (
        <span className="inline-flex w-full items-center rounded-xl border border-emerald-200 bg-emerald-50/40 py-1 pl-3 pr-1 shadow-sm">
          <User className="mr-1.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            type="search"
            autoFocus={open}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              if (!value.trim()) setOpen(false);
            }}
            placeholder="Name, ID, phone, email"
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm font-medium text-slate-800 focus:outline-none"
          />
        </span>
      )}
    </p>
  );
}

function PagerBtn({ onClick, disabled, active = false, children, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-semibold disabled:opacity-40 ${
        active
          ? "bg-emerald-500 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}