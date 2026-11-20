"use client";

import ServiceRecordStatusInlineCell from "@/components/services/ServiceRecordStatusInlineCell";
import { OPEN_INSTALLATION_INLINE_STATUS_OPTIONS } from "@/lib/serviceRecordStatusPermissions";
import { formatCrmDateOnly } from "@/lib/crmDateFormat";
import {
  parseUpcomingInstallationServiceDetails,
  serializeUpcomingInstallationServiceDetails,
} from "@/components/installation/UpcomingInstallationServiceStatusColumn";

export function patchOpenInstallationRowService(
  row,
  serviceId,
  patch,
) {
  const items = parseUpcomingInstallationServiceDetails(row?.service_details);
  let matched = false;
  const nextItems = items.map((it) => {
    if (it.serviceId !== serviceId) return it;
    matched = true;
    return {
      ...it,
      status: patch.status ?? it.status,
      scheduledDate:
        patch.planned_date != null
          ? patch.planned_date || "—"
          : it.scheduledDate,
      assignedTo: patch.assigned_to ?? it.assignedTo,
      statusDescription: patch.status_description ?? it.statusDescription,
    };
  });

  if (!matched && String(row?.service_id || "").trim() === String(serviceId)) {
    return {
      ...row,
      ...patch,
    };
  }

  const next = {
    ...row,
    service_details: serializeUpcomingInstallationServiceDetails(nextItems),
  };
  if (patch.engineer_assigned_by) {
    next.assigned_by = patch.engineer_assigned_by;
  }
  return next;
}

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

export default function OpenInstallationStatusColumn({
  row,
  role,
  onRowPatched,
}) {
  const items = parseUpcomingInstallationServiceDetails(row?.service_details);
  const orderInstallationDone = Number(row?.order_installation_status) === 1;

  const handlePatch = (serviceId, patch) => {
    onRowPatched?.(patchOpenInstallationRowService(row, serviceId, patch));
  };

  if (items.length === 0) {
    const fallbackId = String(row?.service_id || "").trim();
    const installedLabel =
      row.installed_date || row.completed_date || row.installation_date || null;
    if (!fallbackId) {
      if (orderInstallationDone) {
        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              Completed (order)
            </span>
            {installedLabel ? (
              <span className="text-[10px] font-medium text-emerald-700">
                Installed: {formatCrmDateOnly(installedLabel, String(installedLabel).slice(0, 10))}
              </span>
            ) : null}
          </div>
        );
      }
      return <span className="text-xs text-slate-400">—</span>;
    }
    const rec = {
      service_id: fallbackId,
      status: row.status || "PENDING",
      planned_date: row.planned_date || null,
      completed_date: row.completed_date || installedLabel,
      status_description: row.status_description || "",
      assigned_to: row.service_engineer || row.assigned_to || "NOT ASSIGNED",
      third_party_engineer_id: row.third_party_engineer_id,
      assigned_to_id: row.assigned_to_id,
      assigned_to_type: row.assigned_to_type,
    };
    return (
      <ServiceRecordStatusInlineCell
        record={rec}
        role={role}
        serviceIdLabel={`ID: ${fallbackId}`}
        statusOptions={OPEN_INSTALLATION_INLINE_STATUS_OPTIONS}
        onRecordUpdated={(patch) => handlePatch(fallbackId, patch)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ServiceRecordStatusInlineCell
          key={item.serviceId}
          record={itemToServiceRecord(item, row)}
          role={role}
          serviceIdLabel={`ID: ${item.serviceId}`}
          statusOptions={OPEN_INSTALLATION_INLINE_STATUS_OPTIONS}
          onRecordUpdated={(patch) => handlePatch(item.serviceId, patch)}
        />
      ))}
    </div>
  );
}