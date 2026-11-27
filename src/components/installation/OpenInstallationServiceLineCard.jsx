"use client";

import Link from "next/link";
import ServiceRecordStatusInlineCell from "@/components/services/ServiceRecordStatusInlineCell";
import { OPEN_INSTALLATION_INLINE_STATUS_OPTIONS } from "@/lib/serviceRecordStatusPermissions";
import { OpenInstallationServiceReportButtons } from "@/components/installation/OpenInstallationReportButton";
import { patchOpenInstallationRowService } from "@/components/installation/OpenInstallationStatusColumn";

function itemToServiceRecord(item, row) {
  const scheduled =
    item.scheduledDate && item.scheduledDate !== "—" ? item.scheduledDate : null;
  const completed =
    item.completedDate && item.completedDate !== "—"
      ? item.completedDate
      : row.installed_date || row.completed_date || null;
  return {
    service_id: item.serviceId,
    status: item.status && item.status !== "—" ? item.status : "PENDING",
    planned_date: scheduled,
    completed_date: completed,
    status_description: item.statusDescription || "",
    assigned_to:
      item.assignedTo && item.assignedTo !== "—"
        ? item.assignedTo
        : row.service_engineer || "NOT ASSIGNED",
    third_party_engineer_id: row.third_party_engineer_id,
    assigned_to_id: row.assigned_to_id,
    assigned_to_type: row.assigned_to_type,
  };
}

function statusBadgeClass(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "COMPLETED" || s === "WORKED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (s === "PLANNED" || s === "PENDING" || s === "IN PROGRESS") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function OpenInstallationServiceLineTableRow({
  row,
  line,
  dashboardBase = "",
  role,
  onRowPatched,
  showStatusEditor = false,
  showSerial = false,
}) {
  const detail = line.serviceDetail;
  const serviceId = line.serviceId;

  const handlePatch = (patch) => {
    onRowPatched?.(patchOpenInstallationRowService(row, serviceId, patch));
  };

  return (
    <tr className="border-t border-slate-200 align-top hover:bg-slate-50/80">
      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-violet-700">
        {dashboardBase ? (
          <Link
            href={`/${dashboardBase}/complete-service/${encodeURIComponent(serviceId)}`}
            className="hover:underline"
          >
            {serviceId}
          </Link>
        ) : (
          serviceId
        )}
      </td>
      {showSerial ? (
        <td className="max-w-[8rem] px-3 py-2.5 font-mono text-[11px] text-amber-900">
          {line.serial || "—"}
        </td>
      ) : null}
      <td className="min-w-[12rem] px-3 py-2.5 text-slate-800">
        {line.productCode ? (
          <span className="mr-1.5 inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
            {line.productCode}
          </span>
        ) : null}
        <span className="text-xs leading-snug">{line.productName || "—"}</span>
      </td>
      <td className="min-w-[10rem] px-3 py-2.5">
        {showStatusEditor && role ? (
          <ServiceRecordStatusInlineCell
            record={itemToServiceRecord(detail, row)}
            role={role}
            serviceIdLabel={`ID: ${serviceId}`}
            statusOptions={OPEN_INSTALLATION_INLINE_STATUS_OPTIONS}
            onRecordUpdated={handlePatch}
          />
        ) : (
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(line.status)}`}
          >
            {line.status || "PENDING"}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        {dashboardBase ? (
          <OpenInstallationServiceReportButtons
            row={row}
            dashboardBase={dashboardBase}
            serviceId={serviceId}
            reportIds={line.reportIds}
            compactLabel
            labelPrefix="Report"
          />
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

export default function OpenInstallationServiceLineCard({
  row,
  line,
  dashboardBase = "",
  role,
  onRowPatched,
  showStatusEditor = false,
  showSerial = false,
}) {
  const detail = line.serviceDetail;
  const serviceId = line.serviceId;

  const handlePatch = (patch) => {
    onRowPatched?.(patchOpenInstallationRowService(row, serviceId, patch));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-purple-700">Service ID:</span>{" "}
            {dashboardBase ? (
              <Link
                href={`/${dashboardBase}/complete-service/${encodeURIComponent(serviceId)}`}
                className="font-bold text-violet-700 hover:underline"
              >
                {serviceId}
              </Link>
            ) : (
              <span className="font-bold text-slate-900">{serviceId}</span>
            )}
          </div>
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Product:</span>{" "}
            <span className="font-medium text-slate-900">
              {line.productCode ? (
                <span className="mr-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-bold">
                  {line.productCode}
                </span>
              ) : null}
              {line.productName || "—"}
            </span>
          </div>
          {showSerial && line.serial ? (
            <div className="font-mono text-[11px] text-amber-900">
              <span className="font-semibold text-amber-800">S/N:</span> {line.serial}
            </div>
          ) : null}
        </div>
        {dashboardBase ? (
          <OpenInstallationServiceReportButtons
            row={row}
            dashboardBase={dashboardBase}
            serviceId={serviceId}
            reportIds={line.reportIds}
            compactLabel
            labelPrefix="Report"
          />
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Status
        </p>
        {showStatusEditor && role ? (
          <ServiceRecordStatusInlineCell
            record={itemToServiceRecord(detail, row)}
            role={role}
            serviceIdLabel={`ID: ${serviceId}`}
            statusOptions={OPEN_INSTALLATION_INLINE_STATUS_OPTIONS}
            onRecordUpdated={handlePatch}
          />
        ) : (
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${statusBadgeClass(line.status)}`}
          >
            {line.status || "PENDING"}
          </span>
        )}
      </div>
    </div>
  );
}