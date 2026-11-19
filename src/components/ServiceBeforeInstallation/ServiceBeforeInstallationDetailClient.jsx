"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  Phone,
  Plus,
  Shield,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { getSegmentMeta } from "@/lib/serviceBeforeInstallationHub";
import { defaultSbiSelectFilters } from "@/lib/serviceBeforeInstallationFilters";
import ServiceBeforeInstallationFilters from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationFilters";
import ServiceBeforeInstallationDetailKpiStrip from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationDetailKpiStrip";
import { formatCrmDateOnly } from "@/lib/crmDateFormat";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";
import {
  formatUpcomingInstallationDays,
  installationStatusDateColor,
} from "@/lib/upcomingInstallationDeliveryDisplay";
import { isServiceRecordAssigned } from "@/lib/serviceRecordAssignment";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const SEGMENT_ICONS = {
  "total-registered": Package,
  "open-installation": Wrench,
  "open-completions": ClipboardList,
  "overdue-delayed-installation": AlertTriangle,
  "active-warranty": ShieldCheck,
  "due-warranty-expiry": CalendarClock,
  "active-amc": Shield,
  "due-amc-expiring": CalendarClock,
};

const MODEL_PILL_CLASSES = [
  "bg-violet-100 text-violet-800 border-violet-200/80",
  "bg-sky-100 text-sky-800 border-sky-200/80",
  "bg-emerald-100 text-emerald-800 border-emerald-200/80",
  "bg-amber-100 text-amber-900 border-amber-200/80",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200/80",
  "bg-cyan-100 text-cyan-900 border-cyan-200/80",
];

function isWarrantyProductSegment(segment) {
  return (
    segment === "total-registered" ||
    segment === "active-warranty" ||
    segment === "due-warranty-expiry"
  );
}

function initialSbiFiltersForSegment() {
  return defaultSbiSelectFilters();
}

function applyFilterState(setDraft, setApplied, next) {
  setDraft(next);
  setApplied(next);
}

function formatDate(raw) {
  if (!raw) return "—";
  return formatCrmDatetimeForISTDisplay(raw) || formatCrmDateOnly(String(raw).slice(0, 10)) || "—";
}

function formatNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function formatAssignedEngineer(assignedTo) {
  if (isServiceRecordAssigned(assignedTo)) return String(assignedTo).trim();
  return "Not assigned";
}

function modelPillClass(model) {
  const s = String(model || "").trim();
  if (!s) return MODEL_PILL_CLASSES[0];
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i) * (i + 1)) % MODEL_PILL_CLASSES.length;
  return MODEL_PILL_CLASSES[h];
}

function buildPageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages = new Set([0, total - 1, current, current - 1, current + 1]);
  const list = [...pages].filter((p) => p >= 0 && p < total).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    if (i > 0 && list[i] - list[i - 1] > 1) out.push("…");
    out.push(list[i]);
  }
  return out;
}

