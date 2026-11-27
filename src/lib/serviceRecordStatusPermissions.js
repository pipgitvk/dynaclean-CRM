export const SERVICE_RECORD_INLINE_STATUS_OPTIONS = [
  "PENDING",
  "PLANNED",
  "PENDING FOR SPARES",
  "PENDING BY CUSTOMER",
  "CANCELLED",
  "WORKED",
  "IN PROGRESS",
];

/** Follow-up forms / API — COMPLETED stays available here. */
export const SERVICE_RECORD_FOLLOWUP_STATUS_OPTIONS = [
  ...SERVICE_RECORD_INLINE_STATUS_OPTIONS,
  "COMPLETED",
];

/** Open Installation — status change dropdown (no Cancelled). */
export const OPEN_INSTALLATION_INLINE_STATUS_OPTIONS =
  SERVICE_RECORD_INLINE_STATUS_OPTIONS.filter((s) => s !== "CANCELLED");

/** UI label for service_records.status (DB value unchanged). */
export function serviceRecordStatusDisplayLabel(status) {
  const key = String(status || "").trim().toUpperCase();
  if (key === "PENDING FOR SPARES") return "PENDING BY US";
  const raw = String(status || "").trim();
  return raw || "—";
}

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

function firstNonEmpty(...values) {
  for (const value of values) {
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

/** Installation assign payload — order / warranty fields already on the row. */
export function installationSiteFromRecord(record = {}) {
  return {
    installation_address: firstNonEmpty(
      record.installation_address,
      record.installed_address,
      record.installed_address_from_wp,
      record.delivery_address,
    ),
    site_person: firstNonEmpty(
      record.site_person,
      record.contact_person_from_wp,
      record.contact_person,
    ),
    site_email: firstNonEmpty(
      record.site_email,
      record.site_email_from_wp,
      record.email,
    ),
    site_contact: firstNonEmpty(record.site_contact, record.contact),
  };
}

export function installationSiteComplete(site) {
  return Boolean(
    firstNonEmpty(site?.installation_address) &&
      firstNonEmpty(site?.site_person) &&
      firstNonEmpty(site?.site_email) &&
      firstNonEmpty(site?.site_contact),
  );
}

export function canChangeServiceStatus(role, record) {
  if (record?.status?.toUpperCase() === "COMPLETED") return false;
  const roleNorm = String(role ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  return (
    roleNorm === "ADMIN" ||
    roleNorm === "SUPERADMIN" ||
    roleNorm === "DIRECTOR" ||
    roleNorm === "TEAM LEADER" ||
    roleNorm === "SERVICE HEAD" ||
    roleNorm === "SERVICE SUPPORT" ||
    roleNorm === "SALES CUM BACKOFFICE" ||
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
  installationSite = null,
) {
  const body = {
    service_id: serviceId,
    assigned_to: assignedTo,
    third_party_engineer_id: thirdPartyEngineerId || null,
  };
  const site = installationSite || {};
  if (
    site.installation_address ||
    site.site_person ||
    site.site_email ||
    site.site_contact
  ) {
    body.installation_address = site.installation_address || "";
    body.site_person = site.site_person || "";
    body.site_email = site.site_email || "";
    body.site_contact = site.site_contact || "";
  }
  const res = await fetch("/api/service-status/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || "Failed to assign.");
  }
  return res.json().catch(() => ({}));
}