"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import ServiceAttachmentLink from "@/components/services/ServiceAttachmentLink";
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

function openInstallationServiceReportCompleted(row, serviceId) {
  const items = parseUpcomingInstallationServiceDetails(row?.service_details);
  const id = String(serviceId || "").trim();
  const match = items.find((it) => it.serviceId === id);
  if (match && String(match.status || "").trim().toUpperCase() === "COMPLETED") {
    return true;
  }
  return (
    items.some((it) => String(it.status || "").trim().toUpperCase() === "COMPLETED") ||
    Number(row?.order_installation_status) === 1
  );
}

function openInstallationReportAttachment(row) {
  const finalPath = String(row.final_report_path || "").trim();
  if (finalPath) {
    return {
      kind: "external",
      href: finalPath.startsWith("http")
        ? finalPath
        : `https://service.dynacleanindustries.com/${finalPath.replace(/^\/+/, "")}`,
    };
  }
  const inst = String(row.installation_report || "").trim();
  if (!inst || inst === "uploadFO") return null;
  const files = inst
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!files.length) return null;
  return { kind: "file", path: files[0] };
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
  const items = parseUpcomingInstallationServiceDetails(row?.service_details);
  const serviceId = serviceIdProp || openInstallationPrimaryServiceId(row);
  const item = items.find((it) => it.serviceId === serviceId);
  const attachment =
    serviceIdProp || items.length <= 1 ? openInstallationReportAttachment(row) : null;

  const label =
    compactLabel && serviceId ? `${labelPrefix} ${serviceId}` : "Installation Report";

  if (attachment?.kind === "external") {
    return (
      <a
        href={attachment.href}
        target="_blank"
        rel="noopener noreferrer"
        className={openInstallationReportBtnClass}
      >
        <FileText className="h-3 w-3 shrink-0" aria-hidden />
        {label}
      </a>
    );
  }

  if (attachment?.kind === "file") {
    return (
      <ServiceAttachmentLink
        filePath={attachment.path}
        fileName={label}
        className={openInstallationReportBtnClass}
      />
    );
  }

  if (!serviceId || !dashboardBase) {
    return null;
  }

  const instFlag = String(row.installation_report || "").trim();
  const itemCompleted =
    item && String(item.status || "").trim().toUpperCase() === "COMPLETED";
  const reportDone =
    itemCompleted ||
    openInstallationServiceReportCompleted(row, serviceId) ||
    instFlag === "uploadFO";

  if (reportDone) {
    return (
      <Link
        href={`/${dashboardBase}/complete-service/${encodeURIComponent(serviceId)}`}
        className={openInstallationReportBtnClass}
      >
        <FileText className="h-3 w-3 shrink-0" aria-hidden />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={`/${dashboardBase}/installation-completion-video/${encodeURIComponent(serviceId)}`}
      className="inline-flex items-center gap-1 rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white whitespace-nowrap hover:bg-slate-700"
    >
      <FileText className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}