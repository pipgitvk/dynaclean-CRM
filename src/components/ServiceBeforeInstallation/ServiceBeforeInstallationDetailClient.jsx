"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Toaster } from "react-hot-toast";
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
  X,
  History,
} from "lucide-react";
import { formatSbiNum } from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";
import {
  displayComplaintDateForServiceRecord,
  displayRegDateForServiceRecord,
} from "@/lib/serviceRecordComplaintDisplay";
import {
  getActiveAmcKpiMeta,
  getActiveWarrantyKpiMeta,
  getSegmentMeta,
  openCompletionsTableCountApi,
  openCompletionsTableListApi,
  OPEN_INSTALLATION_GOOGLE_FEEDBACK_API,
  openInstallationTableCountApi,
  openInstallationTableListApi,
} from "@/lib/serviceBeforeInstallationHub";
import { openCompletionsBucketRecordCount } from "@/lib/openCompletionsKpiSql";
import {
  isTempSerialNumber,
  openInstallationBucketRecordCount,
} from "@/lib/openInstallationKpiSql";
import { activeAmcBucketRecordCount } from "@/lib/activeAmcKpiSql";
import { activeWarrantyBucketRecordCount } from "@/lib/activeWarrantyKpiSql";
import {
  defaultSbiSelectFilters,
  normalizeAmcBucket,
  normalizeOpenCompletionsBucket,
  normalizeOpenInstallationBucket,
  normalizeWarrantyBucket,
} from "@/lib/serviceBeforeInstallationFilters";
import ServiceBeforeInstallationFilters from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationFilters";
import ServiceBeforeInstallationOpenInstallationKpiStrip from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationOpenInstallationKpiStrip";
import ServiceBeforeInstallationOpenCompletionsKpiSection from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationOpenCompletionsKpiSection";
import ServiceBeforeInstallationActiveWarrantyKpiStrip from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationActiveWarrantyKpiStrip";
import ServiceBeforeInstallationActiveAmcKpiStrip from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationActiveAmcKpiStrip";
import {
  OpenCompletionsComplaintRows,
  OpenCompletionsComplaintTableHead,
} from "@/components/ServiceBeforeInstallation/OpenCompletionsComplaintTable";
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
import { OpenInstallationServiceReportButtons } from "@/components/installation/OpenInstallationReportButton";
import OpenInstallationServicesModal from "@/components/installation/OpenInstallationServicesModal";
import PaymentPendingOrderDetailsModal from "@/components/reports/PaymentPendingOrderDetailsModal";
import { parseOpenInstallationDispatchItems } from "@/lib/openInstallationDispatchItems";
import { listOpenInstallationSerialNumbers } from "@/lib/openInstallationServiceLineItems";
import {
  openInstallationViewMoreBtnClass,
  openInstallationViewMoreBtnClassCompact,
} from "@/components/installation/openInstallationViewMoreBtnClass";
import { useWarrantyProductFollowup } from "@/components/warranty/WarrantyProductFollowupControls";
import { formatFollowedAtDisplay } from "@/lib/enrichSbiLastFollowup";
import {
  WarrantyComplaintModal,
  WarrantyProductEditModal,
  WarrantyInstallRequestModal,
} from "@/components/warranty/WarrantyProductServiceModals";
import GoogleFeedbackProofCell from "@/components/services/GoogleFeedbackProofCell";
import { canExportServiceBeforeInstallationCsv } from "@/lib/serviceBeforeInstallationRoles";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const OPEN_INSTALLATION_BUCKET_STORAGE_KEY = "sbi.openInstallationBucket";
const OPEN_COMPLETIONS_BUCKET_STORAGE_KEY = "sbi.openCompletionsBucket";
const WARRANTY_BUCKET_STORAGE_KEY = "sbi.warrantyBucket";
const AMC_BUCKET_STORAGE_KEY = "sbi.amcBucket";

function readStoredOpenInstallationBucket() {
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("openInstallationBucket");
    const fromStore = window.localStorage.getItem(OPEN_INSTALLATION_BUCKET_STORAGE_KEY);
    return normalizeOpenInstallationBucket(fromUrl || fromStore);
  } catch {
    return "";
  }
}

function persistOpenInstallationBucket(bucket) {
  const v = normalizeOpenInstallationBucket(bucket) || "delivered_pending";
  if (typeof window === "undefined") return v;
  try {
    window.localStorage.setItem(OPEN_INSTALLATION_BUCKET_STORAGE_KEY, v);
    const url = new URL(window.location.href);
    if (url.searchParams.get("openInstallationBucket") !== v) {
      url.searchParams.set("openInstallationBucket", v);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  } catch {
    // ignore storage / history failures
  }
  return v;
}

function stickyOpenInstallationBucket(preferred) {
  return (
    normalizeOpenInstallationBucket(preferred) ||
    readStoredOpenInstallationBucket() ||
    "delivered_pending"
  );
}

function readStoredOpenCompletionsBucket() {
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("openCompletionsBucket");
    const fromStore = window.localStorage.getItem(OPEN_COMPLETIONS_BUCKET_STORAGE_KEY);
    return normalizeOpenCompletionsBucket(fromUrl || fromStore);
  } catch {
    return "";
  }
}

function persistOpenCompletionsBucket(bucket) {
  const v = normalizeOpenCompletionsBucket(bucket) || "total_registered";
  if (typeof window === "undefined") return v;
  try {
    window.localStorage.setItem(OPEN_COMPLETIONS_BUCKET_STORAGE_KEY, v);
    const url = new URL(window.location.href);
    if (url.searchParams.get("openCompletionsBucket") !== v) {
      url.searchParams.set("openCompletionsBucket", v);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  } catch {
    // ignore
  }
  return v;
}

function stickyOpenCompletionsBucket(preferred) {
  return (
    normalizeOpenCompletionsBucket(preferred) ||
    readStoredOpenCompletionsBucket() ||
    "total_registered"
  );
}

function readStoredWarrantyBucket() {
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("warrantyBucket");
    const fromStore = window.localStorage.getItem(WARRANTY_BUCKET_STORAGE_KEY);
    return normalizeWarrantyBucket(fromUrl || fromStore);
  } catch {
    return "";
  }
}

function persistWarrantyBucket(bucket) {
  const v = normalizeWarrantyBucket(bucket) || "active";
  if (typeof window === "undefined") return v;
  try {
    window.localStorage.setItem(WARRANTY_BUCKET_STORAGE_KEY, v);
    const url = new URL(window.location.href);
    if (url.searchParams.get("warrantyBucket") !== v) {
      url.searchParams.set("warrantyBucket", v);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  } catch {
    // ignore
  }
  return v;
}

function stickyWarrantyBucket(preferred) {
  return normalizeWarrantyBucket(preferred) || readStoredWarrantyBucket() || "active";
}

function readStoredAmcBucket() {
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("amcBucket");
    const fromStore = window.localStorage.getItem(AMC_BUCKET_STORAGE_KEY);
    return normalizeAmcBucket(fromUrl || fromStore);
  } catch {
    return "";
  }
}