function exportRowsCsv(rows, segment) {
  if (!rows.length) return;
  const headersBySegment = {
    "open-completions": [
      "Service ID",
      "Serial",
      "Customer",
      "Model",
      "Type",
      "Status",
      "Service Engineer",
      "Complaint Date",
    ],
    "open-installation": [
      "Order ID",
      "Serial",
      "Model",
      "Product",
      "Company",
      "Contact",
      "Delivery Date",
      "Days",
      "Status",
      "Location",
    ],
    "overdue-delayed-installation": [
      "Order ID",
      "Serial",
      "Model",
      "Product",
      "Company",
      "Contact",
      "Delivery Date",
      "Days",
      "Status",
      "Location",
    ],
    "active-amc": ["Serial", "Company", "Contact", "Status", "AMC Start", "AMC End"],
    "due-amc-expiring": ["Serial", "Company", "Contact", "Status", "AMC Start", "AMC End"],
  };
  const defaultHeaders = [
    "Serial",
    "Customer",
    "Model",
    "Contact",
    "Installation",
    "Warranty End",
    "Installed Address",
  ];
  const headers = headersBySegment[segment] || defaultHeaders;

  const lines = rows.map((row) => {
    if (segment === "open-completions") {
      return [
        row.service_id,
        row.serial_number,
        row.customer_name,
        row.model,
        row.service_type,
        row.status,
        formatAssignedEngineer(row.assigned_to),
        formatDate(row.planned_date || row.complaint_date),
      ];
    }
    if (segment === "open-installation" || segment === "overdue-delayed-installation") {
      return [
        row.order_id,
        row.serial_number,
        row.model,
        row.name,
        row.company_name,
        row.contact,
        row.delivery_date,
        formatUpcomingInstallationDays(row),
        row.installation_status,
        row.delivery_address,
      ];
    }
    if (segment === "active-amc" || segment === "due-amc-expiring") {
      return [
        row.serial_number,
        row.company_name,
        row.contact,
        row.status,
        formatDate(row.amc_start_datetime),
        formatDate(row.amc_end_datetime),
      ];
    }
    return [
      row.serial_number,
      row.customer_name,
      row.model,
      row.contact,
      formatDate(row.installation_date),
      formatDate(row.warranty_end_date),
      row.installed_address,
    ];
  });

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...lines.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `service-before-installation-${segment}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function DetailSegmentHeader({ meta, segment }) {
  const Icon = SEGMENT_ICONS[segment] || Package;
  return (
    <header className="mb-5 flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-5 shadow-[0_4px_20px_-10px_rgba(15,23,42,0.1)] sm:px-6 sm:py-6">
      <div className="shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 p-3 text-white shadow-md shadow-violet-500/20">
        <Icon className="h-6 w-6" strokeWidth={2.1} aria-hidden />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{meta.title}</h1>
        <p className="mt-0.5 text-sm text-slate-500 sm:text-base">{meta.subtitle}</p>
      </div>
    </header>
  );
}

function WarrantyProductRows({ rows, dashboardBase, page, pageSize }) {
  return rows.map((row, idx) => {
    const rowNum = page * pageSize + idx + 1;
    const serialHref = row.serial_number
      ? `/${dashboardBase}/warranty/service-records/${encodeURIComponent(row.serial_number)}`
      : null;
    const zebra = idx % 2 === 0 ? "bg-white" : "bg-violet-50/35";
    return (
      <tr key={row.id || row.serial_number || rowNum} className={`${zebra} hover:bg-violet-50/55`}>
        <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-slate-500">{rowNum}</td>
        <td className="whitespace-nowrap px-4 py-3.5">
          {serialHref ? (
            <Link href={serialHref} className="font-semibold text-violet-700 hover:underline">
              {row.serial_number}
            </Link>
          ) : (
            row.serial_number || "—"
          )}
        </td>
        <td className="px-4 py-3.5">
          <span className="inline-flex items-center gap-2 text-slate-800">
            <Building2 className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span className="font-medium">{row.customer_name || "—"}</span>
          </span>
        </td>
        <td className="px-4 py-3.5">
          {row.model ? (
            <span
              className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${modelPillClass(row.model)}`}
            >
              {row.model}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3.5">
          {row.contact ? (
            <a
              href={`tel:${row.contact}`}
              className="inline-flex items-center gap-2 text-slate-700 hover:text-violet-700"
            >
              <Phone className="h-4 w-4 text-violet-500" aria-hidden />
              {row.contact}
            </a>
          ) : (
            "—"
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3.5">
          <span className="inline-flex items-center gap-2 text-slate-700">
            <CalendarDays className="h-4 w-4 text-violet-500" aria-hidden />
            {formatDate(row.installation_date)}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3.5">
          <span className="inline-flex items-center gap-2 text-slate-700">
            <CalendarDays className="h-4 w-4 text-violet-500" aria-hidden />
            {formatDate(row.warranty_end_date)}
          </span>
        </td>
        <td className="max-w-[220px] px-4 py-3.5 xl:max-w-none">
          <span className="inline-flex max-w-full items-start gap-2 text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span className="line-clamp-2">{row.installed_address || "—"}</span>
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-right">
          <div className="inline-flex items-center gap-1">
            {serialHref ? (
              <Link
                href={serialHref}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"
                title="View"
              >
                <Eye className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 text-slate-300">
                <Eye className="h-4 w-4" />
              </span>
            )}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"
              title="More"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  });
}

