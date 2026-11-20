export const SERVICE_RECORD_INLINE_STATUS_OPTIONS = [
  "PENDING",
  "PLANNED",
  "PENDING FOR SPARES",
  "PENDING BY CUSTOMER",
  "COMPLETED",
  "CANCELLED",
  "WORKED",
  "IN PROGRESS",
];

/** Open Installation — status change dropdown (no Cancelled). */
export const OPEN_INSTALLATION_INLINE_STATUS_OPTIONS =
  SERVICE_RECORD_INLINE_STATUS_OPTIONS.filter((s) => s !== "CANCELLED");

export function plannedDateForInput(value) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function thirdPartyIdFromRecord(record) {
  const tpId =
    record?.third_party_engineer_id ??
    (record?.assigned_to_type === "third_party" ? record?.assigned_to_id : null);
  return tpId != null && tpId !== "" ? String(tpId) : "";
}

export function canChangeServiceStatus(role, record) {
  if (record?.status?.toUpperCase() === "COMPLETED") return false;
  const roleNorm = String(role ?? "").trim().toUpperCase();
  return (
    roleNorm === "ADMIN" ||
    roleNorm === "SUPERADMIN" ||
    roleNorm === "TEAM LEADER" ||
    roleNorm === "SERVICE HEAD" ||
    roleNorm === "SERVICE SUPPORT" ||
    roleNorm === "SERVICE ENGINEER" ||
    roleNorm.includes("SERVICE ENGINEER") ||
    roleNorm === "THIRD PARTY ENGINEER"
  );
}

export function canAssignServiceEngineer(role) {
  const roleNorm = String(role ?? "").trim().toUpperCase();
  return (
    roleNorm === "ADMIN" ||
    roleNorm === "SUPERADMIN" ||
    roleNorm === "TEAM LEADER" ||
    roleNorm === "SERVICE HEAD" ||
    roleNorm === "SERVICE SUPPORT" ||
    roleNorm === "SALES CUM BACKOFFICE"
  );
}

export async function fetchActiveEngineerOptions(record) {
  const [repsRes, tpRes] = await Promise.all([
    fetch("/api/service-engineers/active"),
    fetch("/api/third-party-engineers/active"),
  ]);
  const repsData = await repsRes.json();
  let internalNames =
    repsData.users?.map((u) => u.username).filter(Boolean) || [];
  const currentInternal = record?.assigned_to;
  if (
    currentInternal &&
    currentInternal !== "NOT ASSIGNED" &&
    !internalNames.includes(currentInternal)
  ) {
    internalNames = [currentInternal, ...internalNames];
  }
  const tpData = await tpRes.json().catch(() => []);
  const thirdPartyEngineers = Array.isArray(tpData) ? tpData : [];
  return { internalNames, thirdPartyEngineers };
}

export async function applyServiceStatusUpdate({
  service_id,
  status,
  description = "",
  planned_date = null,
}) {
  const newStatus = String(status || "").trim();
  const requiresDescription = newStatus.toUpperCase() === "PENDING BY CUSTOMER";
  const desc = (description || "").trim();
  const isPlanned = newStatus.toUpperCase() === "PLANNED";
  const plannedDate = isPlanned ? (planned_date || "").trim() : null;

  if (!service_id || !newStatus) {
    throw new Error("Please select a status.");
  }
  if (requiresDescription && !desc) {
    throw new Error("Description is required when status is PENDING BY CUSTOMER.");
  }
  if (isPlanned && !plannedDate) {
    throw new Error("Please select a planned date.");
  }

  const res = await fetch("/api/service-status/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id,
      status: newStatus,
      description: requiresDescription ? desc : desc || null,
      planned_date: isPlanned ? plannedDate : null,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to update status.");
  }
}

export async function assignServiceRecordEngineer(
  serviceId,
  assignedTo,
  thirdPartyEngineerId,
) {
  const res = await fetch("/api/service-status/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      assigned_to: assignedTo,
      third_party_engineer_id: thirdPartyEngineerId || null,
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || "Failed to assign.");
  }
  return res.json().catch(() => ({}));
}