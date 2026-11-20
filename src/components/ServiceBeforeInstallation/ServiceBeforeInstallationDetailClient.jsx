"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Package,
  Phone,
  Plus,
  Shield,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { getSegmentMeta } from "@/lib/serviceBeforeInstallationHub";
import { openInstallationBucketRecordCount } from "@/lib/openInstallationKpiSql";
import { defaultSbiSelectFilters } from "@/lib/serviceBeforeInstallationFilters";
import ServiceBeforeInstallationFilters from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationFilters";
import ServiceBeforeInstallationDetailKpiStrip from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationDetailKpiStrip";
import ServiceBeforeInstallationOpenInstallationKpiStrip from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationOpenInstallationKpiStrip";
import { formatCrmDateOnly } from "@/lib/crmDateFormat";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";
import {
  formatUpcomingInstallationYmd,
  getUpcomingInstallationActualDeliveryDisplay,
  hasActualDeliveryDate,
  getUpcomingInstallationExpectedDateDisplay,
} from "@/lib/upcomingInstallationDeliveryDisplay";
import { isServiceRecordAssigned } from "@/lib/serviceRecordAssignment";
import UpcomingInstallationReferenceIds from "@/components/installation/UpcomingInstallationReferenceIds";
import UpcomingInstallationServiceStatusColumn, {
  parseUpcomingInstallationServiceDetails,
} from "@/components/installation/UpcomingInstallationServiceStatusColumn";

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

function DetailField({ label, value, multiline = false }) {
  const text = value == null ? "" : String(value).trim();
  if (!text) return null;
  return (
    <div className={`text-xs text-slate-700 ${multiline ? "whitespace-pre-wrap" : ""}`}>
      <span className="font-semibold text-slate-500">{label}: </span>
      {text}
    </div>
  );
}

function CompanyDetailBlock({ row }) {
  const hasAny =
    row.customer_name ||
    row.email ||
    row.contact_person ||
    row.contact ||
    row.customer_address;
  if (!hasAny) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-[11rem] max-w-[16rem] space-y-0.5">
      <DetailField label="Company" value={row.customer_name} />
      <DetailField label="Email" value={row.email} />
      <DetailField label="Person" value={row.contact_person} />
      <DetailField label="Contact" value={row.contact} />
      <DetailField label="Address" value={row.customer_address} multiline />
    </div>
  );
}

function SiteContactDetailBlock({ row }) {
  const hasAny = row.installed_address || row.site_person || row.site_contact || row.site_email;
  if (!hasAny) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-[11rem] max-w-[16rem] space-y-0.5">
      <DetailField label="Address" value={row.installed_address} multiline />
      <DetailField label="Person" value={row.site_person} />
      <DetailField label="Contact" value={row.site_contact} />
      <DetailField label="Email" value={row.site_email} />
    </div>
  );
}