function persistAmcBucket(bucket) {
  const v = normalizeAmcBucket(bucket) || "active";
  if (typeof window === "undefined") return v;
  try {
    window.localStorage.setItem(AMC_BUCKET_STORAGE_KEY, v);
    const url = new URL(window.location.href);
    if (url.searchParams.get("amcBucket") !== v) {
      url.searchParams.set("amcBucket", v);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  } catch {
    // ignore
  }
  return v;
}

function stickyAmcBucket(preferred) {
  return normalizeAmcBucket(preferred) || readStoredAmcBucket() || "active";
}

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

function initialSbiFiltersForSegment(segment, stickyBucket = "") {
  const base = defaultSbiSelectFilters();
  if (segment === "open-installation") {
    return {
      ...base,
      openInstallationBucket: stickyOpenInstallationBucket(stickyBucket),
      itemType: "products",
    };
  }
  if (segment === "open-completions") {
    return {
      ...base,
      openCompletionsBucket: stickyOpenCompletionsBucket(stickyBucket),
    };
  }
  if (segment === "active-warranty") {
    return {
      ...base,
      warrantyBucket: stickyWarrantyBucket(stickyBucket),
    };
  }
  if (segment === "active-amc") {
    return {
      ...base,
      amcBucket: stickyAmcBucket(stickyBucket),
    };
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

function LastFollowupTableCell({ value, notes, className = "px-4 py-3.5" }) {
  const formatted = formatFollowedAtDisplay(value);
  const remark = notes != null && String(notes).trim() !== "" ? String(notes).trim() : "";
  if (!formatted && !remark) {
    return <td className={`min-w-[10.5rem] text-sm text-slate-400 ${className}`}>—</td>;
  }
  return (
    <td className={`min-w-[10.5rem] max-w-[14rem] text-sm align-top ${className}`}>
      {formatted ? (
        <div className="whitespace-nowrap">
          <span className="text-slate-500">Last Followed:</span>{" "}
          <span className="font-medium tabular-nums text-slate-800">{formatted}</span>
        </div>
      ) : (
        <span className="text-slate-400">—</span>
      )}
      {remark ? (
        <div
          className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-500"
          title={remark}
        >
          {remark}
        </div>
      ) : null}
    </td>
  );
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

function InvoiceDetailBlock({ row, userRole = "" }) {
  const [orderModalId, setOrderModalId] = useState(null);
  const orderId = String(row.order_id || "").trim();
  const hasAny =
    row.invoice_number || row.invoice_date || row.invoice_file || orderId;
  if (!hasAny) return <span className="text-slate-400">—</span>;
  const invoiceFile = row.invoice_file ? String(row.invoice_file).trim() : "";
  return (
    <>
      <div className="min-w-[9rem] max-w-[14rem] space-y-0.5 text-xs">
        <DetailField label="#" value={row.invoice_number} />
        <DetailField label="Date" value={formatDate(row.invoice_date)} />
        {orderId ? (
          <OrderIdOpenButton
            orderId={orderId}
            onOpen={() => setOrderModalId(orderId)}
          />
        ) : null}
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
      <PaymentPendingOrderDetailsModal
        open={Boolean(orderModalId)}
        orderId={orderModalId}
        userRole={userRole}
        onClose={() => setOrderModalId(null)}
      />
    </>
  );
}

function OrderIdOpenButton({ orderId, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-left font-semibold text-violet-800 hover:bg-violet-100 hover:underline"
      title="View order details"
    >
      <Eye className="h-3 w-3 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-slate-500">Order</span> {orderId}
      </span>
    </button>
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
      "Inv | Ord | Quote | Ser | S/N",
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
      "Inv | Ord | Quote | Ser | S/N",
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
    "active-warranty": [
      "Serial",
      "Customer",
      "State",
      "Order / Sales",
      "Model",
      "Contact",
      "Installation",
      "Warranty End",
      "Installed Address",
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
          row.quote_number,
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
    if (segment === "active-warranty") {
      const orderId = String(row.order_id || "").trim();
      const sales = salesPersonLabel(row);
      return [
        row.serial_number,
        row.customer_name,
        row.state,
        [orderId ? `Order: ${orderId}` : "", sales ? `Sales: ${sales}` : ""].filter(Boolean).join(" · "),
        row.model,
        row.contact,
        formatDate(row.installation_date),
        formatDate(row.warranty_end_date),
        row.installed_address,
      ];
    }
    if (segment === "total-registered") {
      const orderId = String(row.order_id || "").trim();
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
        [
          row.invoice_number,
          formatDate(row.invoice_date),
          orderId ? `Order: ${orderId}` : "",
        ]
          .filter(Boolean)
          .join(" "),
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

function DetailSegmentHeader({ meta, segment, trailing = null }) {
  const Icon = SEGMENT_ICONS[segment] || Package;
  return (
    <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-5 shadow-[0_4px_20px_-10px_rgba(15,23,42,0.1)] sm:flex-row sm:items-stretch sm:gap-5 sm:px-6 sm:py-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 p-3 text-white shadow-md shadow-violet-500/20">
          <Icon className="h-6 w-6" strokeWidth={2.1} aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{meta.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500 sm:text-base">{meta.subtitle}</p>
        </div>
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center sm:ml-auto sm:pl-2">{trailing}</div>
      ) : null}
    </header>
  );
}

function ActiveWarrantyAllProductsSummaryCard({ totals, loading }) {
  const active = Number(totals?.active_warranty) || 0;
  const expired = Number(totals?.expired_warranty) || 0;
  const total = active + expired;
  const settled = totals?.active_warranty != null && totals?.expired_warranty != null;
  const waiting = Boolean(loading) && !settled;
  const activePct = total > 0 ? Math.round((active / total) * 1000) / 10 : 0;
  const expiredPct = total > 0 ? Math.max(0, 100 - activePct) : 0;

  return (
    <section
      aria-labelledby="aw-all-products-heading"
      className="relative w-full overflow-hidden rounded-2xl border border-violet-200/75 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/50 px-4 py-3.5 shadow-[0_10px_32px_-14px_rgba(124,58,237,0.45)] ring-1 ring-inset ring-white/80 sm:w-[min(100%,18rem)]"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-violet-400/20 blur-2xl"
        aria-hidden
      />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-violet-500/[0.06] to-transparent" aria-hidden />

      <div className="relative flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 text-white shadow-lg shadow-violet-500/30">
          <Package className="h-5 w-5" strokeWidth={2.15} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p
            id="aw-all-products-heading"
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700/90"
          >
            All products
          </p>
          {waiting ? (
            <div className="mt-2.5 space-y-2" aria-hidden>
              <div className="h-9 w-20 animate-pulse rounded-lg bg-violet-200/40" />
              <div className="h-1.5 w-full animate-pulse rounded-full bg-slate-200/80" />
            </div>
          ) : (
            <p className="mt-1 text-[1.75rem] font-extrabold leading-none tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {formatSbiNum(total)}
            </p>
          )}
        </div>
      </div>

      {settled && !waiting ? (
        <div className="relative mt-3.5 space-y-2">
          <div
            className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200/70 shadow-inner"
            role="img"
            aria-label={`Active ${activePct} percent, expired ${expiredPct} percent`}
          >
            {active > 0 ? (
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width] duration-500 ease-out"
                style={{ width: `${activePct}%` }}
              />
            ) : null}
            {expired > 0 ? (
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-red-500 transition-[width] duration-500 ease-out"
                style={{ width: `${expiredPct}%` }}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]" />
              Active {formatSbiNum(active)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/90 bg-rose-50/95 px-2.5 py-1 text-[11px] font-semibold text-rose-800 shadow-sm">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(244,63,94,0.2)]" />
              Expired {formatSbiNum(expired)}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function registeredProductHistoryPayload(row) {
  return {
    machine_id: row.id,
    serial_number: row.serial_number,
    model: row.model,
    contact: row.contact,
    email: row.email,
    includeCustomerFollowups: true,
  };
}

function RegisteredProductServiceHistoryModal({
  open,
  serialNumber,
  dashboardBase,
  onClose,
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !serialNumber) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setRecords([]);
      try {
        const res = await fetch(
          `/api/service-records?serial_number=${encodeURIComponent(serialNumber)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load service history");
        if (!cancelled) {
          setRecords(Array.isArray(data.records) ? data.records : []);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load service history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, serialNumber]);

  if (!open) return null;

  const fullPageHref = serialNumber
    ? `/${dashboardBase}/warranty/service-records/${encodeURIComponent(serialNumber)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-violet-600" aria-hidden />
              Service History
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Serial: <span className="font-semibold text-slate-800">{serialNumber}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
              Loading service records…
            </div>
          ) : error ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : records.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No service records for this serial.
            </p>
          ) : (
            <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-left text-xs font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Service ID</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Reg. Date</th>
                  <th className="px-3 py-2">Complaint Date</th>
                  <th className="px-3 py-2">Summary</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Completed</th>
                  <th className="px-3 py-2 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((row) => (
                  <tr key={row.service_id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-violet-800">
                      {row.service_id}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.service_type || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {displayRegDateForServiceRecord(row) || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {displayComplaintDateForServiceRecord(row) || "—"}
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={row.complaint_summary}>
                      {row.complaint_summary || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium">{row.status || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {row.completed_date || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/${dashboardBase}/warranty/completion-report/${row.service_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-violet-700 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3">
          {fullPageHref ? (
            <Link
              href={fullPageHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-violet-700 hover:underline"
            >
              Open full service records page
            </Link>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function RegisteredProductActionCell({
  row,
  onMachineHistory,
  onWarrantyAction,
  onServiceHistory,
}) {
  const serial = String(row.serial_number || "").trim();
  if (!serial) return <span className="text-slate-300">—</span>;

  const installed = Boolean(String(row.installed_address || "").trim());
  const btn =
    "block w-full min-w-[6.5rem] rounded-md px-2.5 py-1.5 text-center text-[11px] font-semibold text-white shadow-sm transition-colors";

  const runAction = (type) => {
    if (type === "history") {
      onMachineHistory?.(registeredProductHistoryPayload(row));
      return;
    }
    onWarrantyAction?.(type, serial);
  };

  return (
    <div className="flex flex-col gap-1">
      {!installed ? (
        <button
          type="button"
          className={`${btn} bg-green-700 hover:bg-green-800`}
          onClick={() => runAction("install")}
        >
          Install
        </button>
      ) : null}
      <button
        type="button"
        className={`${btn} bg-red-700 hover:bg-red-800`}
        onClick={() => runAction("complaint")}
      >
        Complaint
      </button>
      <button
        type="button"
        className={`${btn} bg-amber-600 hover:bg-amber-700`}
        onClick={() => runAction("edit")}
      >
        Edit
      </button>
      <button
        type="button"
        className={`${btn} bg-slate-700 hover:bg-slate-800`}
        onClick={() => onServiceHistory?.(serial)}
      >
        Service History
      </button>
      <button
        type="button"
        className={`${btn} bg-indigo-700 hover:bg-indigo-800`}
        onClick={() => runAction("history")}
      >
        Follow-up History
      </button>
    </div>
  );
}

function WarrantyProductRows({
  rows,
  dashboardBase,
  page,
  pageSize,
  segment,
  userRole = "",
  onMachineHistory,
  onWarrantyAction,
  onServiceHistory,
}) {
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
    const warrantyRecordsLayout = segment === "active-warranty";
    if (!detailLayout) {
      const orderId = String(row.order_id || "").trim();
      const salesName = salesPersonLabel(row);
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
          {warrantyRecordsLayout ? (
            <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700">
              {row.state?.trim() || "—"}
            </td>
          ) : null}
          {warrantyRecordsLayout ? (
            <td className="px-4 py-3.5 text-sm text-slate-800">
              {!orderId && !salesName ? (
                "—"
              ) : (
                <div className="min-w-[6.5rem] space-y-1">
                  <div className="leading-snug">
                    <span className="text-xs font-semibold text-slate-500">Order</span>
                    <span className="mx-1 text-slate-300">·</span>
                    {orderId ? (
                      <Link
                        href={`/${dashboardBase}/order/${encodeURIComponent(orderId)}`}
                        className="font-semibold text-violet-700 hover:underline"
                      >
                        {orderId}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                  <div className="leading-snug">
                    <span className="text-xs font-semibold text-slate-500">Sales</span>
                    <span className="mx-1 text-slate-300">·</span>
                    <span className="font-medium text-slate-900">{salesName || "—"}</span>
                  </div>
                </div>
              )}
            </td>
          ) : null}
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
          <LastFollowupTableCell value={row.last_followup_at} notes={row.last_followup_notes} />
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
          <InvoiceDetailBlock row={row} userRole={userRole} />
        </td>
        <td className="px-4 py-3.5 align-top">
          <SalesServiceTeamBlock row={row} />
        </td>
        <LastFollowupTableCell
          value={row.last_followup_at}
          notes={row.last_followup_notes}
          className="px-4 py-3.5 align-top"
        />
        <td className="px-4 py-3.5 text-right align-top">
          <RegisteredProductActionCell
            row={row}
            onMachineHistory={onMachineHistory}
            onWarrantyAction={onWarrantyAction}
            onServiceHistory={onServiceHistory}
          />
        </td>
      </tr>
    );
  });
}

function formatComplaintStatusLabel(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "PENDING FOR SPARES") return "Pending by Us";
  return status || "—";
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
        <td className="px-4 py-3.5">
          {variant === "complaint" ? formatComplaintStatusLabel(row.status) : row.status || "—"}
        </td>
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
    return (
      <OpenInstallationServiceReportButtons row={row} dashboardBase={dashboardBase} />
    );
  }

  const hasMore = serviceIds.length > OPEN_INSTALLATION_MODEL_PREVIEW;
  const visibleIds = hasMore
    ? serviceIds.slice(0, OPEN_INSTALLATION_MODEL_PREVIEW)
    : serviceIds;
  const hiddenCount = serviceIds.length - OPEN_INSTALLATION_MODEL_PREVIEW;

  const renderReportButtons = (ids) =>
    ids.map((id) => (
      <OpenInstallationServiceReportButtons
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

function openInstallationRegisterHref(dashboardBase, row) {
  const orderId = String(row?.order_id || "").trim();
  if (!dashboardBase || !orderId) return "";
  return `/${dashboardBase}/warranty?order_id=${encodeURIComponent(orderId)}&mode=order`;
}

function OpenInstallationRegistrationCell({ row, dashboardBase }) {
  const registered = Number(row.warranty_registered) === 1;
  const orderId = String(row.order_id || "").trim();
  const productsHref =
    orderId &&
    `/${dashboardBase}/warranty/products?search=${encodeURIComponent(orderId)}`;
  const registerHref = openInstallationRegisterHref(dashboardBase, row);
  return (
    <div className="min-w-[8rem] space-y-1.5">
      {registered ? <RegistrationDateByCell row={row} /> : null}
      <OpenInstallationRegistrationBadge row={row} dashboardBase={dashboardBase} />
      {!registered && registerHref ? (
        <Link
          href={registerHref}
          className="inline-flex rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
        >
          Register Now
        </Link>
      ) : null}
      {registered && productsHref ? (
        <Link
          href={productsHref}
          className="inline-flex rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
        >
          Registered Products
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
          <GoogleFeedbackProofCell record={row} showNullState />
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
        <LastFollowupTableCell
          value={row.last_followup_at}
          notes={row.last_followup_notes}
          className="px-4 py-3.5 align-top"
        />
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
        <LastFollowupTableCell value={row.last_followup_at} notes={row.last_followup_notes} />
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
        <th className={th}>Inv | Ord | Quote | Ser | S/N</th>
        <th className={th}>Company / State · Delivery</th>
        <th className={th}>Contact Person · Contact No</th>
        <th className={th}>Sales Person</th>
        <th className={th}>Assigned By / Completed by</th>
        <th className={th}>Model</th>
        <th className={th}>Order / Delivery</th>
        <th className={th}>Regst. / Registration</th>
        <th className={th}>Google Feedback</th>
        <th className={th}>Status</th>
        <th className={th}>Last Followed</th>
        <th className={th}>Action</th>
      </tr>
    );
  }
  if (segment === "open-completions") {
    return <OpenCompletionsComplaintTableHead />;
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
        <th className={th}>Last Followed</th>
      </tr>
    );
  }
  if (segment === "active-warranty") {
    return (
      <tr>
        <th className={th}>#</th>
        <th className={th}>Serial</th>
        <th className={th}>Customer</th>
        <th className={th}>State</th>
        <th className={th}>Order / Sales</th>
        <th className={th}>Model</th>
        <th className={th}>Contact</th>
        <th className={th}>Installation</th>
        <th className={th}>Warranty End</th>
        <th className={th}>Installed Address</th>
        <th className={th}>Last Followed</th>
        <th className={`${th} text-right`}>Actions</th>
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
        <th className={th}>Last Followed</th>
        <th className={`${th} text-right min-w-[7rem]`}>Action</th>
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
      <th className={th}>Last Followed</th>
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
  onOpenCompletionsRowPatch,
  onMachineFollowUp,
  onMachineHistory,
  onWarrantyAction,
  onServiceHistory,
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
      <OpenCompletionsComplaintRows
        rows={rows}
        dashboardBase={dashboardBase}
        page={page}
        pageSize={pageSize}
        userRole={userRole}
        formatDate={formatDate}
        ProductFollowupIcons={ProductFollowupIcons}
        onMachineFollowUp={onMachineFollowUp}
        onMachineHistory={onMachineHistory}
        onRowUpdated={onOpenCompletionsRowPatch}
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
      userRole={userRole}
      onMachineHistory={segment === "total-registered" ? onMachineHistory : undefined}
      onWarrantyAction={segment === "total-registered" ? onWarrantyAction : undefined}
      onServiceHistory={segment === "total-registered" ? onServiceHistory : undefined}
    />
  );
}

function colSpanForSegment(segment) {
  if (segment === "total-registered") return 12;
  if (segment === "active-warranty") return 12;
  if (isWarrantyProductSegment(segment)) return 10;
  if (segment === "open-completions") return 14;
  if (segment === "open-installation" || segment === "overdue-delayed-installation") return 11;
  if (segment === "active-amc" || segment === "due-amc-expiring") return 8;
  return 10;
}

function tableMinWidthClass(segment) {
  if (segment === "open-installation" || segment === "overdue-delayed-installation") {
    return "min-w-[1380px]";
  }
  if (segment === "open-completions") return "min-w-[1500px]";
  if (segment === "total-registered" || segment === "active-warranty") return "min-w-[1180px]";
  return "min-w-full";
}

/** Top scrollbar synced with table (no label — scrollbar only). */
function SbiRecordsTableScroll({ syncKey = "", children }) {
  const topRef = useRef(null);
  const mainRef = useRef(null);
  const spacerRef = useRef(null);
  const syncLockRef = useRef(false);
  const [showTopBar, setShowTopBar] = useState(true);

  const syncScroll = useCallback((source, target) => {
    if (!source || !target || syncLockRef.current) return;
    syncLockRef.current = true;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => {
      syncLockRef.current = false;
    });
  }, []);

  const measureScroll = useCallback(() => {
    const main = mainRef.current;
    const spacer = spacerRef.current;
    if (!main) return;
    const table = main.querySelector("table");
    const sw = Math.max(table?.scrollWidth || 0, main.scrollWidth, 0);
    const cw = main.clientWidth;
    if (spacer && sw > 0) spacer.style.width = `${sw}px`;
    setShowTopBar(sw > cw + 2);
  }, []);

  useLayoutEffect(() => {
    measureScroll();
    const id = requestAnimationFrame(() => measureScroll());
    return () => cancelAnimationFrame(id);
  }, [measureScroll, syncKey]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;
    const ro = new ResizeObserver(() => measureScroll());
    ro.observe(main);
    const table = main.querySelector("table");
    if (table) ro.observe(table);
    return () => ro.disconnect();
  }, [measureScroll, syncKey]);

  useEffect(() => {
    if (!showTopBar) return;
    const main = mainRef.current;
    const top = topRef.current;
    if (main && top) top.scrollLeft = main.scrollLeft;
  }, [showTopBar, syncKey]);

  return (
    <div className="border-t border-slate-100">
      <div
        ref={topRef}
        onScroll={() => syncScroll(topRef.current, mainRef.current)}
        className={`max-w-full overflow-x-auto overflow-y-hidden ${showTopBar ? "h-3.5" : "hidden"}`}
        aria-label="Scroll table horizontally"
      >
        <div ref={spacerRef} className="h-px shrink-0" aria-hidden />
      </div>
      <div
        ref={mainRef}
        onScroll={() => {
          if (showTopBar) syncScroll(mainRef.current, topRef.current);
        }}
        className="relative max-w-full overflow-x-auto overscroll-x-contain pb-1"
      >
        {children}
      </div>
    </div>
  );
}

export default function ServiceBeforeInstallationDetailClient({
  segment,
  dashboardBase = "admin-dashboard",
  userRole = "",
  initialOpenInstallationBucket = "",
  initialOpenCompletionsBucket = "",
  initialWarrantyBucket = "",
  initialAmcBucket = "",
}) {
  const meta = getSegmentMeta(segment);
  const hubHref = `/${dashboardBase}/service-before-installation`;
  const warrantyHref = `/${dashboardBase}/warranty`;
  const canExportCsv = canExportServiceBeforeInstallationCsv(userRole);
  const { ProductFollowupIcons, followupModals, openMachineFollowUp, openMachineHistory } =
    useWarrantyProductFollowup();
  const [warrantyRowModal, setWarrantyRowModal] = useState(null);
  const [serviceHistorySerial, setServiceHistorySerial] = useState(null);

  const handleWarrantyRowAction = useCallback((type, serial) => {
    setWarrantyRowModal({
      type: String(type || "").trim(),
      serial: String(serial || "").trim(),
    });
  }, []);

  const initialStickyForSegment =
    segment === "open-completions"
      ? initialOpenCompletionsBucket
      : segment === "active-warranty"
        ? initialWarrantyBucket
        : segment === "active-amc"
          ? initialAmcBucket
          : initialOpenInstallationBucket;

  const [draftFilters, setDraftFilters] = useState(() =>
    initialSbiFiltersForSegment(segment, initialStickyForSegment),
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    initialSbiFiltersForSegment(segment, initialStickyForSegment),
  );
  const headerMeta = useMemo(() => {
    if (!meta) return meta;
    const base = {
      ...meta,
      title: meta.detailTitle || meta.title,
    };
    if (segment === "active-warranty") {
      const kpiMeta = getActiveWarrantyKpiMeta(appliedFilters.warrantyBucket || "active");
      return { ...base, subtitle: kpiMeta.subtitle || base.subtitle };
    }
    if (segment === "active-amc") {
      const kpiMeta = getActiveAmcKpiMeta(appliedFilters.amcBucket || "active");
      return { ...base, subtitle: kpiMeta.subtitle || base.subtitle };
    }
    return base;
  }, [meta, segment, appliedFilters.warrantyBucket, appliedFilters.amcBucket]);
  const stickyBucketRef = useRef(
    segment === "open-installation"
      ? stickyOpenInstallationBucket(initialOpenInstallationBucket)
      : segment === "open-completions"
        ? stickyOpenCompletionsBucket(initialOpenCompletionsBucket)
        : segment === "active-warranty"
          ? stickyWarrantyBucket(initialWarrantyBucket)
          : segment === "active-amc"
            ? stickyAmcBucket(initialAmcBucket)
            : "",
  );
  const prevSegmentRef = useRef(segment);
  const [openInstallationBucketReady, setOpenInstallationBucketReady] = useState(
    () =>
      segment !== "open-installation" ||
      Boolean(normalizeOpenInstallationBucket(initialOpenInstallationBucket)),
  );
  const [openCompletionsBucketReady, setOpenCompletionsBucketReady] = useState(
    () =>
      segment !== "open-completions" ||
      Boolean(normalizeOpenCompletionsBucket(initialOpenCompletionsBucket)),
  );
  const [warrantyBucketReady, setWarrantyBucketReady] = useState(
    () => segment !== "active-warranty" || Boolean(normalizeWarrantyBucket(initialWarrantyBucket)),
  );
  const [amcBucketReady, setAmcBucketReady] = useState(
    () => segment !== "active-amc" || Boolean(normalizeAmcBucket(initialAmcBucket)),
  );
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
    delivered_installation_pending: null,
    delivery_pending_after_dispatch: null,
    installation_planned: null,
    completed_installation: null,
    feedback_collected: null,
    total: null,
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
    delivered_installation_pending: null,
    delivery_pending_after_dispatch: null,
    installation_planned: null,
    completed_installation: null,
    feedback_collected: null,
    total: null,
  });
  const [openInstallationKpiLoading, setOpenInstallationKpiLoading] = useState(
    () => segment === "open-installation",
  );
  const [plannedKpiLoading, setPlannedKpiLoading] = useState(
    () => segment === "open-installation",
  );
  const [deliveryPendingKpiLoading, setDeliveryPendingKpiLoading] = useState(
    () => segment === "open-installation",
  );
  const [completedKpiLoading, setCompletedKpiLoading] = useState(
    () => segment === "open-installation",
  );
  const [feedbackCollectedKpiLoading, setFeedbackCollectedKpiLoading] = useState(
    () => segment === "open-installation",
  );
  const [openCompletionsBreakdown, setOpenCompletionsBreakdown] = useState({
    total_complaints_registered: null,
    pending_complaint: null,
    planned_complaint: null,
    completed_complaint: null,
    pending_by_customer: null,
    pending_for_spares: null,
    pending_over_48h_no_plan: null,
    google_feedback: null,
  });
  const [openCompletionsKpiLoading, setOpenCompletionsKpiLoading] = useState(
    () => segment === "open-completions",
  );
  const [activeWarrantyBreakdown, setActiveWarrantyBreakdown] = useState({
    active_warranty: null,
    expiring_30_days: null,
    expired_warranty: null,
  });
  const [activeWarrantyKpiLoading, setActiveWarrantyKpiLoading] = useState(
    () => segment === "active-warranty",
  );
  const activeWarrantyBreakdownRef = useRef({
    active_warranty: null,
    expiring_30_days: null,
    expired_warranty: null,
  });
  const openCompletionsBreakdownRef = useRef({
    total_complaints_registered: null,
    pending_complaint: null,
    planned_complaint: null,
    completed_complaint: null,
    pending_by_customer: null,
    pending_for_spares: null,
    pending_over_48h_no_plan: null,
    google_feedback: null,
  });
  openInstallationBreakdownRef.current = openInstallationBreakdown;
  openCompletionsBreakdownRef.current = openCompletionsBreakdown;
  activeWarrantyBreakdownRef.current = activeWarrantyBreakdown;
  const [activeAmcBreakdown, setActiveAmcBreakdown] = useState({
    active_amc: null,
    expiring_30_days: null,
    expired_amc: null,
  });
  const [activeAmcKpiLoading, setActiveAmcKpiLoading] = useState(() => segment === "active-amc");
  const activeAmcBreakdownRef = useRef({
    active_amc: null,
    expiring_30_days: null,
    expired_amc: null,
  });
  activeAmcBreakdownRef.current = activeAmcBreakdown;

  useEffect(() => {
    if (segment !== "open-installation") {
      setOpenInstallationBucketReady(true);
      return;
    }
    const nextBucket = stickyOpenInstallationBucket(
      stickyBucketRef.current || initialOpenInstallationBucket,
    );
    stickyBucketRef.current = nextBucket;
    persistOpenInstallationBucket(nextBucket);
    setAppliedFilters((prev) =>
      prev.openInstallationBucket === nextBucket
        ? prev
        : { ...prev, openInstallationBucket: nextBucket },
    );
    setDraftFilters((prev) =>
      prev.openInstallationBucket === nextBucket
        ? prev
        : { ...prev, openInstallationBucket: nextBucket },
    );
    setOpenInstallationBucketReady(true);
  }, [segment, initialOpenInstallationBucket]);

  useEffect(() => {
    if (segment !== "open-completions") {
      setOpenCompletionsBucketReady(true);
      return;
    }
    const nextBucket = stickyOpenCompletionsBucket(
      stickyBucketRef.current || initialOpenCompletionsBucket,
    );
    stickyBucketRef.current = nextBucket;
    persistOpenCompletionsBucket(nextBucket);
    setAppliedFilters((prev) =>
      prev.openCompletionsBucket === nextBucket
        ? prev
        : { ...prev, openCompletionsBucket: nextBucket },
    );
    setDraftFilters((prev) =>
      prev.openCompletionsBucket === nextBucket
        ? prev
        : { ...prev, openCompletionsBucket: nextBucket },
    );
    setOpenCompletionsBucketReady(true);
  }, [segment, initialOpenCompletionsBucket]);

  useEffect(() => {
    if (segment !== "active-warranty") {
      setWarrantyBucketReady(true);
      return;
    }
    const nextBucket = stickyWarrantyBucket(stickyBucketRef.current || initialWarrantyBucket);
    stickyBucketRef.current = nextBucket;
    persistWarrantyBucket(nextBucket);
    setAppliedFilters((prev) =>
      prev.warrantyBucket === nextBucket ? prev : { ...prev, warrantyBucket: nextBucket },
    );
    setDraftFilters((prev) =>
      prev.warrantyBucket === nextBucket ? prev : { ...prev, warrantyBucket: nextBucket },
    );
    setWarrantyBucketReady(true);
  }, [segment, initialWarrantyBucket]);

  useEffect(() => {
    if (segment !== "active-amc") {
      setAmcBucketReady(true);
      return;
    }
    const nextBucket = stickyAmcBucket(stickyBucketRef.current || initialAmcBucket);
    stickyBucketRef.current = nextBucket;
    persistAmcBucket(nextBucket);
    setAppliedFilters((prev) =>
      prev.amcBucket === nextBucket ? prev : { ...prev, amcBucket: nextBucket },
    );
    setDraftFilters((prev) =>
      prev.amcBucket === nextBucket ? prev : { ...prev, amcBucket: nextBucket },
    );
    setAmcBucketReady(true);
  }, [segment, initialAmcBucket]);

  useEffect(() => {
    if (prevSegmentRef.current === segment) return;
    prevSegmentRef.current = segment;
    setPage(0);
    setTableFilterOptions(null);
    tableFilterOptionsFetchKeyRef.current = null;
    if (segment === "open-installation") {
      stickyBucketRef.current = stickyOpenInstallationBucket(stickyBucketRef.current);
    } else if (segment === "open-completions") {
      stickyBucketRef.current = stickyOpenCompletionsBucket(stickyBucketRef.current);
    } else if (segment === "active-warranty") {
      stickyBucketRef.current = stickyWarrantyBucket(stickyBucketRef.current);
    } else if (segment === "active-amc") {
      stickyBucketRef.current = stickyAmcBucket(stickyBucketRef.current);
    } else {
      stickyBucketRef.current = "";
    }
    const next = initialSbiFiltersForSegment(segment, stickyBucketRef.current);
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

  const openCompletionsKpiFilterKey = useMemo(() => {
    if (segment !== "open-completions") return "";
    const { serviceStatus: _status, openCompletionsBucket: _bucket, ...rest } = appliedFilters;
    return JSON.stringify(rest);
  }, [segment, appliedFilters]);

  const activeWarrantyKpiFilterKey = useMemo(() => {
    if (segment !== "active-warranty") return "";
    const { warrantyBucket: _bucket, ...rest } = appliedFilters;
    return JSON.stringify(rest);
  }, [segment, appliedFilters]);

  const fetchActiveWarrantyKpis = useCallback(async () => {
    if (segment !== "active-warranty") return;
    const filterKey = activeWarrantyKpiFilterKey;
    if (kpiFetchedKeyRef.current === filterKey) return;

    kpiFetchAbortRef.current?.abort();
    const controller = new AbortController();
    kpiFetchAbortRef.current = controller;

    kpiFetchedKeyRef.current = filterKey;
    setActiveWarrantyKpiLoading(true);
    try {
      const { warrantyBucket: _bucket, ...params } = appliedFilters;
      const res = await axios.get("/api/service-before-installation/active-warranty/kpi", {
        params,
        signal: controller.signal,
        timeout: 12_000,
      });
      if (res.data?.success && res.data.breakdown) {
        setActiveWarrantyBreakdown(res.data.breakdown);
        activeWarrantyBreakdownRef.current = res.data.breakdown;
      }
    } catch (e) {
      if (e?.code !== "ERR_CANCELED") console.error(e);
    } finally {
      if (!controller.signal.aborted) {
        setActiveWarrantyKpiLoading(false);
      }
    }
  }, [segment, appliedFilters, activeWarrantyKpiFilterKey]);

  const activeAmcKpiFilterKey = useMemo(() => {
    if (segment !== "active-amc") return "";
    const { amcBucket: _bucket, ...rest } = appliedFilters;
    return JSON.stringify(rest);
  }, [segment, appliedFilters]);

  const fetchActiveAmcKpis = useCallback(async () => {
    if (segment !== "active-amc") return;
    const filterKey = activeAmcKpiFilterKey;
    if (kpiFetchedKeyRef.current === filterKey) return;

    kpiFetchAbortRef.current?.abort();
    const controller = new AbortController();
    kpiFetchAbortRef.current = controller;

    kpiFetchedKeyRef.current = filterKey;
    setActiveAmcKpiLoading(true);
    try {
      const { amcBucket: _bucket, ...params } = appliedFilters;
      const res = await axios.get("/api/service-before-installation/active-amc/kpi", {
        params,
        signal: controller.signal,
        timeout: 12_000,
      });
      if (res.data?.success && res.data.breakdown) {
        setActiveAmcBreakdown(res.data.breakdown);
        activeAmcBreakdownRef.current = res.data.breakdown;
      }
    } catch (e) {
      if (e?.code !== "ERR_CANCELED") console.error(e);
    } finally {
      if (!controller.signal.aborted) {
        setActiveAmcKpiLoading(false);
      }
    }
  }, [segment, appliedFilters, activeAmcKpiFilterKey]);

  const fetchOpenCompletionsKpis = useCallback(async () => {
    if (segment !== "open-completions") return;
    const filterKey = openCompletionsKpiFilterKey;
    if (kpiFetchedKeyRef.current === filterKey) return;

    kpiFetchAbortRef.current?.abort();
    const controller = new AbortController();
    kpiFetchAbortRef.current = controller;

    kpiFetchedKeyRef.current = filterKey;
    setOpenCompletionsKpiLoading(true);
    try {
      const { serviceStatus: _status, openCompletionsBucket: _bucket, ...params } = appliedFilters;
      const res = await axios.get("/api/service-before-installation/open-completions/kpi", {
        params,
        signal: controller.signal,
        timeout: 12_000,
      });
      if (res.data?.success && res.data.breakdown) {
        setOpenCompletionsBreakdown(res.data.breakdown);
      }
    } catch (e) {
      if (e?.code !== "ERR_CANCELED") console.error(e);
    } finally {
      if (!controller.signal.aborted) {
        setOpenCompletionsKpiLoading(false);
      }
    }
  }, [segment, appliedFilters, openCompletionsKpiFilterKey]);

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

  const patchBreakdownField = useCallback((field, total) => {
    const n = Number(total);
    if (!Number.isFinite(n)) return;
    setOpenInstallationBreakdown((prev) => {
      const next = { ...prev, [field]: n };
      openInstallationBreakdownRef.current = next;
      return next;
    });
  }, []);

  const patchFeedbackCollected = useCallback((total) => {
    patchBreakdownField("feedback_collected", total);
  }, [patchBreakdownField]);

  /** Google feedback collected count — does not block list / other KPI cards. */
  const fetchFeedbackCollectedKpiCount = useCallback(
    async (signal) => {
      if (segment !== "open-installation") return;
      const {
        openInstallationBucket: _bucket,
        dispatchStatus: _dispatchStatus,
        ...kpiFilters
      } = appliedFilters;
      setFeedbackCollectedKpiLoading(true);
      try {
        const res = await axios.get(OPEN_INSTALLATION_GOOGLE_FEEDBACK_API, {
          params: {
            ...kpiFilters,
            countOnly: "1",
            limit: 1,
            skip: 0,
          },
          signal,
          timeout: 12_000,
        });
        if (res.data?.success) {
          const n = Number(
            res.data.count ??
              res.data.feedback_collected ??
              res.data.pagination?.total ??
              0,
          );
          patchFeedbackCollected(n);
          if (String(appliedFilters.openInstallationBucket || "").trim() === "feedback_collected") {
            applyListTotal(n);
          }
        } else {
          setOpenInstallationBreakdown((prev) => {
            if (prev.feedback_collected != null) return prev;
            const next = { ...prev, feedback_collected: 0 };
            openInstallationBreakdownRef.current = next;
            return next;
          });
        }
      } catch (e) {
        if (e?.code !== "ERR_CANCELED") console.error(e);
        setOpenInstallationBreakdown((prev) => {
          if (prev.feedback_collected != null) return prev;
          const next = { ...prev, feedback_collected: 0 };
          openInstallationBreakdownRef.current = next;
          return next;
        });
      } finally {
        if (!signal?.aborted) setFeedbackCollectedKpiLoading(false);
      }
    },
    [segment, appliedFilters, patchFeedbackCollected, applyListTotal],
  );

  const fetchOpenInstallationKpiCard = useCallback(
    async ({ bucket, field, setLoading, signal, requestId }) => {
      if (segment !== "open-installation") return;
      const { openInstallationBucket: _b, ...kpiFilters } = appliedFilters;
      setLoading(true);
      try {
        const res = await axios.get(
          `/api/service-before-installation/open-installation/kpi/${bucket}`,
          {
            params: { ...kpiFilters, openInstallationBucket: "" },
            signal,
            timeout: 12_000,
          },
        );
        if (requestId !== kpiRequestIdRef.current) return;
        if (res.data?.success) {
          const n = Number(res.data.count ?? res.data[field] ?? 0);
          patchBreakdownField(field, n);
          const activeBucket = String(appliedFilters.openInstallationBucket || "").trim();
          if (
            !(listTotalRef.current > 0) &&
            activeBucket &&
            openInstallationBucketRecordCount(activeBucket, {
              ...openInstallationBreakdownRef.current,
              [field]: n,
            }) === n
          ) {
            applyListTotalRef.current?.(n);
          }
        } else {
          setOpenInstallationBreakdown((prev) => {
            if (prev[field] != null) return prev;
            const next = { ...prev, [field]: 0 };
            openInstallationBreakdownRef.current = next;
            return next;
          });
        }
      } catch (e) {
        if (e?.code !== "ERR_CANCELED") console.error(e);
        setOpenInstallationBreakdown((prev) => {
          if (prev[field] != null) return prev;
          const next = { ...prev, [field]: 0 };
          openInstallationBreakdownRef.current = next;
          return next;
        });
      } finally {
        if (!signal?.aborted && requestId === kpiRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [segment, appliedFilters, patchBreakdownField],
  );

  /** One lite KPI scan for 3 neworder cards; planned + Google Feedback stay independent. */
  const fetchOpenInstallationKpis = useCallback(async () => {
    if (segment !== "open-installation") return;
    const filterKey = openInstallationKpiFilterKey;
    if (kpiFetchedKeyRef.current === filterKey) return;

    const requestId = (kpiRequestIdRef.current += 1);
    kpiFetchAbortRef.current?.abort();
    const controller = new AbortController();
    kpiFetchAbortRef.current = controller;
    const { signal } = controller;

    kpiFetchedKeyRef.current = filterKey;
    setOpenInstallationKpiLoading(true);
    setDeliveryPendingKpiLoading(true);
    setCompletedKpiLoading(true);
    setPlannedKpiLoading(true);
    setFeedbackCollectedKpiLoading(true);

    const { openInstallationBucket: _b, ...kpiFilters } = appliedFilters;
    const params = { ...kpiFilters, openInstallationBucket: "" };

    void (async () => {
      try {
        const res = await axios.get("/api/service-before-installation/open-installation/kpi", {
          params,
          signal,
          timeout: 10_000,
        });
        if (requestId !== kpiRequestIdRef.current) return;
        if (res.data?.success && res.data.openInstallationBreakdown) {
          const b = res.data.openInstallationBreakdown;
          setOpenInstallationBreakdown((prev) => {
            const next = {
              ...prev,
              delivered_installation_pending: b.delivered_installation_pending,
              overdue_delayed_installation: b.overdue_delayed_installation,
              delivery_pending_after_dispatch: b.delivery_pending_after_dispatch,
              completed_installation: b.completed_installation,
              total: b.total ?? prev.total,
            };
            openInstallationBreakdownRef.current = next;
            return next;
          });
          const activeBucket = String(appliedFilters.openInstallationBucket || "").trim();
          const n = openInstallationBucketRecordCount(activeBucket, b);
          if (n > 0) applyListTotalRef.current?.(n);
        }
      } catch (e) {
        if (e?.code !== "ERR_CANCELED") console.error(e);
      } finally {
        if (!signal.aborted && requestId === kpiRequestIdRef.current) {
          setOpenInstallationKpiLoading(false);
          setDeliveryPendingKpiLoading(false);
          setCompletedKpiLoading(false);
        }
      }
    })();

    void fetchOpenInstallationKpiCard({
      bucket: "planned",
      field: "installation_planned",
      setLoading: setPlannedKpiLoading,
      signal,
      requestId,
    });
    void fetchFeedbackCollectedKpiCount(signal);
  }, [
    segment,
    openInstallationKpiFilterKey,
    appliedFilters,
    fetchOpenInstallationKpiCard,
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
            prev
              .map((row) => {
                const hit = patchByQuote.get(String(row.quote_number || "").trim().toLowerCase());
                return hit ? { ...row, ...hit } : row;
              })
              .filter((row) => !isTempSerialNumber(row.serial_number)),
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
    const isFeedbackTable =
      segment === "open-installation" && bucket === "feedback_collected";

    setCountLoading(true);
    try {
      const { openInstallationBucket: _bucket, ...countFilters } = appliedFilters;
      const res = await axios.get(
        segment === "open-installation"
          ? openInstallationTableCountApi(bucket)
          : `/api/service-before-installation/${segment}`,
        {
          params: {
            ...countFilters,
            ...(segment !== "open-installation" || isFeedbackTable
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
        if (isFeedbackTable) patchFeedbackCollected(total);
      }
    } catch (e) {
      if (e?.code === "ERR_CANCELED") return;
      console.error(e);
      if (isFeedbackTable && !(listTotalRef.current > 0)) {
        const fallback = Math.max(pageSize, page * pageSize + pageSize);
        applyListTotal(fallback);
      }
    } finally {
      if (!controller.signal.aborted) {
        setCountLoading(false);
      }
    }
  }, [segment, appliedFilters, page, pageSize, applyListTotal, patchFeedbackCollected]);

  const fetchOpenCompletionsCount = useCallback(async () => {
    if (segment !== "open-completions") return;
    countFetchAbortRef.current?.abort();
    const controller = new AbortController();
    countFetchAbortRef.current = controller;

    setCountLoading(true);
    try {
      const { openCompletionsBucket: _bucket, serviceStatus: _status, ...countFilters } =
        appliedFilters;
      const bucket = String(appliedFilters.openCompletionsBucket || "total_registered").trim();
      const res = await axios.get(openCompletionsTableCountApi(bucket), {
        params: countFilters,
        signal: controller.signal,
        timeout: 15_000,
      });
      if (res.data?.success) {
        const total = Number(res.data.pagination?.total ?? 0);
        applyListTotal(total);
      }
    } catch (e) {
      if (e?.code === "ERR_CANCELED") return;
      console.error(e);
    } finally {
      if (!controller.signal.aborted) {
        setCountLoading(false);
      }
    }
  }, [segment, appliedFilters, applyListTotal]);

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

    // Open Installation: each card has its own table API (/list/{bucket}).
    if (isOpenInstallationList) {
      const isFeedbackTable =
        segment === "open-installation" && activeBucket === "feedback_collected";
      if (segment === "open-installation") {
        if (kpiFetchedKeyRef.current !== openInstallationKpiFilterKey) {
          void fetchOpenInstallationKpis();
        }
      }
      try {
        const {
          openInstallationBucket: _bucket,
          range: _range,
          ...listFilters
        } = appliedFilters;
        const listUrl =
          segment === "open-installation"
            ? openInstallationTableListApi(activeBucket)
            : `/api/service-before-installation/${segment}`;
        const compactParams = Object.fromEntries(
          Object.entries({
            ...listFilters,
            limit: pageSize,
            skip: page * pageSize,
            includeFilterOptions: "0",
            skipTotal: "1",
            includeOpenInstallationBreakdown: "0",
            deferServiceEnrich: isFeedbackTable ? "0" : "1",
          }).filter(([, v]) => v !== "" && v != null && v !== false),
        );
        const res = await axios.get(listUrl, {
          params: compactParams,
          signal,
          timeout: 30_000,
        });
        if (res.data?.success && requestId === rowsRequestIdRef.current) {
          const data = (res.data.data || []).filter(
            (row) => !isTempSerialNumber(row.serial_number),
          );
          const pag = res.data.pagination || {};
          const hasMoreFlag = Boolean(pag.hasMore) || data.length >= pageSize;
          const total = knownTotal > 0 ? knownTotal : listTotalRef.current || 0;
          setRows(data);
          setPagination({
            total,
            hasMore: total > 0 ? page * pageSize + data.length < total : hasMoreFlag,
          });
          if (isFeedbackTable && !hasMoreFlag) {
            const exact = page * pageSize + data.length;
            applyListTotal(exact, data.length);
            patchFeedbackCollected(exact);
          }
          // Enrich after paint (serial/model/engineer) — never blocks first rows.
          if (data.length) {
            window.setTimeout(() => {
              if (requestId !== rowsRequestIdRef.current) return;
              void enrichOpenInstallationServiceColumns(data, requestId);
            }, 0);
          }
        }
      } catch (e) {
        if (e?.code === "ERR_CANCELED") return;
        console.error("[open-installation list]", e?.response?.data || e.message || e);
      } finally {
        if (!signal.aborted && requestId === rowsRequestIdRef.current) {
          setLoading(false);
          setApplyingFilters(false);
        }
      }

      if (signal.aborted || requestId !== rowsRequestIdRef.current) return;

      // Prefer card totals; skip extra COUNT unless KPI still has not returned.
      const fromCards = openInstallationBucketRecordCount(
        activeBucket,
        openInstallationBreakdownRef.current,
      );
      if (fromCards > 0) {
        applyListTotal(fromCards);
        setCountLoading(false);
      } else if (!(listTotalRef.current > 0)) {
        window.setTimeout(() => {
          if (requestId !== rowsRequestIdRef.current) return;
          if (listTotalRef.current > 0) {
            setCountLoading(false);
            return;
          }
          void fetchOpenInstallationCount();
        }, 500);
      } else {
        setCountLoading(false);
      }
      return;
    }

    if (segment === "open-completions") {
      const activeBucket = String(appliedFilters.openCompletionsBucket || "total_registered").trim();
      const knownTotal =
        listTotalRef.current ||
        openCompletionsBucketRecordCount(activeBucket, openCompletionsBreakdownRef.current);

      if (kpiFetchedKeyRef.current !== openCompletionsKpiFilterKey) {
        void fetchOpenCompletionsKpis();
      }

      try {
        const { openCompletionsBucket: _bucket, serviceStatus: _status, ...listFilters } =
          appliedFilters;
        const res = await axios.get(openCompletionsTableListApi(activeBucket), {
          params: {
            ...listFilters,
            limit: pageSize,
            skip: page * pageSize,
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

      const fromCards = openCompletionsBucketRecordCount(
        activeBucket,
        openCompletionsBreakdownRef.current,
      );
      if (fromCards > 0) {
        applyListTotal(fromCards);
        setCountLoading(false);
      } else if (!(listTotalRef.current > 0)) {
        window.setTimeout(() => {
          if (requestId !== rowsRequestIdRef.current) return;
          if (listTotalRef.current > 0) {
            setCountLoading(false);
            return;
          }
          void fetchOpenCompletionsCount();
        }, 500);
      } else {
        setCountLoading(false);
      }
      return;
    }

    if (segment === "active-warranty") {
      const activeBucket = String(appliedFilters.warrantyBucket || "active").trim();
      const knownTotal =
        listTotalRef.current ||
        activeWarrantyBucketRecordCount(activeBucket, activeWarrantyBreakdownRef.current);

      if (kpiFetchedKeyRef.current !== activeWarrantyKpiFilterKey) {
        void fetchActiveWarrantyKpis();
      }

      try {
        const { warrantyBucket: _bucket, ...listFilters } = appliedFilters;
        const res = await axios.get(`/api/service-before-installation/active-warranty`, {
          params: {
            ...listFilters,
            warrantyBucket: activeBucket,
            limit: pageSize,
            skip: page * pageSize,
            includeFilterOptions: "0",
            deferTotal: "0",
            skipTotal: "0",
          },
          signal,
          timeout: 20_000,
        });
        if (res.data?.success && requestId === rowsRequestIdRef.current) {
          const data = res.data.data || [];
          const pag = res.data.pagination || {};
          const total =
            knownTotal > 0
              ? knownTotal
              : Number(pag.total) || listTotalRef.current || 0;
          if (total > 0) listTotalRef.current = total;
          setRows(data);
          setPagination({
            total,
            hasMore: total > 0 ? page * pageSize + data.length < total : Boolean(pag.hasMore),
          });
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

      const fromCards = activeWarrantyBucketRecordCount(
        activeBucket,
        activeWarrantyBreakdownRef.current,
      );
      if (fromCards > 0) {
        applyListTotal(fromCards);
        setCountLoading(false);
      }
      return;
    }

    if (segment === "active-amc") {
      const activeBucket = String(appliedFilters.amcBucket || "active").trim();
      const knownTotal =
        listTotalRef.current ||
        activeAmcBucketRecordCount(activeBucket, activeAmcBreakdownRef.current);

      if (kpiFetchedKeyRef.current !== activeAmcKpiFilterKey) {
        void fetchActiveAmcKpis();
      }

      try {
        const { amcBucket: _bucket, ...listFilters } = appliedFilters;
        const res = await axios.get(`/api/service-before-installation/active-amc`, {
          params: {
            ...listFilters,
            amcBucket: activeBucket,
            limit: pageSize,
            skip: page * pageSize,
          },
          signal,
          timeout: 20_000,
        });
        if (res.data?.success && requestId === rowsRequestIdRef.current) {
          const data = res.data.data || [];
          const pag = res.data.pagination || {};
          const total =
            Number(pag.total) || knownTotal || listTotalRef.current || 0;
          if (total > 0) listTotalRef.current = total;
          setRows(data);
          setPagination({
            total,
            hasMore: total > 0 ? page * pageSize + data.length < total : Boolean(pag.hasMore),
          });
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

      const fromCards = activeAmcBucketRecordCount(
        activeBucket,
        activeAmcBreakdownRef.current,
      );
      if (fromCards > 0) {
        applyListTotal(fromCards);
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
      if (!signal.aborted && requestId === rowsRequestIdRef.current) {
        setLoading(false);
        setApplyingFilters(false);
      }
    }
  }, [
    segment,
    appliedFilters,
    page,
    pageSize,
    openInstallationKpiFilterKey,
    openCompletionsKpiFilterKey,
    fetchOpenInstallationCount,
    fetchOpenInstallationKpis,
    fetchOpenCompletionsCount,
    fetchOpenCompletionsKpis,
    fetchActiveWarrantyKpis,
    activeWarrantyKpiFilterKey,
    fetchActiveAmcKpis,
    activeAmcKpiFilterKey,
    fetchFeedbackCollectedKpiCount,
    patchFeedbackCollected,
    enrichOpenInstallationServiceColumns,
    applyListTotal,
  ]);

  const fetchTableFilterOptions = useCallback(async () => {
    if (
      segment !== "total-registered" &&
      segment !== "active-warranty" &&
      segment !== "open-installation" &&
      segment !== "overdue-delayed-installation"
    ) {
      return;
    }
    // Open Installation filters API uses small rep_list / third-party tables only.
    const key =
      segment === "overdue-delayed-installation"
        ? "open-installation"
        : segment === "active-warranty"
          ? "active-warranty"
          : segment;
    if (tableFilterOptionsFetchKeyRef.current === key) return;
    tableFilterOptionsFetchKeyRef.current = key;
    try {
      const res = await axios.get(
        segment === "total-registered"
          ? "/api/service-before-installation/total-registered/filters"
          : "/api/service-before-installation/filters",
        {
          params: segment === "total-registered" ? undefined : { segment },
          timeout: 12_000,
        },
      );
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
    if (segment !== "open-installation") return;
    void fetchOpenInstallationKpis();
  }, [segment, fetchOpenInstallationKpis]);

  useEffect(() => {
    if (segment !== "open-completions") return;
    void fetchOpenCompletionsKpis();
  }, [segment, openCompletionsKpiFilterKey, fetchOpenCompletionsKpis]);

  useEffect(() => {
    if (segment !== "active-warranty") return;
    void fetchActiveWarrantyKpis();
  }, [segment, activeWarrantyKpiFilterKey, fetchActiveWarrantyKpis]);

  useEffect(() => {
    if (segment !== "active-amc") return;
    void fetchActiveAmcKpis();
  }, [segment, activeAmcKpiFilterKey, fetchActiveAmcKpis]);

  useEffect(() => {
    if (segment === "open-installation" && !openInstallationBucketReady) return;
    if (segment === "open-completions" && !openCompletionsBucketReady) return;
    if (segment === "active-warranty" && !warrantyBucketReady) return;
    if (segment === "active-amc" && !amcBucketReady) return;
    fetchRows();
    return () => rowsFetchAbortRef.current?.abort();
  }, [
    fetchRows,
    segment,
    openInstallationBucketReady,
    openCompletionsBucketReady,
    warrantyBucketReady,
    amcBucketReady,
  ]);

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

  const handleOpenCompletionsRowPatch = useCallback((serviceId, patch) => {
    const id = String(serviceId || "").trim();
    if (!id) return;
    setRows((prev) =>
      prev.map((r) => (String(r.service_id) === id ? { ...r, ...patch } : r)),
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

        <DetailSegmentHeader
          meta={headerMeta}
          segment={segment}
          trailing={
            segment === "active-warranty" ? (
              <ActiveWarrantyAllProductsSummaryCard
                totals={activeWarrantyBreakdown}
                loading={activeWarrantyKpiLoading}
              />
            ) : null
          }
        />

        {segment === "open-completions" ? (
          <ServiceBeforeInstallationOpenCompletionsKpiSection
            openCompletionsBucket={appliedFilters.openCompletionsBucket || "total_registered"}
            totals={openCompletionsBreakdown}
            loading={openCompletionsKpiLoading}
            onCardSelect={(openCompletionsBucket) => {
              const nextBucket =
                normalizeOpenCompletionsBucket(openCompletionsBucket) || "total_registered";
              const current = String(
                appliedFilters.openCompletionsBucket || "total_registered",
              ).trim();
              if (nextBucket === current) return;
              stickyBucketRef.current = persistOpenCompletionsBucket(nextBucket);
              setPage(0);
              listTotalRef.current = 0;
              setRows([]);
              setPagination({ total: 0, hasMore: false });
              setLoading(true);
              setCountLoading(true);
              const estTotal = openCompletionsBucketRecordCount(
                nextBucket,
                openCompletionsBreakdownRef.current,
              );
              if (estTotal > 0) {
                applyListTotal(estTotal);
                setPagination({ total: estTotal, hasMore: estTotal > pageSize });
              }
              const next = { ...appliedFilters, openCompletionsBucket: nextBucket };
              setAppliedFilters(next);
              setDraftFilters(next);
            }}
          />
        ) : null}

        {segment === "open-installation" ? (
          <ServiceBeforeInstallationOpenInstallationKpiStrip
            openInstallationBucket={appliedFilters.openInstallationBucket}
            totals={openInstallationBreakdown}
            loading={openInstallationKpiLoading}
            plannedLoading={plannedKpiLoading}
            deliveryPendingLoading={deliveryPendingKpiLoading}
            completedLoading={completedKpiLoading}
            noFeedbackLoading={feedbackCollectedKpiLoading}
            onCardSelect={(openInstallationBucket) => {
              const nextBucket = persistOpenInstallationBucket(
                openInstallationBucket ||
                  stickyBucketRef.current ||
                  appliedFilters.openInstallationBucket,
              );
              if (nextBucket === String(appliedFilters.openInstallationBucket || "").trim()) {
                stickyBucketRef.current = nextBucket;
                return;
              }
              stickyBucketRef.current = nextBucket;
              setPage(0);
              setLoading(true);
              const estTotal = openInstallationBucketRecordCount(
                nextBucket,
                openInstallationBreakdown,
              );
              listTotalRef.current = estTotal;
              setPagination({ total: estTotal, hasMore: estTotal > pageSize });
              const next = { ...appliedFilters, openInstallationBucket: nextBucket };
              setAppliedFilters(next);
              setDraftFilters(next);
            }}
          />
        ) : null}

        {segment === "active-warranty" ? (
          <ServiceBeforeInstallationActiveWarrantyKpiStrip
            warrantyBucket={appliedFilters.warrantyBucket || "active"}
            totals={activeWarrantyBreakdown}
            loading={activeWarrantyKpiLoading}
            onCardSelect={(warrantyBucket) => {
              const nextBucket = normalizeWarrantyBucket(warrantyBucket) || "active";
              const current = String(appliedFilters.warrantyBucket || "active").trim();
              if (nextBucket === current) return;
              stickyBucketRef.current = persistWarrantyBucket(nextBucket);
              setPage(0);
              listTotalRef.current = 0;
              setRows([]);
              setPagination({ total: 0, hasMore: false });
              setLoading(true);
              setCountLoading(true);
              const estTotal = activeWarrantyBucketRecordCount(
                nextBucket,
                activeWarrantyBreakdownRef.current,
              );
              if (estTotal > 0) {
                applyListTotal(estTotal);
                setPagination({ total: estTotal, hasMore: estTotal > pageSize });
              }
              const next = { ...appliedFilters, warrantyBucket: nextBucket };
              setAppliedFilters(next);
              setDraftFilters(next);
            }}
          />
        ) : null}

        {segment === "active-amc" ? (
          <ServiceBeforeInstallationActiveAmcKpiStrip
            amcBucket={appliedFilters.amcBucket || "active"}
            totals={activeAmcBreakdown}
            loading={activeAmcKpiLoading}
            onCardSelect={(amcBucket) => {
              const nextBucket = normalizeAmcBucket(amcBucket) || "active";
              const current = String(appliedFilters.amcBucket || "active").trim();
              if (nextBucket === current) return;
              stickyBucketRef.current = persistAmcBucket(nextBucket);
              setPage(0);
              listTotalRef.current = 0;
              setRows([]);
              setPagination({ total: 0, hasMore: false });
              setLoading(true);
              setCountLoading(true);
              const estTotal = activeAmcBucketRecordCount(
                nextBucket,
                activeAmcBreakdownRef.current,
              );
              if (estTotal > 0) {
                applyListTotal(estTotal);
                setPagination({ total: estTotal, hasMore: estTotal > pageSize });
              }
              const next = { ...appliedFilters, amcBucket: nextBucket };
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
          onChange={(next) => {
            setDraftFilters({
              ...next,
              ...(segment === "open-installation"
                ? {
                    openInstallationBucket:
                      stickyBucketRef.current ||
                      appliedFilters.openInstallationBucket ||
                      next.openInstallationBucket ||
                      "delivered_pending",
                  }
                : {}),
              ...(segment === "open-completions"
                ? {
                    openCompletionsBucket:
                      stickyBucketRef.current ||
                      appliedFilters.openCompletionsBucket ||
                      next.openCompletionsBucket ||
                      "total_registered",
                  }
                : {}),
              ...(segment === "active-warranty"
                ? {
                    warrantyBucket:
                      stickyBucketRef.current ||
                      appliedFilters.warrantyBucket ||
                      next.warrantyBucket ||
                      "active",
                  }
                : {}),
              ...(segment === "active-amc"
                ? {
                    amcBucket:
                      stickyBucketRef.current ||
                      appliedFilters.amcBucket ||
                      next.amcBucket ||
                      "active",
                  }
                : {}),
            });
          }}
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
            setDeliveryPendingKpiLoading(true);
            setPlannedKpiLoading(true);
            setCompletedKpiLoading(true);
            setFeedbackCollectedKpiLoading(true);
            setOpenCompletionsKpiLoading(segment === "open-completions");
            setActiveWarrantyKpiLoading(segment === "active-warranty");
            setActiveAmcKpiLoading(segment === "active-amc");
            if (segment === "open-installation") {
              const keptBucket = persistOpenInstallationBucket(
                stickyBucketRef.current ||
                  appliedFilters.openInstallationBucket ||
                  draftFilters.openInstallationBucket,
              );
              stickyBucketRef.current = keptBucket;
              setAppliedFilters({
                ...draftFilters,
                openInstallationBucket: keptBucket,
              });
            } else if (segment === "open-completions") {
              const keptBucket = persistOpenCompletionsBucket(
                stickyBucketRef.current ||
                  appliedFilters.openCompletionsBucket ||
                  draftFilters.openCompletionsBucket,
              );
              stickyBucketRef.current = keptBucket;
              setAppliedFilters({
                ...draftFilters,
                openCompletionsBucket: keptBucket,
              });
            } else if (segment === "active-warranty") {
              const keptBucket = persistWarrantyBucket(
                stickyBucketRef.current ||
                  appliedFilters.warrantyBucket ||
                  draftFilters.warrantyBucket,
              );
              stickyBucketRef.current = keptBucket;
              setAppliedFilters({
                ...draftFilters,
                warrantyBucket: keptBucket,
              });
            } else if (segment === "active-amc") {
              const keptBucket = persistAmcBucket(
                stickyBucketRef.current ||
                  appliedFilters.amcBucket ||
                  draftFilters.amcBucket,
              );
              stickyBucketRef.current = keptBucket;
              setAppliedFilters({
                ...draftFilters,
                amcBucket: keptBucket,
              });
            } else {
              setAppliedFilters(draftFilters);
            }
          }}
          onClear={() => {
            setLoading(true);
            setPage(0);
            if (segment === "open-installation") {
              const keptBucket = persistOpenInstallationBucket(
                stickyBucketRef.current || appliedFilters.openInstallationBucket,
              );
              stickyBucketRef.current = keptBucket;
              const next = initialSbiFiltersForSegment(segment, keptBucket);
              applyFilterState(setDraftFilters, setAppliedFilters, next);
              return;
            }
            if (segment === "open-completions") {
              const keptBucket = persistOpenCompletionsBucket(
                stickyBucketRef.current || appliedFilters.openCompletionsBucket,
              );
              stickyBucketRef.current = keptBucket;
              const next = initialSbiFiltersForSegment(segment, keptBucket);
              applyFilterState(setDraftFilters, setAppliedFilters, next);
              return;
            }
            if (segment === "active-warranty") {
              const keptBucket = persistWarrantyBucket(
                stickyBucketRef.current || appliedFilters.warrantyBucket,
              );
              stickyBucketRef.current = keptBucket;
              const next = initialSbiFiltersForSegment(segment, keptBucket);
              applyFilterState(setDraftFilters, setAppliedFilters, next);
              return;
            }
            if (segment === "active-amc") {
              const keptBucket = persistAmcBucket(
                stickyBucketRef.current || appliedFilters.amcBucket,
              );
              stickyBucketRef.current = keptBucket;
              const next = initialSbiFiltersForSegment(segment, keptBucket);
              applyFilterState(setDraftFilters, setAppliedFilters, next);
              return;
            }
            const next = initialSbiFiltersForSegment(segment, "");
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
              {canExportCsv ? (
                <button
                  type="button"
                  disabled={loading || rows.length === 0}
                  onClick={() => exportRowsCsv(rows, segment)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Export
                </button>
              ) : null}
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

          <SbiRecordsTableScroll
            syncKey={`${page}-${pageSize}-${rows.length}-${loading ? 1 : 0}`}
          >
            <table
              className={`w-full ${tableMinWidthClass(segment)} text-sm transition-opacity ${loading && rows.length > 0 ? "opacity-50" : ""}`}
            >
              <thead className="sticky top-0 z-10">
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
                    onOpenCompletionsRowPatch={handleOpenCompletionsRowPatch}
                    onMachineFollowUp={openMachineFollowUp}
                    onMachineHistory={openMachineHistory}
                    onWarrantyAction={
                      segment === "total-registered" ? handleWarrantyRowAction : undefined
                    }
                    onServiceHistory={
                      segment === "total-registered"
                        ? (serial) => setServiceHistorySerial(String(serial || "").trim())
                        : undefined
                    }
                    ProductFollowupIcons={
                      segment === "open-installation" ||
                      segment === "overdue-delayed-installation" ||
                      segment === "open-completions"
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
          </SbiRecordsTableScroll>

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
      <RegisteredProductServiceHistoryModal
        open={Boolean(serviceHistorySerial)}
        serialNumber={serviceHistorySerial}
        dashboardBase={dashboardBase}
        onClose={() => setServiceHistorySerial(null)}
      />
      {segment === "total-registered" ? <Toaster position="top-right" /> : null}
      {warrantyRowModal?.type === "install" && warrantyRowModal.serial ? (
        <WarrantyInstallRequestModal
          serialNumber={warrantyRowModal.serial}
          onClose={() => setWarrantyRowModal(null)}
          onSuccess={() => setWarrantyRowModal(null)}
        />
      ) : null}
      {warrantyRowModal?.type === "complaint" && warrantyRowModal.serial ? (
        <WarrantyComplaintModal
          serialNumber={warrantyRowModal.serial}
          onClose={() => setWarrantyRowModal(null)}
          onSuccess={() => setWarrantyRowModal(null)}
        />
      ) : null}
      {warrantyRowModal?.type === "edit" && warrantyRowModal.serial ? (
        <WarrantyProductEditModal
          serialNumber={warrantyRowModal.serial}
          onClose={() => setWarrantyRowModal(null)}
          onSuccess={() => setWarrantyRowModal(null)}
        />
      ) : null}
    </div>
  );
}