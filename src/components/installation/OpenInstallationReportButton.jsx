"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { parseUpcomingInstallationServiceDetails } from "@/components/installation/UpcomingInstallationServiceStatusColumn";
import { listOpenInstallationReportIdsForService } from "@/lib/openInstallationServiceLineItems";

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

export function openInstallationCompleteServiceHref(dashboardBase, serviceId, reportId) {
  const id = String(serviceId || "").trim();
  const base = String(dashboardBase || "").trim();
  if (!id || !base) return "";
  const href = `/${base}/complete-service/${encodeURIComponent(id)}`;
  const rid = String(reportId || "").trim();
  return rid ? `${href}?reportId=${encodeURIComponent(rid)}` : href;
}

const openInstallationReportBtnClass =
  "inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white whitespace-nowrap hover:bg-emerald-800";

export default function OpenInstallationReportButton({
  row,
  dashboardBase,
  serviceId: serviceIdProp,
  reportId = "",
  compactLabel = false,
  labelPrefix = "Report",
  label,
}) {
  const serviceId = serviceIdProp || openInstallationPrimaryServiceId(row);
  const href = openInstallationCompleteServiceHref(dashboardBase, serviceId, reportId);
  if (!href) return null;

  const text =
    label ||
    (compactLabel && serviceId ? `${labelPrefix} ${serviceId}` : "Installation Report");

  return (
    <Link href={href} className={openInstallationReportBtnClass}>
      <FileText className="h-3 w-3 shrink-0" aria-hidden />
      {text}
    </Link>
  );
}

/** One complete-service button per saved installation report on this service_id. */
export function OpenInstallationServiceReportButtons({
  row,
  dashboardBase,
  serviceId: serviceIdProp,
  compactLabel = true,
  labelPrefix = "Report",
  reportIds: reportIdsProp,
}) {
  const serviceId = serviceIdProp || openInstallationPrimaryServiceId(row);
  const reportIds =
    Array.isArray(reportIdsProp) && reportIdsProp.length
      ? reportIdsProp
      : listOpenInstallationReportIdsForService(row, serviceId);
  const items = reportIds.length ? reportIds : [""];
  const many = items.length > 1;

  return (
    <div className="flex flex-col items-stretch gap-1">
      {items.map((reportId, index) => (
        <OpenInstallationReportButton
          key={reportId || `report-${serviceId}-${index}`}
          row={row}
          dashboardBase={dashboardBase}
          serviceId={serviceId}
          reportId={reportId}
          compactLabel={compactLabel}
          labelPrefix={labelPrefix}
          label={many ? `Report ${index + 1}` : undefined}
        />
      ))}
    </div>
  );
}
