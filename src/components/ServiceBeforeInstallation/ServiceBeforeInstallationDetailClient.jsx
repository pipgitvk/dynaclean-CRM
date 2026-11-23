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
import {
  listUpcomingInstallationServiceIds,
  parseUpcomingInstallationServiceDetails,
} from "@/components/installation/UpcomingInstallationServiceStatusColumn";
import OpenInstallationStatusColumn from "@/components/installation/OpenInstallationStatusColumn";
import OpenInstallationReportButton from "@/components/installation/OpenInstallationReportButton";
import OpenInstallationServicesModal from "@/components/installation/OpenInstallationServicesModal";
import { parseOpenInstallationDispatchItems } from "@/lib/openInstallationDispatchItems";
import { listOpenInstallationSerialNumbers } from "@/lib/openInstallationServiceLineItems";
import {
  openInstallationViewMoreBtnClass,
  openInstallationViewMoreBtnClassCompact,
} from "@/components/installation/openInstallationViewMoreBtnClass";
import { useWarrantyProductFollowup } from "@/components/warranty/WarrantyProductFollowupControls";

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

function initialSbiFiltersForSegment(segment) {
  const base = defaultSbiSelectFilters();
  if (segment === "open-installation") {
    return { ...base, openInstallationBucket: "delivered_pending", itemType: "products" };
  }
  return base;
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

function registrationDateByExport(row, { useInvoiceFallback = false } = {}) {
  const registeredOnly =
    row.warranty_registered != null && Number(row.warranty_registered) !== 1;
  if (registeredOnly) return "";
  const raw = useInvoiceFallback
    ? row.registered_at || row.invoice_date
    : row.registered_at;
  const date = raw
    ? formatCrmDateOnly(String(raw).slice(0, 10)) || formatDate(raw)
    : "";
  const by = registeredByLabel(row);
  const byPart = by ? `Regst. By – ${by}` : "";
  return [date, byPart].filter(Boolean).join(" · ");
}

function registeredDateDisplay(row) {
  const raw = row.registered_at || row.invoice_date;
  if (!raw) return "";
  return formatCrmDateOnly(String(raw).slice(0, 10)) || formatDate(raw);
}

function RegistrationDateByCell({ row, requireWarrantyRegistered = false }) {
  if (requireWarrantyRegistered && Number(row.warranty_registered) !== 1) {
    return <span className="text-slate-400">—</span>;
  }
  const date = registeredDateDisplay(row);
  const by = registeredByLabel(row);
  if ((!date || date === "—") && !by) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="min-w-[8rem] space-y-1">
      {date && date !== "—" ? (
        <div className="text-sm leading-snug text-slate-800">
          <span className="text-xs font-semibold text-slate-500">Regst. Date</span>
          <span className="mx-1 text-slate-400">–</span>
          <span className="font-medium tabular-nums text-slate-900">{date}</span>
        </div>
      ) : null}
      {by ? (
        <div className="text-sm leading-snug text-slate-800">
          <span className="text-xs font-semibold text-slate-500">Regst. By</span>
          <span className="mx-1 text-slate-400">–</span>
          <span className="text-base font-semibold text-slate-900">{by}</span>
        </div>
      ) : null}
    </div>
  );
}

function teamFilterOptionsFromRows(rows) {
  const salesPersons = new Set();
  const serviceEngineers = new Set();
  const thirdPartyEngineers = new Set();
  const instCompletedBys = new Set();
  const assignedBys = new Set();
  const registeredBys = new Set();
  for (const row of rows) {
    const sales = salesPersonLabel(row);
    if (sales) salesPersons.add(sales);
    if (isServiceRecordAssigned(row.service_engineer)) {
      const name = String(row.service_engineer).trim();
      serviceEngineers.add(name);
      instCompletedBys.add(name);
    }
    if (isServiceRecordAssigned(row.third_party_engineer)) {
      const name = String(row.third_party_engineer).trim();
      thirdPartyEngineers.add(name);
      instCompletedBys.add(name);
    }
    const completedBy = openInstallationCompletedByEngineer(row);
    if (completedBy) instCompletedBys.add(completedBy);
    const regBy = registeredByLabel(row);
    if (regBy) {
      registeredBys.add(regBy);
      assignedBys.add(regBy);
    }
  }
  return {
    salesPersons: [...salesPersons],
    serviceEngineers: [...serviceEngineers],
    thirdPartyEngineers: [...thirdPartyEngineers],
    instCompletedBys: [...instCompletedBys],
    assignedBys: [...assignedBys],
    registeredBys: [...registeredBys],
  };
}

