"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { parseUpcomingInstallationServiceDetails } from "@/components/installation/UpcomingInstallationServiceStatusColumn";

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

export function openInstallationCompleteServiceHref(dashboardBase, serviceId) {
  const id = String(serviceId || "").trim();
  const base = String(dashboardBase || "").trim();
  if (!id || !base) return "";
  return `/${base}/complete-service/${encodeURIComponent(id)}`;
}

const openInstallationReportBtnClass =
  "inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white whitespace-nowrap hover:bg-emerald-800";

export default function OpenInstallationReportButton({
  row,
  dashboardBase,
  serviceId: serviceIdProp,
  compactLabel = false,
  labelPrefix = "Report",
}) {
  const serviceId = serviceIdProp || openInstallationPrimaryServiceId(row);
  const href = openInstallationCompleteServiceHref(dashboardBase, serviceId);
  if (!href) return null;

  const label =
    compactLabel && serviceId ? `${labelPrefix} ${serviceId}` : "Installation Report";

  return (
    <Link href={href} className={openInstallationReportBtnClass}>
      <FileText className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