function ServiceRows({ rows, dashboardBase, page, pageSize, variant = "complaint" }) {
  const reportHref = (serviceId) =>
    `/${dashboardBase}/view-service-report/${encodeURIComponent(serviceId)}`;
  const showServiceRecordLayout = variant === "installation" || variant === "complaint";
  const dateField = (row) => formatDate(row.planned_date || row.complaint_date);

  return rows.map((row, idx) => {
    const rowNum = page * pageSize + idx + 1;
    const zebra = idx % 2 === 0 ? "bg-white" : "bg-violet-50/35";
    return (
      <tr key={row.service_id} className={`${zebra} hover:bg-violet-50/55`}>
        <td className="px-4 py-3.5 text-sm text-slate-500">{rowNum}</td>
        <td className="px-4 py-3.5">
          <Link href={reportHref(row.service_id)} className="font-mono text-sm font-semibold text-violet-700 hover:underline">
            {row.service_id}
          </Link>
        </td>
        <td className="px-4 py-3.5">
          {row.serial_number ? (
            <Link href={reportHref(row.service_id)} className="font-semibold text-violet-700 hover:underline">
              {row.serial_number}
            </Link>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-3.5">{row.customer_name || "—"}</td>
        {showServiceRecordLayout ? (
          <td className="max-w-[160px] truncate px-4 py-3.5 font-mono text-xs xl:max-w-none">{row.model || "—"}</td>
        ) : null}
        <td className="px-4 py-3.5">{row.service_type || "—"}</td>
        <td className="px-4 py-3.5">{row.status || "—"}</td>
        {showServiceRecordLayout ? (
          <td className="max-w-[180px] truncate px-4 py-3.5 text-sm text-slate-800 xl:max-w-none">
            {formatAssignedEngineer(row.assigned_to)}
          </td>
        ) : null}
        <td className="px-4 py-3.5">{dateField(row)}</td>
        {showServiceRecordLayout ? (
          <td className="px-4 py-3.5 text-right">
            <Link
              href={reportHref(row.service_id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"
              title="Open service report"
            >
              <Eye className="h-4 w-4" />
            </Link>
          </td>
        ) : null}
      </tr>
    );
  });
}

function installationStatusLabel(status) {
  if (status === "overdue") return "Overdue";
  if (status === "upcoming") return "Within 10 days";
  if (status === "scheduled") return "Scheduled";
  return status || "—";
}

function OpenInstallationRows({ rows, dashboardBase, page, pageSize }) {
  return rows.map((row, idx) => {
    const rowNum = page * pageSize + idx + 1;
    const zebra = idx % 2 === 0 ? "bg-white" : "bg-violet-50/35";
    const daysClass = installationStatusDateColor(row.installation_status);
    return (
      <tr
        key={row.order_id || row.id || rowNum}
        className={`${zebra} hover:bg-violet-50/55`}
      >
        <td className="px-4 py-3.5 text-sm text-slate-500">{rowNum}</td>
        <td className="px-4 py-3.5">
          <Link
            href={`/${dashboardBase}/order/${encodeURIComponent(row.order_id)}`}
            className="font-semibold text-violet-700 hover:underline"
          >
            {row.order_id}
          </Link>
        </td>
        <td className="max-w-[160px] truncate px-4 py-3.5 font-mono text-xs xl:max-w-none">{row.serial_number || "—"}</td>
        <td className="max-w-[140px] truncate px-4 py-3.5 text-xs font-mono text-slate-800 xl:max-w-none">
          {row.model || "—"}
        </td>
        <td className="max-w-[180px] truncate px-4 py-3.5 text-sm xl:max-w-none">{row.name || "—"}</td>
        <td className="px-4 py-3.5">{row.company_name || "—"}</td>
        <td className="px-4 py-3.5">{row.contact || "—"}</td>
        <td className="px-4 py-3.5">{formatDate(row.delivery_date)}</td>
        <td className={`px-4 py-3.5 text-sm ${daysClass}`}>
          {formatUpcomingInstallationDays(row)}
        </td>
        <td className="px-4 py-3.5 text-sm capitalize">
          {installationStatusLabel(row.installation_status)}
        </td>
        <td className="max-w-[200px] truncate px-4 py-3.5 xl:max-w-none">{row.delivery_address || "—"}</td>
      </tr>
    );
  });
}

function AmcRows({ rows, page, pageSize }) {
  return rows.map((row, idx) => {
    const rowNum = page * pageSize + idx + 1;
    const zebra = idx % 2 === 0 ? "bg-white" : "bg-violet-50/35";
    return (
      <tr key={row.id || rowNum} className={`${zebra} hover:bg-violet-50/55`}>
        <td className="px-4 py-3.5 text-sm text-slate-500">{rowNum}</td>
        <td className="px-4 py-3.5 font-mono">{row.serial_number || "—"}</td>
        <td className="px-4 py-3.5">{row.company_name || "—"}</td>
        <td className="px-4 py-3.5">{row.contact || "—"}</td>
        <td className="px-4 py-3.5">{row.status || "—"}</td>
        <td className="px-4 py-3.5">{formatDate(row.amc_start_datetime)}</td>
        <td className="px-4 py-3.5">{formatDate(row.amc_end_datetime)}</td>
      </tr>
    );
  });
}

function ServiceRecordTableHead({ dateLabel }) {
  const th =
    "px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 bg-slate-50/95";
  return (
    <tr>
      <th className={th}>#</th>
      <th className={th}>Service ID</th>
      <th className={th}>Serial</th>
      <th className={th}>Customer</th>
      <th className={th}>Model</th>
      <th className={th}>Type</th>
      <th className={th}>Status</th>
      <th className={th}>Service Engineer</th>
      <th className={th}>{dateLabel}</th>
      <th className={`${th} text-right`}>Report</th>
    </tr>
  );
}

function TableHead({ segment }) {
  const th =
    "px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 bg-slate-50/95";
  if (segment === "open-installation" || segment === "overdue-delayed-installation") {
    return (
      <tr>
        <th className={th}>#</th>
        <th className={th}>Order ID</th>
        <th className={th}>Serial</th>
        <th className={th}>Model</th>
        <th className={th}>Product</th>
        <th className={th}>Company</th>
        <th className={th}>Contact</th>
        <th className={th}>Delivery Date</th>
        <th className={th}>Days</th>
        <th className={th}>Status</th>
        <th className={th}>Location</th>
      </tr>
    );
  }
  if (segment === "open-completions") {
    return <ServiceRecordTableHead dateLabel="Complaint Date" />;
  }
  if (segment === "active-amc" || segment === "due-amc-expiring") {
    return (
      <tr>
        <th className={th}>#</th>
        <th className={th}>Serial</th>
        <th className={th}>Company</th>
        <th className={th}>Contact</th>
        <th className={th}>Status</th>
        <th className={th}>AMC Start</th>
        <th className={th}>AMC End</th>
      </tr>
    );
  }
  return (
    <tr>
      <th className={th}>#</th>
      <th className={th}>Serial</th>
      <th className={th}>Customer</th>
      <th className={th}>Model</th>
      <th className={th}>Contact</th>
      <th className={th}>Installation</th>
      <th className={th}>Warranty End</th>
      <th className={th}>Installed Address</th>
      <th className={`${th} text-right`}>Actions</th>
    </tr>
  );
}

function TableBody({ segment, rows, dashboardBase, page, pageSize }) {
  if (segment === "open-installation" || segment === "overdue-delayed-installation") {
    return (
      <OpenInstallationRows rows={rows} dashboardBase={dashboardBase} page={page} pageSize={pageSize} />
    );
  }
  if (segment === "open-completions") {
    return (
      <ServiceRows
        rows={rows}
        dashboardBase={dashboardBase}
        page={page}
        pageSize={pageSize}
        variant="complaint"
      />
    );
  }
  if (segment === "active-amc" || segment === "due-amc-expiring") {
    return <AmcRows rows={rows} page={page} pageSize={pageSize} />;
  }
  return (
    <WarrantyProductRows rows={rows} dashboardBase={dashboardBase} page={page} pageSize={pageSize} />
  );
}

function colSpanForSegment(segment) {
  if (isWarrantyProductSegment(segment)) return 9;
  if (segment === "open-completions") return 10;
  if (segment === "open-installation" || segment === "overdue-delayed-installation") return 11;
  if (segment === "active-amc" || segment === "due-amc-expiring") return 7;
  return 9;
}

export default function ServiceBeforeInstallationDetailClient({
  segment,
  dashboardBase = "admin-dashboard",
}) {
  const meta = getSegmentMeta(segment);
  const hubHref = `/${dashboardBase}/service-before-installation`;
  const warrantyHref = `/${dashboardBase}/warranty`;

  const [draftFilters, setDraftFilters] = useState(() => initialSbiFiltersForSegment(segment));
  const [appliedFilters, setAppliedFilters] = useState(() => initialSbiFiltersForSegment(segment));
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(0);
    const next = initialSbiFiltersForSegment(segment);
    setDraftFilters(next);
    setAppliedFilters(next);
  }, [segment]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/service-before-installation/${segment}`, {
        params: {
          ...appliedFilters,
          limit: pageSize,
          skip: page * pageSize,
        },
      });
      if (res.data?.success) {
        setRows(res.data.data || []);
        setPagination(res.data.pagination || { total: 0, hasMore: false });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [segment, appliedFilters, page, pageSize]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / pageSize));
  const pageWindow = useMemo(() => buildPageWindow(page, totalPages), [page, totalPages]);
  const colSpan = colSpanForSegment(segment);
  const showAddRegistered = isWarrantyProductSegment(segment);

  if (!meta) {
    return <p className="p-6 text-red-600">Unknown segment.</p>;
  }

  return (
    <div className="relative min-h-screen w-full pb-10 pt-2 sm:pt-3">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-violet-100/50 via-violet-50/25 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 w-full min-w-0 px-1 sm:px-2">
        <Link
          href={hubHref}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 text-sm font-semibold text-violet-700 hover:text-violet-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to Hub
        </Link>

        <DetailSegmentHeader meta={meta} segment={segment} />

        {segment === "total-registered" ? (
          <ServiceBeforeInstallationDetailKpiStrip
            dashboardBase={dashboardBase}
            activeSegment={segment}
            total={pagination.total}
            loading={loading}
          />
        ) : null}

        <ServiceBeforeInstallationFilters
          segment={segment}
          className="mb-5 shadow-[0_4px_20px_-10px_rgba(124,58,237,0.2)]"
          value={draftFilters}
          onChange={setDraftFilters}
          loading={loading}
          onApply={() => {
            setPage(0);
            setAppliedFilters({ ...draftFilters });
          }}
          onClear={() => {
            setPage(0);
            const next = initialSbiFiltersForSegment(segment);
            applyFilterState(setDraftFilters, setAppliedFilters, next);
          }}
        />

        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-lg font-bold text-slate-900">
              {formatNum(pagination.total)} Records
              {loading ? <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-violet-600" /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading || rows.length === 0}
                onClick={() => exportRowsCsv(rows, segment)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" aria-hidden />
                Export
              </button>
              {showAddRegistered ? (
                <Link
                  href={warrantyHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add Registered
                </Link>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <TableHead segment={segment} />
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-16 text-center text-slate-500">
                      No records match your filters.
                    </td>
                  </tr>
                ) : (
                  <TableBody
                    segment={segment}
                    rows={rows}
                    dashboardBase={dashboardBase}
                    page={page}
                    pageSize={pageSize}
                  />
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              Show
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-800"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              per page
            </label>

            <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
              <button
                type="button"
                disabled={page <= 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageWindow.map((item, i) =>
                item === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    disabled={loading}
                    onClick={() => setPage(item)}
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                      item === page
                        ? "bg-violet-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-violet-50"
                    }`}
                  >
                    {item + 1}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={!pagination.hasMore || loading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}