function InvoiceDetailBlock({ row }) {
  const hasAny = row.invoice_number || row.invoice_date || row.invoice_file;
  if (!hasAny) return <span className="text-slate-400">—</span>;
  const invoiceFile = row.invoice_file ? String(row.invoice_file).trim() : "";
  return (
    <div className="min-w-[9rem] max-w-[14rem] space-y-0.5 text-xs">
      <DetailField label="#" value={row.invoice_number} />
      <DetailField label="Date" value={formatDate(row.invoice_date)} />
      {invoiceFile ? (
        <a
          href={`/uploads/${invoiceFile}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-semibold text-violet-700 underline hover:text-violet-900"
        >
          View File
        </a>
      ) : null}
    </div>
  );
}

function salesPersonLabel(row) {
  const orderRep = String(row.order_sales_person || row.emp_name || "").trim();
  const registeredBy = String(row.registered_by || "").trim();
  return orderRep || registeredBy || "";
}

function registeredByLabel(row) {
  return String(row.registered_by || "").trim();
}

function teamFilterOptionsFromRows(rows) {
  const salesPersons = new Set();
  const serviceEngineers = new Set();
  const thirdPartyEngineers = new Set();
  const assignedBys = new Set();
  const registeredBys = new Set();
  for (const row of rows) {
    const sales = salesPersonLabel(row);
    if (sales) salesPersons.add(sales);
    if (isServiceRecordAssigned(row.service_engineer)) {
      serviceEngineers.add(String(row.service_engineer).trim());
    }
    if (isServiceRecordAssigned(row.third_party_engineer)) {
      thirdPartyEngineers.add(String(row.third_party_engineer).trim());
    }
    const assignedBy = String(row.assigned_by || "").trim();
    if (assignedBy) assignedBys.add(assignedBy);
    const regBy = registeredByLabel(row);
    if (regBy) registeredBys.add(regBy);
  }
  return {
    salesPersons: [...salesPersons],
    serviceEngineers: [...serviceEngineers],
    thirdPartyEngineers: [...thirdPartyEngineers],
    assignedBys: [...assignedBys],
    registeredBys: [...registeredBys],
  };
}

function mergeTeamFilterOptions(fromApi, fromRows) {
  const merge = (a = [], b = []) =>
    [...new Set([...a, ...b])].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: "base" }));
  return {
    salesPersons: merge(fromApi?.salesPersons, fromRows?.salesPersons),
    serviceEngineers: merge(fromApi?.serviceEngineers, fromRows?.serviceEngineers),
    thirdPartyEngineers: merge(fromApi?.thirdPartyEngineers, fromRows?.thirdPartyEngineers),
    assignedBys: merge(fromApi?.assignedBys, fromRows?.assignedBys),
    registeredBys: merge(fromApi?.registeredBys, fromRows?.registeredBys),
  };
}

function ProductIdentityBlock({ row, customerHref, serialHref }) {
  const modelLabel = [row.product_name, row.model].filter(Boolean).join(" · ") || "—";
  const hasAny = row.customer_id || row.serial_number || modelLabel !== "—";
  if (!hasAny) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-[10rem] max-w-[14rem] space-y-1 text-xs">
      <div className="text-slate-700">
        <span className="font-semibold text-slate-500">Customer ID: </span>
        {customerHref ? (
          <Link href={customerHref} className="font-semibold text-violet-700 hover:underline">
            {row.customer_id}
          </Link>
        ) : (
          <span>{row.customer_id || "—"}</span>
        )}
      </div>
      <div className="text-slate-700">
        <span className="font-semibold text-slate-500">Serial: </span>
        {serialHref ? (
          <Link href={serialHref} className="font-semibold text-violet-700 hover:underline">
            {row.serial_number}
          </Link>
        ) : (
          <span>{row.serial_number || "—"}</span>
        )}
      </div>
      <div className="text-slate-800">
        <span className="font-semibold text-slate-500">Model: </span>
        {row.model ? (
          <span
            className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${modelPillClass(row.model)}`}
          >
            {modelLabel}
          </span>
        ) : (
          <span>{modelLabel}</span>
        )}
      </div>
    </div>
  );
}

function SalesServiceTeamBlock({ row }) {
  const sales = salesPersonLabel(row);
  const engineer = isServiceRecordAssigned(row.service_engineer)
    ? String(row.service_engineer).trim()
    : "";
  const thirdParty = isServiceRecordAssigned(row.third_party_engineer)
    ? String(row.third_party_engineer).trim()
    : "";
  if (!sales && !engineer && !thirdParty) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-[9rem] max-w-[13rem] space-y-0.5 text-xs">
      <DetailField label="Sales person" value={sales} />
      <DetailField label="Service engineer" value={engineer} />
      <DetailField label="Third party engineer" value={thirdParty} />
    </div>
  );
}

function InstallationWarrantyBlock({ row }) {
  const install = formatDate(row.installation_date);
  const warrantyEnd = formatDate(row.warranty_end_date);
  if (install === "—" && warrantyEnd === "—") {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="min-w-[8.5rem] space-y-0.5 text-xs">
      <DetailField label="Installation" value={install === "—" ? "" : install} />
      <DetailField label="Warranty end" value={warrantyEnd === "—" ? "" : warrantyEnd} />
    </div>
  );
}

function formatNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function formatAssignedEngineer(assignedTo) {
  if (isServiceRecordAssigned(assignedTo)) return String(assignedTo).trim();
  return "Not assigned";
}