function mergeTeamFilterOptions(fromApi, fromRows) {
  const merge = (a = [], b = []) =>
    [...new Set([...a, ...b])].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: "base" }));
  const serviceEngineers = merge(fromApi?.serviceEngineers, fromRows?.serviceEngineers);
  const thirdPartyEngineers = merge(fromApi?.thirdPartyEngineers, fromRows?.thirdPartyEngineers);
  return {
    salesPersons: merge(fromApi?.salesPersons, fromRows?.salesPersons),
    serviceEngineers,
    thirdPartyEngineers,
    instCompletedBys: merge(
      fromApi?.instCompletedBys?.length
        ? fromApi.instCompletedBys
        : [...serviceEngineers, ...thirdPartyEngineers],
      fromRows?.instCompletedBys,
    ),
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

function openInstallationCompletedByEngineer(row) {
  const fromReport = String(row.installation_report_engineer || "").trim();
  if (fromReport) return fromReport;
  const recorded = String(row.completed_by_service_engineer || "").trim();
  if (recorded) return recorded;
  return "";
}

function assignedByEngineerExport(row) {
  const registeredBy = registeredByLabel(row);
  const completedBy = openInstallationCompletedByEngineer(row);
  return [
    registeredBy ? `Assigned By: ${registeredBy}` : "",
    completedBy ? `Completed by: ${completedBy}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function OpenInstallationAssignedByEngineerCell({ row }) {
  const registeredBy = registeredByLabel(row);
  const completedBy = openInstallationCompletedByEngineer(row);
  if (!registeredBy && !completedBy) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="min-w-[8.5rem] max-w-[12rem] space-y-1.5">
      <div className="text-sm leading-snug text-slate-800">
        <span className="text-xs font-semibold text-slate-500">Assigned By</span>
        <span className="mx-1 text-slate-400">–</span>
        <span className="font-semibold text-slate-900">{registeredBy || "—"}</span>
      </div>
      <div className="text-sm leading-snug text-slate-800">
        <span className="text-xs font-semibold text-slate-500">Completed by</span>
        <span className="mx-1 text-slate-400">–</span>
        <span className="font-semibold text-slate-900">{completedBy || "—"}</span>
      </div>
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

function openInstallationModelExport(row) {
  return parseOpenInstallationDispatchItems(row.model, row.name)
    .map((it) => {
      if (it.code && it.name) return `${it.code}: ${it.name}`;
      return it.code || it.name;
    })
    .join(" | ");
}

const OPEN_INSTALLATION_MODEL_PREVIEW = 3;
/** Open Installation: compact row + single View more when product lines exceed this count. */
const OPEN_INSTALLATION_COMPACT_PRODUCT_THRESHOLD = 3;

function OpenInstallationDispatchItemLine({ it, itemKey }) {
  return (
    <li key={itemKey} className="space-y-0.5">
      {it.code ? (
        <span
          className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-bold leading-tight ${modelPillClass(it.code)}`}
        >
          {it.code}
        </span>
      ) : null}
      {it.name ? <p className="text-xs leading-snug text-slate-700">{it.name}</p> : null}
    </li>
  );
}

function openInstallationRowHasExpandableDetails(row) {
  const products = parseOpenInstallationDispatchItems(row?.model, row?.name);
  const serviceIds = listUpcomingInstallationServiceIds(row);
  const serials = listOpenInstallationSerialNumbers(row);
  const statuses = parseUpcomingInstallationServiceDetails(row?.service_details);
  return (
    products.length > 0 ||
    serviceIds.length > 0 ||
    serials.length > 0 ||
    statuses.length > 0 ||
    Boolean(String(row?.service_id || "").trim())
  );
}

function OpenInstallationModelSummary({ row }) {
  const items = parseOpenInstallationDispatchItems(row.model, row.name);
  if (!items.length) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const label = items.length === 1 ? "1 product" : `${items.length} products`;
  return <span className="text-xs font-medium text-slate-600">{label}</span>;
}

function OpenInstallationRowViewMore({ row, dashboardBase, userRole, onRowPatched }) {
  const [open, setOpen] = useState(false);
  if (!openInstallationRowHasExpandableDetails(row)) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const orderLabel = row.order_id ? `Order ${row.order_id}` : "Order details";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={openInstallationViewMoreBtnClass}
        title="View products, serials, services and status"
      >
        <Eye className="h-3 w-3" aria-hidden />
        <span>View more</span>
      </button>
      <OpenInstallationServicesModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={orderLabel}
        row={row}
        dashboardBase={dashboardBase}
        role={userRole}
        onRowPatched={onRowPatched}
        showStatusEditor
      />
    </>
  );
}