function OpenInstallationEngineerCell({ row }) {
  const internal = isServiceRecordAssigned(row.service_engineer)
    ? String(row.service_engineer).trim()
    : "";
  const thirdParty = isServiceRecordAssigned(row.third_party_engineer)
    ? String(row.third_party_engineer).trim()
    : "";
  if (!internal && !thirdParty) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-[7rem] max-w-[11rem] space-y-0.5 text-xs text-slate-800">
      {internal ? (
        <div>
          <span className="font-semibold text-slate-500">Svc: </span>
          {internal}
        </div>
      ) : null}
      {thirdParty ? (
        <div>
          <span className="font-semibold text-slate-500">3P: </span>
          {thirdParty}
        </div>
      ) : null}
    </div>
  );
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
      "Dispatch Date",
      "Inv | Ord | Ser",
      "Company",
      "Delivery Address",
      "State",
      "Sales Person",
      "Assigned By",
      "Service Engineer",
      "Model",
      "Contact",
      "Order Status",
      "Delivery-Exp",
      "Act",
      "Registered Date",
      "Registered By",
      "Registration",
      "Service status",
    ],
    "overdue-delayed-installation": [
      "Dispatch Date",
      "Inv | Ord | Ser",
      "Company",
      "Delivery Address",
      "State",
      "Sales Person",
      "Assigned By",
      "Service Engineer",
      "Model",
      "Contact",
      "Order Status",
      "Delivery-Exp",
      "Act",
      "Registered Date",
      "Registered By",
      "Registration",
      "Service status",
    ],
    "active-amc": ["Serial", "Company", "Contact", "Status", "AMC Start", "AMC End"],
    "due-amc-expiring": ["Serial", "Company", "Contact", "Status", "AMC Start", "AMC End"],
    "total-registered": [
      "Customer / Serial / Model",
      "Registered Date",
      "Registered By",
      "Company",
      "Site Contact",
      "State",
      "Installation / Warranty",
      "Installed Address",
      "Invoice",
      "Sales / Service",
    ],
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
      const exp = getUpcomingInstallationExpectedDateDisplay(row).text;
      const act = getUpcomingInstallationActualDeliveryDisplay(row).text;
      return [
        formatUpcomingInstallationYmd(row.dispatch_date),
        [
          row.invoice_number,
          row.order_id,
          row.service_id,
        ]
          .filter(Boolean)
          .join(" / "),
        row.company_name,
        row.delivery_address,
        row.state,
        salesPersonLabel(row),
        row.assigned_by?.trim() || "",
        [
          isServiceRecordAssigned(row.service_engineer) ? row.service_engineer : "",
          isServiceRecordAssigned(row.third_party_engineer) ? row.third_party_engineer : "",
        ]
          .filter(Boolean)
          .join(" / "),
        [row.model, row.name].filter(Boolean).join(" · "),
        row.contact,
        hasActualDeliveryDate(row) ? "Delivered" : "Not delivered",
        exp,
        act,
        Number(row.warranty_registered) === 1 ? formatDate(row.registered_at) : "",
        Number(row.warranty_registered) === 1 ? registeredByLabel(row) : "",
        Number(row.warranty_registered) === 1 ? "Registered" : "Not registered",
        openInstallationServiceStatusExport(row),
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
    if (segment === "total-registered") {
      const modelText = [row.product_name, row.model].filter(Boolean).join(" ");
      const sales = salesPersonLabel(row);
      const engineer = isServiceRecordAssigned(row.service_engineer)
        ? String(row.service_engineer).trim()
        : "";
      const thirdParty = isServiceRecordAssigned(row.third_party_engineer)
        ? String(row.third_party_engineer).trim()
        : "";
      return [
        [
          row.customer_id ? `Customer ID: ${row.customer_id}` : "",
          row.serial_number ? `Serial: ${row.serial_number}` : "",
          modelText ? `Model: ${modelText}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
        formatDate(row.registered_at || row.invoice_date),
        registeredByLabel(row),
        [
          row.customer_name,
          row.email,
          row.contact_person,
          row.contact,
          row.customer_address,
        ]
          .filter(Boolean)
          .join(" | "),
        [row.site_person, row.site_contact, row.site_email].filter(Boolean).join(" | "),
        row.state,
        `Installation: ${formatDate(row.installation_date)} | Warranty end: ${formatDate(row.warranty_end_date)}`,
        row.installed_address,
        [row.invoice_number, formatDate(row.invoice_date)].filter(Boolean).join(" "),
        [
          sales ? `Sales: ${sales}` : "",
          engineer ? `Service engineer: ${engineer}` : "",
          thirdParty ? `Third party: ${thirdParty}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
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

function WarrantyProductRows({ rows, dashboardBase, page, pageSize, segment }) {
  const detailLayout = segment === "total-registered";

  return rows.map((row, idx) => {
    const rowNum = page * pageSize + idx + 1;
    const serialHref = row.serial_number
      ? `/${dashboardBase}/warranty/service-records/${encodeURIComponent(row.serial_number)}`
      : null;
    const customerHref = row.customer_id
      ? `/${dashboardBase}/view-customer/${row.customer_id}`
      : null;
    const zebra = idx % 2 === 0 ? "bg-white" : "bg-violet-50/35";
    if (!detailLayout) {
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
          <td className="whitespace-nowrap px-4 py-3.5">{formatDate(row.installation_date)}</td>
          <td className="whitespace-nowrap px-4 py-3.5">{formatDate(row.warranty_end_date)}</td>
          <td className="max-w-[220px] px-4 py-3.5 xl:max-w-none">
            <span className="line-clamp-2 text-slate-700">{row.installed_address || "—"}</span>
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
              ) : null}
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr key={row.id || row.serial_number || rowNum} className={`${zebra} hover:bg-violet-50/55 align-top`}>
        <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-slate-500">{rowNum}</td>
        <td className="px-4 py-3.5 align-top">
          <ProductIdentityBlock row={row} customerHref={customerHref} serialHref={serialHref} />
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700">
          {formatDate(row.registered_at || row.invoice_date)}
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-800">
          <span className="font-medium">{registeredByLabel(row) || "—"}</span>
        </td>
        <td className="px-4 py-3.5 align-top">
          <CompanyDetailBlock row={row} />
        </td>
        <td className="px-4 py-3.5 align-top">
          <SiteContactDetailBlock row={row} />
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700">{row.state?.trim() || "—"}</td>
        <td className="px-4 py-3.5 align-top">
          <InstallationWarrantyBlock row={row} />
        </td>
        <td className="min-w-[10rem] max-w-[18rem] px-4 py-3.5 text-sm text-slate-700">
          <span className="inline-flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span className="whitespace-pre-wrap">{row.installed_address?.trim() || "—"}</span>
          </span>
        </td>
        <td className="px-4 py-3.5 align-top">
          <InvoiceDetailBlock row={row} />
        </td>
        <td className="px-4 py-3.5 align-top">
          <SalesServiceTeamBlock row={row} />
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
          {serialHref ? (
            <Link
              href={serialHref}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"
              title="View product"
            >
              <Eye className="h-4 w-4" />
            </Link>
          ) : (
            <span className="text-slate-300">—</span>
          )}
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

function OpenInstallationDeliveryBlock({ row }) {
  const expected = getUpcomingInstallationExpectedDateDisplay(row);
  const actual = getUpcomingInstallationActualDeliveryDisplay(row);
  return (
    <div className="min-w-[8.5rem] space-y-0.5 text-xs leading-snug">
      <div>
        <span className="font-semibold text-slate-500">Delivery-Exp: </span>
        <span className={expected.className}>{expected.text}</span>
      </div>
      <div>
        <span className="font-semibold text-slate-500">Act: </span>
        <span className={actual.className}>{actual.text}</span>
      </div>
    </div>
  );
}

function OpenInstallationOrderStatusBadge({ row }) {
  const delivered = hasActualDeliveryDate(row);
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${
        delivered
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {delivered ? "Delivered" : "Not delivered"}
    </span>
  );
}

function openInstallationServiceStatusExport(row) {
  const items = parseUpcomingInstallationServiceDetails(row?.service_details);
  if (items.length > 0) {
    return items.map((it) => `${it.serviceId}:${it.status}`).join(" | ");
  }
  const fallbackId = String(row?.service_id || "").trim();
  return fallbackId || "";
}

function OpenInstallationActionCell({ row, dashboardBase }) {
  const hasService =
    parseUpcomingInstallationServiceDetails(row?.service_details).length > 0 ||
    String(row?.service_id || "").trim();
  const orderInstallationDone = Number(row?.order_installation_status) === 1;
  return (
    <div className="min-w-[10.5rem] space-y-2">
      {hasService ? (
        <UpcomingInstallationServiceStatusColumn
          record={row}
          serviceDetailsHrefBase={`/${dashboardBase}/view-service-report`}
        />
      ) : orderInstallationDone ? (
        <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          Completed (order)
        </span>
      ) : (
        <span className="text-xs text-slate-400">No installation service</span>
      )}
      {row.order_id ? (
        <Link
          href={`/${dashboardBase}/order/${encodeURIComponent(row.order_id)}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          View order
        </Link>
      ) : null}
    </div>
  );
}

function OpenInstallationRegistrationBadge({ row }) {
  const registered = Number(row.warranty_registered) === 1;
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${
        registered
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {registered ? "Registered" : "Not registered"}
    </span>
  );
}

function OpenInstallationRows({ rows, dashboardBase, page, pageSize }) {
  return rows.map((row, idx) => {
    const rowNum = page * pageSize + idx + 1;
    const zebra = idx % 2 === 0 ? "bg-white" : "bg-violet-50/35";
    const dispatchLabel = formatUpcomingInstallationYmd(row.dispatch_date);
    const modelLabel = [row.model, row.name].filter(Boolean).join(" · ") || "—";
    return (
      <tr
        key={row.order_id || row.id || rowNum}
        className={`${zebra} hover:bg-violet-50/55 align-top`}
      >
        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-500">{rowNum}</td>
        <td className="whitespace-nowrap px-4 py-3.5 text-sm font-medium text-slate-800">
          {dispatchLabel}
        </td>
        <td className="px-4 py-3.5 align-top">
          <UpcomingInstallationReferenceIds record={row} />
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-800">{row.company_name || "—"}</td>
        <td className="min-w-[10rem] max-w-[220px] px-4 py-3.5 text-sm text-slate-700 xl:max-w-none">
          <span className="whitespace-pre-wrap">{row.delivery_address || "—"}</span>
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700">{row.state?.trim() || "—"}</td>
        <td className="px-4 py-3.5 text-sm text-slate-800">{salesPersonLabel(row) || "—"}</td>
        <td className="px-4 py-3.5 text-sm text-slate-800">{row.assigned_by?.trim() || "—"}</td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationEngineerCell row={row} />
        </td>
        <td className="max-w-[180px] px-4 py-3.5 text-xs font-mono text-slate-800 xl:max-w-none">
          {modelLabel}
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-800">{row.contact || "—"}</td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationOrderStatusBadge row={row} />
        </td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationDeliveryBlock row={row} />
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700">
          {Number(row.warranty_registered) === 1 ? formatDate(row.registered_at) : "—"}
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-800">
          {Number(row.warranty_registered) === 1 ? registeredByLabel(row) || "—" : "—"}
        </td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationRegistrationBadge row={row} />
        </td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationActionCell row={row} dashboardBase={dashboardBase} />
        </td>
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
        <th className={th}>Dispatch Date</th>
        <th className={th}>Inv | Ord | Ser</th>
        <th className={th}>Company</th>
        <th className={th}>Delivery Address</th>
        <th className={th}>State</th>
        <th className={th}>Sales Person</th>
        <th className={th}>Assigned By</th>
        <th className={th}>Engineer</th>
        <th className={th}>Model</th>
        <th className={th}>Contact</th>
        <th className={th}>Order Status</th>
        <th className={th}>Delivery</th>
        <th className={th}>Registered Date</th>
        <th className={th}>Registered By</th>
        <th className={th}>Registration</th>
        <th className={th}>Action</th>
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
  if (segment === "total-registered") {
    return (
      <tr>
        <th className={th}>#</th>
        <th className={th}>Customer / Serial / Model</th>
        <th className={th}>Registered Date</th>
        <th className={th}>Registered By</th>
        <th className={th}>Company</th>
        <th className={th}>Site Contact</th>
        <th className={th}>State</th>
        <th className={th}>Installation / Warranty</th>
        <th className={th}>Installed Address</th>
        <th className={th}>Invoice</th>
        <th className={th}>Sales / Service</th>
        <th className={`${th} text-right`}>View</th>
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
    <WarrantyProductRows
      rows={rows}
      dashboardBase={dashboardBase}
      page={page}
      pageSize={pageSize}
      segment={segment}
    />
  );
}

function colSpanForSegment(segment) {
  if (segment === "total-registered") return 12;
  if (isWarrantyProductSegment(segment)) return 9;
  if (segment === "open-completions") return 10;
  if (segment === "open-installation" || segment === "overdue-delayed-installation") return 17;
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
  const [tableFilterOptions, setTableFilterOptions] = useState(null);
  const tableFilterOptionsFetchKeyRef = useRef(null);
  const listTotalRef = useRef(0);
  const rowsFetchAbortRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [countLoading, setCountLoading] = useState(false);
  const [installationBreakdown, setInstallationBreakdown] = useState({
    total_registered: 0,
    installation_pending: 0,
    installation_completed: 0,
  });
  const [openInstallationBreakdown, setOpenInstallationBreakdown] = useState({
    delivered_installation_pending: 0,
    delivery_pending_after_dispatch: 0,
    completed_installation: 0,
    no_feedback_collected: 0,
  });
  useEffect(() => {
    setPage(0);
    setTableFilterOptions(null);
    tableFilterOptionsFetchKeyRef.current = null;
    const next = initialSbiFiltersForSegment(segment);
    setDraftFilters(next);
    setAppliedFilters(next);
  }, [segment]);

  const fetchRows = useCallback(async () => {
    rowsFetchAbortRef.current?.abort();
    const controller = new AbortController();
    rowsFetchAbortRef.current = controller;

    setLoading(true);
    const isOpenInstallationList =
      segment === "open-installation" || segment === "overdue-delayed-installation";
    const activeBucket = String(appliedFilters.openInstallationBucket || "").trim();
    const skipTotal = isOpenInstallationList && (page > 0 || Boolean(activeBucket));
    const includeOpenInstallationBreakdown =
      isOpenInstallationList &&
      page === 0 &&
      !String(appliedFilters.openInstallationBucket || "").trim()
        ? "1"
        : "0";

    try {
      const res = await axios.get(`/api/service-before-installation/${segment}`, {
        params: {
          ...appliedFilters,
          limit: pageSize,
          skip: page * pageSize,
          includeFilterOptions: "0",
          deferTotal: "0",
          skipTotal: skipTotal ? "1" : "0",
          includeOpenInstallationBreakdown,
        },
        signal: controller.signal,
        timeout: 20_000,
      });
      if (res.data?.success) {
        const data = res.data.data || [];
        const pag = res.data.pagination || { total: 0, hasMore: false };
        const total =
          pag.total != null && pag.total !== undefined ? pag.total : listTotalRef.current;
        if (pag.total != null && pag.total !== undefined) {
          listTotalRef.current = pag.total;
        }
        setRows(data);
        setPagination({ total, hasMore: Boolean(pag.hasMore) });
        if (res.data.installationBreakdown) {
          setInstallationBreakdown(res.data.installationBreakdown);
        }
        if (res.data.openInstallationBreakdown) {
          setOpenInstallationBreakdown(res.data.openInstallationBreakdown);
        }
        setCountLoading(false);
      }
    } catch (e) {
      if (e?.code === "ERR_CANCELED") return;
      console.error(e);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [segment, appliedFilters, page, pageSize]);

  const fetchTableFilterOptions = useCallback(async () => {
    if (
      segment !== "total-registered" &&
      segment !== "open-installation" &&
      segment !== "overdue-delayed-installation"
    ) {
      return;
    }
    const key = JSON.stringify(appliedFilters);
    if (tableFilterOptionsFetchKeyRef.current === key) return;
    tableFilterOptionsFetchKeyRef.current = key;
    try {
      const res = await axios.get(`/api/service-before-installation/${segment}`, {
        params: {
          ...appliedFilters,
          filterOptionsOnly: "1",
        },
      });
      if (res.data?.success && res.data.filterOptions) {
        setTableFilterOptions(res.data.filterOptions);
      }
    } catch (e) {
      console.error(e);
      tableFilterOptionsFetchKeyRef.current = null;
    }
  }, [segment, appliedFilters]);

  const requestTableFilterOptions = useCallback(() => {
    void fetchTableFilterOptions();
  }, [fetchTableFilterOptions]);

  const mergedTableFilterOptions = useMemo(
    () => mergeTeamFilterOptions(tableFilterOptions, teamFilterOptionsFromRows(rows)),
    [tableFilterOptions, rows],
  );

  useEffect(() => {
    listTotalRef.current = 0;
  }, [segment, appliedFilters]);

  useEffect(() => {
    fetchRows();
    return () => rowsFetchAbortRef.current?.abort();
  }, [fetchRows]);

  const totalPages = pagination.totalPending
    ? Math.max(1, page + (pagination.hasMore ? 2 : 1))
    : Math.max(1, Math.ceil((pagination.total || 0) / pageSize));
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
            registeredInstallation={appliedFilters.registeredInstallation}
            totals={installationBreakdown}
            loading={loading}
            onCardSelect={(registeredInstallation) => {
              setLoading(true);
              setPage(0);
              const next = { ...appliedFilters, registeredInstallation };
              setAppliedFilters(next);
              setDraftFilters(next);
            }}
          />
        ) : null}

        {segment === "open-installation" ? (
          <ServiceBeforeInstallationOpenInstallationKpiStrip
            openInstallationBucket={appliedFilters.openInstallationBucket}
            totals={openInstallationBreakdown}
            loading={loading && page === 0}
            onCardSelect={(openInstallationBucket) => {
              setLoading(true);
              setPage(0);
              const nextBucket = String(openInstallationBucket || "").trim();
              const estTotal = nextBucket
                ? openInstallationBucketRecordCount(nextBucket, openInstallationBreakdown)
                : openInstallationBreakdown.total ?? listTotalRef.current;
              listTotalRef.current = estTotal;
              setPagination({ total: estTotal, hasMore: estTotal > pageSize });
              const next = { ...appliedFilters, openInstallationBucket };
              setAppliedFilters(next);
              setDraftFilters(next);
            }}
          />
        ) : null}

        <ServiceBeforeInstallationFilters
          segment={segment}
          tableFilterOptions={mergedTableFilterOptions}
          onRequestTableFilterOptions={requestTableFilterOptions}
          className="mb-5 shadow-[0_4px_20px_-10px_rgba(124,58,237,0.2)]"
          value={draftFilters}
          onChange={setDraftFilters}
          loading={loading}
          onApply={() => {
            setLoading(true);
            setPage(0);
            setTableFilterOptions(null);
            tableFilterOptionsFetchKeyRef.current = null;
            setAppliedFilters({ ...draftFilters });
          }}
          onClear={() => {
            setLoading(true);
            setPage(0);
            const next = initialSbiFiltersForSegment(segment);
            applyFilterState(setDraftFilters, setAppliedFilters, next);
          }}
        />

        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-lg font-bold text-slate-900">
              {pagination.total != null && pagination.total > 0
                ? `${formatNum(pagination.total)} Records`
                : pagination.hasMore
                  ? `${formatNum(rows.length)}+ Records`
                  : `${formatNum(rows.length)} Records`}
              {loading ? (
                <Loader2
                  className="ml-2 inline h-4 w-4 animate-spin text-violet-600"
                  aria-label="Loading"
                />
              ) : null}
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

          <div className="relative overflow-x-auto">
            <table
              className={`min-w-full text-sm transition-opacity ${loading && rows.length > 0 ? "opacity-50" : ""}`}
            >
              <thead>
                <TableHead segment={segment} />
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-20 text-center">
                      <Loader2
                        className="mx-auto h-8 w-8 animate-spin text-violet-600"
                        aria-hidden
                      />
                      <p className="mt-3 text-sm font-medium text-slate-600">Loading records…</p>
                    </td>
                  </tr>
                ) : !loading && rows.length === 0 ? (
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
            {loading && rows.length > 0 ? (
              <div
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/65 backdrop-blur-[1px]"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-violet-100 bg-white px-6 py-4 shadow-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
                  <p className="text-sm font-semibold text-slate-700">Updating list…</p>
                </div>
              </div>
            ) : null}
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