function OpenInstallationModelCell({ row, dashboardBase = "" }) {
  const [allOpen, setAllOpen] = useState(false);
  const items = parseOpenInstallationDispatchItems(row.model, row.name);
  if (!items.length) {
    return <span className="text-slate-400">—</span>;
  }

  const hasMore = items.length > OPEN_INSTALLATION_MODEL_PREVIEW;
  const visible = hasMore ? items.slice(0, OPEN_INSTALLATION_MODEL_PREVIEW) : items;
  const hiddenCount = items.length - OPEN_INSTALLATION_MODEL_PREVIEW;

  return (
    <>
      <ul className="min-w-[10.5rem] max-w-[16rem] list-none space-y-2">
        {visible.map((it, idx) => (
          <OpenInstallationDispatchItemLine
            key={`${it.code}-${idx}`}
            itemKey={`${it.code}-${idx}`}
            it={it}
          />
        ))}
        {hasMore ? (
          <li>
            <button
              type="button"
              onClick={() => setAllOpen(true)}
              className={`${openInstallationViewMoreBtnClass} text-xs`}
              title={`View all ${items.length} products`}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
              <span>+{hiddenCount} more</span>
            </button>
          </li>
        ) : null}
      </ul>

      <OpenInstallationServicesModal
        isOpen={allOpen}
        onClose={() => setAllOpen(false)}
        title={`Products & services (${items.length})`}
        row={row}
        dashboardBase={dashboardBase}
        showStatusEditor={false}
      />
    </>
  );
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
      "Inv | Ord | Ser | S/N",
      "Company / State · Delivery",
      "Contact Person · Contact No",
      "Sales Person",
      "Assigned By / Completed by",
      "Model",
      "Order / Delivery",
      "Regst. / Registration",
      "Status / Installed",
      "Action",
    ],
    "overdue-delayed-installation": [
      "Dispatch Date",
      "Inv | Ord | Ser | S/N",
      "Company / State · Delivery",
      "Contact Person · Contact No",
      "Sales Person",
      "Assigned By / Completed by",
      "Model",
      "Order / Delivery",
      "Regst. / Registration",
      "Status / Installed",
      "Action",
    ],
    "active-amc": ["Serial", "Company", "Contact", "Status", "AMC Start", "AMC End"],
    "due-amc-expiring": ["Serial", "Company", "Contact", "Status", "AMC Start", "AMC End"],
    "total-registered": [
      "Customer / Serial / Model",
      "Regst. Date",
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
      return [
        formatUpcomingInstallationYmd(row.dispatch_date),
        [
          row.invoice_number,
          row.order_id,
          row.service_id,
          row.serial_number,
        ]
          .filter(Boolean)
          .join(" / "),
        companyStateDeliveryExport(row),
        openInstallationContactExport(row),
        salesPersonLabel(row),
        assignedByEngineerExport(row),
        openInstallationModelExport(row),
        orderDeliveryExport(row),
        registrationExport(row),
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
        registrationDateByExport(row, { useInvoiceFallback: true }),
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
        <td className="px-4 py-3.5 align-top">
          <RegistrationDateByCell row={row} />
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

function companyStateExport(row) {
  const company = String(row.company_name || "").trim();
  const state = String(row.state || "").trim();
  return [
    company ? `Company: ${company}` : "",
    state ? `State: ${state}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function openInstallationContactPersonLabel(row) {
  return String(row.contact_person || row.client_name || "").trim();
}

function companyStateDeliveryExport(row) {
  const addr = String(row.delivery_address || "").trim();
  return [companyStateExport(row), addr].filter(Boolean).join(" · ");
}

function OpenInstallationCompanyStateDeliveryCell({ row }) {
  const company = String(row.company_name || "").trim();
  const state = String(row.state || "").trim();
  const address = String(row.delivery_address || "").trim();
  if (!company && !state && !address) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="min-w-[9rem] max-w-[260px] space-y-1.5 xl:max-w-none">
      {company ? (
        <div className="text-sm leading-snug text-slate-800">
          <span className="text-xs font-semibold text-slate-500">Company</span>
          <span className="mx-1 text-slate-400">–</span>
          <span className="font-semibold text-slate-900">{company}</span>
        </div>
      ) : null}
      {state ? (
        <div className="text-sm leading-snug text-slate-800">
          <span className="text-xs font-semibold text-slate-500">State</span>
          <span className="mx-1 text-slate-400">–</span>
          <span className="font-semibold text-slate-900">{state}</span>
        </div>
      ) : null}
      {address ? (
        <div className="text-sm leading-snug text-slate-700">
          <span className="text-xs font-semibold text-slate-500">Delivery</span>
          <span className="mx-1 text-slate-400">–</span>
          <span className="whitespace-pre-wrap font-medium text-slate-800">{address}</span>
        </div>
      ) : null}
    </div>
  );
}

function openInstallationContactExport(row) {
  const person = openInstallationContactPersonLabel(row);
  const phone = String(row.contact || "").trim();
  return [
    person ? `Contact Person: ${person}` : "",
    phone ? `Contact No: ${phone}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function OpenInstallationContactPersonCell({ row }) {
  const person = openInstallationContactPersonLabel(row);
  const phone = String(row.contact || "").trim();
  if (!person && !phone) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="min-w-[7rem] max-w-[200px] space-y-1.5 xl:max-w-none">
      {person ? (
        <div className="text-sm leading-snug text-slate-800">
          <span className="text-xs font-semibold text-slate-500">Contact Person</span>
          <span className="mx-1 text-slate-400">–</span>
          <span className="font-semibold text-slate-900">{person}</span>
        </div>
      ) : null}
      {phone ? (
        <div className="text-sm leading-snug text-slate-800">
          <span className="text-xs font-semibold text-slate-500">Contact No</span>
          <span className="mx-1 text-slate-400">–</span>
          <span className="font-semibold tabular-nums text-slate-900">{phone}</span>
        </div>
      ) : null}
    </div>
  );
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

function openInstallationOrderDelivered(row) {
  const deliveryStatus =
    row?.order_delivery_status != null && row?.order_delivery_status !== ""
      ? Number(row.order_delivery_status)
      : null;
  if (deliveryStatus != null && !Number.isNaN(deliveryStatus)) {
    return deliveryStatus !== 0;
  }
  return hasActualDeliveryDate(row);
}

function OpenInstallationOrderStatusBadge({ row }) {
  const delivered = openInstallationOrderDelivered(row);
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

function OpenInstallationOrderDeliveryCell({ row }) {
  return (
    <div className="min-w-[8.5rem] space-y-1">
      <OpenInstallationOrderStatusBadge row={row} />
      <OpenInstallationDeliveryBlock row={row} />
    </div>
  );
}

function orderDeliveryExport(row) {
  const status = openInstallationOrderDelivered(row) ? "Delivered" : "Not delivered";
  const exp = getUpcomingInstallationExpectedDateDisplay(row).text;
  const act = getUpcomingInstallationActualDeliveryDisplay(row).text;
  return [status, `Delivery-Exp: ${exp}`, `Act: ${act}`].join(" · ");
}

function openInstallationPrimaryServiceId(row) {
  const items = parseUpcomingInstallationServiceDetails(row?.service_details);
  const completed = items.find(
    (it) => String(it.status || "").trim().toUpperCase() === "COMPLETED",
  );
  if (completed?.serviceId) return completed.serviceId;
  return (
    items[0]?.serviceId ||
    String(row?.service_id || "")
      .split(",")[0]
      ?.trim() ||
    ""
  );
}

function OpenInstallationReportButtons({ row, dashboardBase }) {
  const [allOpen, setAllOpen] = useState(false);
  const serviceIds = listUpcomingInstallationServiceIds(row);
  if (!serviceIds.length) return null;
  if (serviceIds.length === 1) {
    return <OpenInstallationReportButton row={row} dashboardBase={dashboardBase} />;
  }

  const hasMore = serviceIds.length > OPEN_INSTALLATION_MODEL_PREVIEW;
  const visibleIds = hasMore
    ? serviceIds.slice(0, OPEN_INSTALLATION_MODEL_PREVIEW)
    : serviceIds;
  const hiddenCount = serviceIds.length - OPEN_INSTALLATION_MODEL_PREVIEW;

  const renderReportButtons = (ids) =>
    ids.map((id) => (
      <OpenInstallationReportButton
        key={id}
        row={row}
        dashboardBase={dashboardBase}
        serviceId={id}
        compactLabel
      />
    ));

  return (
    <>
      <div className="flex w-full flex-col items-stretch gap-1">
        {renderReportButtons(visibleIds)}
        {hasMore ? (
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            className={`${openInstallationViewMoreBtnClass} justify-center`}
            title={`View all ${serviceIds.length} reports`}
          >
            <Eye className="h-3 w-3" aria-hidden />
            <span>+{hiddenCount} more</span>
          </button>
        ) : null}
      </div>

      <OpenInstallationServicesModal
        isOpen={allOpen}
        onClose={() => setAllOpen(false)}
        title={`Services & reports (${serviceIds.length})`}
        row={row}
        dashboardBase={dashboardBase}
        showStatusEditor={false}
      />
    </>
  );
}

function openInstallationFollowupProduct(row) {
  const serviceId = openInstallationPrimaryServiceId(row);
  const serial =
    String(row?.serial_number || "")
      .split(",")[0]
      ?.trim() || "";
  if (!serviceId && !serial) return null;
  return {
    service_id: serviceId,
    serial_number: serial,
    model: row.model,
    contact: row.contact,
    email: row.email,
    includeCustomerFollowups: false,
  };
}

function openInstallationServiceStatusExport(row) {
  const items = parseUpcomingInstallationServiceDetails(row?.service_details);
  if (items.length > 0) {
    return items
      .map((it) => {
        const installed = it.completedDate ? ` installed ${it.completedDate}` : "";
        return `${it.serviceId}:${it.status}${installed}`;
      })
      .join(" | ");
  }
  const fallbackId = String(row?.service_id || "").trim();
  const installed =
    row.installed_date || row.completed_date || row.installation_date || "";
  if (fallbackId) {
    return installed ? `${fallbackId} installed ${installed}` : fallbackId;
  }
  return installed ? `installed ${installed}` : "";
}

function OpenInstallationActionCell({
  row,
  dashboardBase,
  ProductFollowupIcons,
  hideReportButtons = false,
}) {
  const followupProduct = openInstallationFollowupProduct(row);
  return (
    <div className="flex min-w-[5.5rem] flex-col items-start gap-2">
      {followupProduct && ProductFollowupIcons ? (
        <ProductFollowupIcons
          product={followupProduct}
          className="!mt-0 mb-0"
          variant="button"
        />
      ) : null}
      {hideReportButtons ? null : (
        <OpenInstallationReportButtons row={row} dashboardBase={dashboardBase} />
      )}
      {row.order_id ? (
        <Link
          href={`/${dashboardBase}/order/${encodeURIComponent(row.order_id)}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          View order
        </Link>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  );
}

function openInstallationWarrantyProductsSearchTerm(row) {
  const serial =
    String(row.serial_number || "")
      .split(",")[0]
      ?.trim() || "";
  if (serial) return serial;
  const invoice = String(row.invoice_number || "").trim();
  if (invoice) return invoice;
  return String(row.company_name || "").trim();
}

function OpenInstallationRegistrationBadge({ row, dashboardBase }) {
  const registered = Number(row.warranty_registered) === 1;
  const badgeClass = `inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${
    registered
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-900"
  }`;
  const label = registered ? "Registered" : "Not registered";

  if (registered && dashboardBase) {
    const term = openInstallationWarrantyProductsSearchTerm(row);
    if (term) {
      const href = `/${dashboardBase}/warranty/products?search=${encodeURIComponent(term)}`;
      return (
        <Link
          href={href}
          className={`${badgeClass} transition hover:border-emerald-300 hover:bg-emerald-100 hover:underline`}
          title="View registered warranty product"
        >
          {label}
        </Link>
      );
    }
  }

  return <span className={badgeClass}>{label}</span>;
}

function registrationExport(row) {
  const status = Number(row.warranty_registered) === 1 ? "Registered" : "Not registered";
  const detail = registrationDateByExport(row);
  return [detail, status].filter(Boolean).join(" · ");
}

function OpenInstallationRegistrationCell({ row, dashboardBase }) {
  const registered = Number(row.warranty_registered) === 1;
  const orderId = String(row.order_id || "").trim();
  const warrantyRegisterHref =
    orderId &&
    `/${dashboardBase}/warranty?mode=order&order_id=${encodeURIComponent(orderId)}`;
  return (
    <div className="min-w-[8rem] space-y-1.5">
      {registered ? <RegistrationDateByCell row={row} /> : null}
      <OpenInstallationRegistrationBadge row={row} dashboardBase={dashboardBase} />
      {!registered && warrantyRegisterHref ? (
        <Link
          href={warrantyRegisterHref}
          className="inline-flex rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
        >
          Register now
        </Link>
      ) : null}
    </div>
  );
}

function OpenInstallationRows({
  rows,
  dashboardBase,
  page,
  pageSize,
  userRole,
  onOpenInstallationRowPatch,
  ProductFollowupIcons,
  segment = "",
}) {
  return rows.map((row, idx) => {
    const productCount = parseOpenInstallationDispatchItems(row.model, row.name).length;
    const useCompactViewMore =
      segment === "open-installation" &&
      productCount > OPEN_INSTALLATION_COMPACT_PRODUCT_THRESHOLD;
    const rowNum = page * pageSize + idx + 1;
    const zebra = idx % 2 === 0 ? "bg-white" : "bg-violet-50/35";
    const dispatchLabel = formatUpcomingInstallationYmd(row.dispatch_date);
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
          <UpcomingInstallationReferenceIds
            record={row}
            dashboardBase={dashboardBase}
            hideServiceAndSerialLists={useCompactViewMore}
          />
        </td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationCompanyStateDeliveryCell row={row} />
        </td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationContactPersonCell row={row} />
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-800">{salesPersonLabel(row) || "—"}</td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationAssignedByEngineerCell row={row} />
        </td>
        <td className="px-4 py-3.5 align-top xl:max-w-none">
          {useCompactViewMore ? (
            <OpenInstallationModelSummary row={row} />
          ) : (
            <OpenInstallationModelCell row={row} dashboardBase={dashboardBase} />
          )}
        </td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationOrderDeliveryCell row={row} />
        </td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationRegistrationCell row={row} dashboardBase={dashboardBase} />
        </td>
        <td className="px-4 py-3.5 align-top">
          {useCompactViewMore ? (
            <OpenInstallationRowViewMore
              row={row}
              dashboardBase={dashboardBase}
              userRole={userRole}
              onRowPatched={onOpenInstallationRowPatch}
            />
          ) : (
            <OpenInstallationStatusColumn
              row={row}
              role={userRole}
              onRowPatched={onOpenInstallationRowPatch}
              dashboardBase={dashboardBase}
            />
          )}
        </td>
        <td className="px-4 py-3.5 align-top">
          <OpenInstallationActionCell
            row={row}
            dashboardBase={dashboardBase}
            ProductFollowupIcons={ProductFollowupIcons}
            hideReportButtons={useCompactViewMore}
          />
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
        <th className={th}>Inv | Ord | Ser | S/N</th>
        <th className={th}>Company / State · Delivery</th>
        <th className={th}>Contact Person · Contact No</th>
        <th className={th}>Sales Person</th>
        <th className={th}>Assigned By / Completed by</th>
        <th className={th}>Model</th>
        <th className={th}>Order / Delivery</th>
        <th className={th}>Regst. / Registration</th>
        <th className={th}>Status</th>
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
        <th className={th}>Regst. Date</th>
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

function TableBody({
  segment,
  rows,
  dashboardBase,
  page,
  pageSize,
  userRole,
  onOpenInstallationRowPatch,
  ProductFollowupIcons,
}) {
  if (segment === "open-installation" || segment === "overdue-delayed-installation") {
    return (
      <OpenInstallationRows
        rows={rows}
        dashboardBase={dashboardBase}
        page={page}
        pageSize={pageSize}
        userRole={userRole}
        onOpenInstallationRowPatch={onOpenInstallationRowPatch}
        ProductFollowupIcons={ProductFollowupIcons}
        segment={segment}
      />
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
  if (segment === "total-registered") return 11;
  if (isWarrantyProductSegment(segment)) return 9;
  if (segment === "open-completions") return 10;
  if (segment === "open-installation" || segment === "overdue-delayed-installation") return 12;
  if (segment === "active-amc" || segment === "due-amc-expiring") return 7;
  return 9;
}

export default function ServiceBeforeInstallationDetailClient({
  segment,
  dashboardBase = "admin-dashboard",
  userRole = "",
}) {
  const meta = getSegmentMeta(segment);
  const headerMeta = meta
    ? {
        ...meta,
        title: meta.detailTitle || meta.title,
      }
    : meta;
  const hubHref = `/${dashboardBase}/service-before-installation`;
  const warrantyHref = `/${dashboardBase}/warranty`;
  const { ProductFollowupIcons, followupModals } = useWarrantyProductFollowup();

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
  const kpiFetchAbortRef = useRef(null);
  const countFetchAbortRef = useRef(null);
  const kpiFetchedKeyRef = useRef("");
  const kpiRequestIdRef = useRef(0);
  const rowsRequestIdRef = useRef(0);
  const applyListTotalRef = useRef(null);
  const servicesEnrichRequestIdRef = useRef(0);
  const openInstallationBreakdownRef = useRef({
    delivered_installation_pending: 0,
    delivery_pending_after_dispatch: 0,
    installation_planned: 0,
    completed_installation: 0,
    feedback_collected: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const [installationBreakdown, setInstallationBreakdown] = useState({
    total_registered: 0,
    installation_pending: 0,
    installation_completed: 0,
  });
  const [openInstallationBreakdown, setOpenInstallationBreakdown] = useState({
    delivered_installation_pending: 0,
    delivery_pending_after_dispatch: 0,
    installation_planned: 0,
    completed_installation: 0,
    feedback_collected: 0,
    total: 0,
  });
  const [openInstallationKpiLoading, setOpenInstallationKpiLoading] = useState(false);
  const [feedbackCollectedKpiLoading, setFeedbackCollectedKpiLoading] = useState(false);
  openInstallationBreakdownRef.current = openInstallationBreakdown;

  useEffect(() => {
    setPage(0);
    setTableFilterOptions(null);
    tableFilterOptionsFetchKeyRef.current = null;
    const next = initialSbiFiltersForSegment(segment);
    setDraftFilters(next);
    setAppliedFilters(next);
  }, [segment]);

  const openInstallationKpiFilterKey = useMemo(() => {
    if (segment !== "open-installation") return "";
    const {
      openInstallationBucket: _bucket,
      registeredInstallation: _reg,
      ...rest
    } = appliedFilters;
    return JSON.stringify(rest);
  }, [segment, appliedFilters]);

  const applyListTotal = useCallback(
    (total, rowsLen = 0) => {
      const n = Number(total) || 0;
      if (n > 0) listTotalRef.current = n;
      setPagination((prev) => {
        const nextTotal = n > 0 ? n : prev.total || 0;
        return {
          total: nextTotal,
          hasMore:
            nextTotal > 0
              ? page * pageSize + (rowsLen || pageSize) < nextTotal
              : prev.hasMore,
        };
      });
      setCountLoading(false);
    },
    [page, pageSize],
  );
  applyListTotalRef.current = applyListTotal;

  const patchFeedbackCollected = useCallback((total) => {
    const n = Number(total || 0);
    setOpenInstallationBreakdown((prev) => {
      const next = { ...prev, feedback_collected: n };
      openInstallationBreakdownRef.current = next;
      return next;
    });
  }, []);

  /** Google feedback collected count — does not block list / other KPI cards. */
  const fetchFeedbackCollectedKpiCount = useCallback(
    async (signal) => {
      if (segment !== "open-installation") return;
      const { openInstallationBucket: _bucket, ...kpiFilters } = appliedFilters;
      setFeedbackCollectedKpiLoading(true);
      try {
        const res = await axios.get("/api/service-before-installation/google-feedback", {
          params: {
            ...kpiFilters,
            countOnly: "1",
            limit: 1,
            skip: 0,
          },
          signal,
          timeout: 15_000,
        });
        if (res.data?.success) {
          const n = Number(
            res.data.feedback_collected ?? res.data.pagination?.total ?? 0,
          );
          patchFeedbackCollected(n);
          if (String(appliedFilters.openInstallationBucket || "").trim() === "feedback_collected") {
            applyListTotal(n);
          }
        }
      } catch (e) {
        if (e?.code !== "ERR_CANCELED") console.error(e);
      } finally {
        if (!signal?.aborted) setFeedbackCollectedKpiLoading(false);
      }
    },
    [segment, appliedFilters, patchFeedbackCollected, applyListTotal],
  );

  /** Cards API only — does not load table rows. */
  const fetchOpenInstallationKpis = useCallback(async () => {
    if (segment !== "open-installation") return;
    const filterKey = openInstallationKpiFilterKey;
    if (kpiFetchedKeyRef.current === filterKey) return;

    const requestId = (kpiRequestIdRef.current += 1);
    kpiFetchAbortRef.current?.abort();
    const controller = new AbortController();
    kpiFetchAbortRef.current = controller;

    setOpenInstallationKpiLoading(true);
    const { openInstallationBucket: _bucket, ...kpiFilters } = appliedFilters;
    try {
      const res = await axios.get(
        "/api/service-before-installation/open-installation/kpi",
        {
          params: { ...kpiFilters, openInstallationBucket: "" },
          signal: controller.signal,
          timeout: 12_000,
        },
      );
      if (requestId !== kpiRequestIdRef.current) return;
      if (res.data?.success && res.data.openInstallationBreakdown) {
        const br = res.data.openInstallationBreakdown;
        kpiFetchedKeyRef.current = filterKey;
        setOpenInstallationBreakdown((prev) => {
          const next = {
            ...br,
            installation_planned: Math.max(
              Number(prev.installation_planned) || 0,
              Number(br.installation_planned) || 0,
            ),
            feedback_collected:
              Number(prev.feedback_collected) > 0
                ? Number(prev.feedback_collected)
                : Number(br.feedback_collected || 0),
          };
          openInstallationBreakdownRef.current = next;
          return next;
        });
        const activeBucket = String(appliedFilters.openInstallationBucket || "").trim();
        if (!(listTotalRef.current > 0) && activeBucket !== "feedback_collected") {
          applyListTotalRef.current?.(
            openInstallationBucketRecordCount(activeBucket, br),
          );
        }
      }
    } catch (e) {
      if (e?.code !== "ERR_CANCELED" && requestId === kpiRequestIdRef.current) {
        console.error(e);
      }
    } finally {
      if (requestId === kpiRequestIdRef.current) {
        setOpenInstallationKpiLoading(false);
      }
    }

    // Feedback only — planned is already in cards breakdown.
    if (requestId === kpiRequestIdRef.current) {
      window.setTimeout(() => {
        if (requestId !== kpiRequestIdRef.current) return;
        void fetchFeedbackCollectedKpiCount(controller.signal);
      }, 200);
    }
  }, [
    segment,
    openInstallationKpiFilterKey,
    appliedFilters,
    fetchFeedbackCollectedKpiCount,
  ]);

  const enrichOpenInstallationServiceColumns = useCallback(async (baseRows, listRequestId) => {
    if (!baseRows?.length) return;
    const enrichId = (servicesEnrichRequestIdRef.current += 1);
    try {
      const res = await axios.post(
        "/api/service-before-installation/open-installation/services-enrich",
        { rows: baseRows },
        { timeout: 25_000 },
      );
      if (
        res.data?.success &&
        enrichId === servicesEnrichRequestIdRef.current &&
        listRequestId === rowsRequestIdRef.current
      ) {
        const patchByQuote = new Map(
          (res.data.data || []).map((r) => [
            String(r.quote_number || "").trim().toLowerCase(),
            r,
          ]),
        );
        if (patchByQuote.size) {
          setRows((prev) =>
            prev.map((row) => {
              const hit = patchByQuote.get(String(row.quote_number || "").trim().toLowerCase());
              return hit ? { ...row, ...hit } : row;
            }),
          );
        }
      }
    } catch (e) {
      if (e?.code !== "ERR_CANCELED") console.error(e);
    }
  }, []);

  const fetchOpenInstallationCount = useCallback(async () => {
    if (segment !== "open-installation" && segment !== "overdue-delayed-installation") {
      return;
    }
    countFetchAbortRef.current?.abort();
    const controller = new AbortController();
    countFetchAbortRef.current = controller;
    const bucket = String(appliedFilters.openInstallationBucket || "").trim();
    const useGoogleFeedbackApi =
      segment === "open-installation" && bucket === "feedback_collected";

    setCountLoading(true);
    if (useGoogleFeedbackApi) setFeedbackCollectedKpiLoading(true);
    try {
      const res = await axios.get(
        useGoogleFeedbackApi
          ? "/api/service-before-installation/google-feedback"
          : segment === "open-installation"
            ? "/api/service-before-installation/open-installation/count"
            : `/api/service-before-installation/${segment}`,
        {
          params: {
            ...appliedFilters,
            ...(useGoogleFeedbackApi || segment !== "open-installation"
              ? { countOnly: "1" }
              : {}),
            limit: pageSize,
            skip: page * pageSize,
          },
          signal: controller.signal,
          timeout: 15_000,
        },
      );
      if (res.data?.success) {
        const total = Number(
          res.data.pagination?.total ?? res.data.feedback_collected ?? 0,
        );
        applyListTotal(total);
        if (useGoogleFeedbackApi) patchFeedbackCollected(total);
      }
    } catch (e) {
      if (e?.code === "ERR_CANCELED") return;
      console.error(e);
      if (useGoogleFeedbackApi && !(listTotalRef.current > 0)) {
        const fallback = Math.max(pageSize, page * pageSize + pageSize);
        applyListTotal(fallback);
      }
    } finally {
      if (!controller.signal.aborted) {
        setCountLoading(false);
        if (useGoogleFeedbackApi) setFeedbackCollectedKpiLoading(false);
      }
    }
  }, [segment, appliedFilters, page, pageSize, applyListTotal, patchFeedbackCollected]);

  const fetchRows = useCallback(async () => {
    const requestId = (rowsRequestIdRef.current += 1);
    rowsFetchAbortRef.current?.abort();
    const controller = new AbortController();
    rowsFetchAbortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    const isOpenInstallationList =
      segment === "open-installation" || segment === "overdue-delayed-installation";
    const activeBucket = String(appliedFilters.openInstallationBucket || "").trim();
    const knownTotal =
      listTotalRef.current ||
      (isOpenInstallationList
        ? openInstallationBucketRecordCount(activeBucket, openInstallationBreakdownRef.current)
        : 0);

    // Open Installation: separate APIs — cards (/kpi) vs table (/list).
    if (isOpenInstallationList) {
      const useGoogleFeedbackApi =
        segment === "open-installation" && activeBucket === "feedback_collected";
      if (segment === "open-installation" && !useGoogleFeedbackApi) {
        if (kpiFetchedKeyRef.current !== openInstallationKpiFilterKey) {
          void fetchOpenInstallationKpis();
        }
      }
      try {
        const listUrl = useGoogleFeedbackApi
          ? "/api/service-before-installation/google-feedback"
          : segment === "open-installation"
            ? "/api/service-before-installation/open-installation/list"
            : `/api/service-before-installation/${segment}`;
        const res = await axios.get(listUrl, {
          params: {
            ...appliedFilters,
            limit: pageSize,
            skip: page * pageSize,
            includeFilterOptions: "0",
            skipTotal: "1",
            includeOpenInstallationBreakdown: "0",
            deferServiceEnrich: "1",
          },
          signal,
          timeout: 12_000,
        });
        if (res.data?.success && requestId === rowsRequestIdRef.current) {
          const data = res.data.data || [];
          const pag = res.data.pagination || {};
          const hasMoreFlag = Boolean(pag.hasMore) || data.length >= pageSize;
          const total = knownTotal > 0 ? knownTotal : listTotalRef.current || 0;
          setRows(data);
          setPagination({
            total,
            hasMore: total > 0 ? page * pageSize + data.length < total : hasMoreFlag,
          });
          if (useGoogleFeedbackApi && !hasMoreFlag) {
            const exact = page * pageSize + data.length;
            applyListTotal(exact, data.length);
            patchFeedbackCollected(exact);
          }
          // Enrich after paint (serial/model/engineer) — never blocks first rows.
          if (!useGoogleFeedbackApi && data.length) {
            window.setTimeout(() => {
              if (requestId !== rowsRequestIdRef.current) return;
              void enrichOpenInstallationServiceColumns(data, requestId);
            }, 0);
          }
        }
      } catch (e) {
        if (e?.code === "ERR_CANCELED") return;
        console.error(e);
      } finally {
        if (!signal.aborted && requestId === rowsRequestIdRef.current) {
          setLoading(false);
          setApplyingFilters(false);
        }
      }

      if (signal.aborted || requestId !== rowsRequestIdRef.current) return;

      // Prefer card totals for pagination; only hit /count when still unknown.
      const fromCards = openInstallationBucketRecordCount(
        activeBucket,
        openInstallationBreakdownRef.current,
      );
      if (fromCards > 0) {
        applyListTotal(fromCards);
        setCountLoading(false);
      } else if (useGoogleFeedbackApi || !(listTotalRef.current > 0)) {
        window.setTimeout(() => {
          if (requestId !== rowsRequestIdRef.current) return;
          void fetchOpenInstallationCount();
        }, 200);
      } else {
        setCountLoading(false);
      }
      return;
    }

    try {
      const res = await axios.get(`/api/service-before-installation/${segment}`, {
        params: {
          ...appliedFilters,
          limit: pageSize,
          skip: page * pageSize,
          includeFilterOptions: "0",
          deferTotal: "0",
          skipTotal: "0",
          includeOpenInstallationBreakdown: "0",
        },
        signal,
        timeout: 20_000,
      });
      if (res.data?.success) {
        const data = res.data.data || [];
        const pag = res.data.pagination || { total: 0, hasMore: false };
        const total = Number(pag.total) || 0;
        if (total > 0) listTotalRef.current = total;
        setRows(data);
        setPagination({
          total,
          hasMore: Boolean(pag.hasMore) || page * pageSize + data.length < total,
        });
        if (res.data.installationBreakdown) {
          setInstallationBreakdown(res.data.installationBreakdown);
        }
        setCountLoading(false);
      }
    } catch (e) {
      if (e?.code === "ERR_CANCELED") return;
      console.error(e);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [
    segment,
    appliedFilters,
    page,
    pageSize,
    openInstallationKpiFilterKey,
    fetchOpenInstallationCount,
    fetchOpenInstallationKpis,
    fetchFeedbackCollectedKpiCount,
    patchFeedbackCollected,
    enrichOpenInstallationServiceColumns,
  ]);

  const openInstallationKpiStripLoading = useMemo(() => {
    if (!openInstallationKpiLoading) return false;
    const b = openInstallationBreakdown;
    const hasAny =
      Number(b.delivered_installation_pending) > 0 ||
      Number(b.delivery_pending_after_dispatch) > 0 ||
      Number(b.completed_installation) > 0 ||
      Number(b.installation_planned) > 0 ||
      Number(b.total) > 0;
    return !hasAny;
  }, [openInstallationKpiLoading, openInstallationBreakdown]);

  const fetchTableFilterOptions = useCallback(async () => {
    if (
      segment !== "total-registered" &&
      segment !== "open-installation" &&
      segment !== "overdue-delayed-installation"
    ) {
      return;
    }
    // Open Installation filters API uses small rep_list / third-party tables only.
    const key = segment === "overdue-delayed-installation" ? "open-installation" : segment;
    if (tableFilterOptionsFetchKeyRef.current === key) return;
    tableFilterOptionsFetchKeyRef.current = key;
    try {
      const res = await axios.get("/api/service-before-installation/filters", {
        params: { segment },
        timeout: 12_000,
      });
      if (res.data?.success && res.data.filterOptions) {
        setTableFilterOptions(res.data.filterOptions);
      }
    } catch (e) {
      console.error(e);
      tableFilterOptionsFetchKeyRef.current = null;
    }
  }, [segment]);

  const requestTableFilterOptions = useCallback(() => {
    void fetchTableFilterOptions();
  }, [fetchTableFilterOptions]);

  const mergedTableFilterOptions = useMemo(
    () => mergeTeamFilterOptions(tableFilterOptions, teamFilterOptionsFromRows(rows)),
    [tableFilterOptions, rows],
  );

  useEffect(() => {
    listTotalRef.current = 0;
  }, [segment]);

  useEffect(() => {
    fetchRows();
    return () => rowsFetchAbortRef.current?.abort();
  }, [fetchRows]);

  const totalPages = pagination.totalPending
    ? Math.max(1, page + (pagination.hasMore ? 2 : 1))
    : Math.max(1, Math.ceil((pagination.total || 0) / pageSize));
  const pageWindow = useMemo(() => buildPageWindow(page, totalPages), [page, totalPages]);
  const colSpan = colSpanForSegment(segment);

  const handleOpenInstallationRowPatch = useCallback((patchedRow) => {
    const key = patchedRow.order_id ?? patchedRow.id;
    if (key == null) return;
    setRows((prev) =>
      prev.map((r) => ((r.order_id ?? r.id) === key ? { ...r, ...patchedRow } : r)),
    );
  }, []);
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

        <DetailSegmentHeader meta={headerMeta} segment={segment} />

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
            loading={openInstallationKpiStripLoading}
            noFeedbackLoading={feedbackCollectedKpiLoading}
            onCardSelect={(openInstallationBucket) => {
              setPage(0);
              setLoading(true);
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
          loading={applyingFilters}
          onApply={() => {
            setApplyingFilters(true);
            setLoading(true);
            setPage(0);
            listTotalRef.current = 0;
            setRows([]);
            setPagination({ total: 0, hasMore: false });
            setTableFilterOptions(null);
            tableFilterOptionsFetchKeyRef.current = null;
            kpiFetchedKeyRef.current = "";
            setOpenInstallationKpiLoading(true);
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
              {loading && rows.length === 0
                ? "Loading records…"
                : pagination.total > 0
                  ? `${formatNum(pagination.total)} Records`
                  : countLoading
                    ? `${formatNum(rows.length)}+ Records`
                    : `${formatNum(rows.length)} Records`}
              {loading || countLoading ? (
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
                    userRole={userRole}
                    onOpenInstallationRowPatch={handleOpenInstallationRowPatch}
                    ProductFollowupIcons={
                      segment === "open-installation" ||
                      segment === "overdue-delayed-installation"
                        ? ProductFollowupIcons
                        : null
                    }
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
      {followupModals}
    </div>
  );
}