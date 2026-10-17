export function installationStatusDateColor(status) {
  if (status === "overdue") return "text-red-600 font-bold";
  if (status === "upcoming") return "text-orange-600 font-bold";
  return "text-gray-800";
}

export function hasActualDeliveryDate(record) {
  const raw = record?.delivered_on;
  if (raw == null) return false;
  const s = String(raw).trim();
  return s !== "" && s !== "0000-00-00" && s !== "0";
}

/** Row background: green when actual delivery is recorded. */
export function getUpcomingInstallationRowClass(record) {
  if (hasActualDeliveryDate(record)) return "bg-green-100";
  const status = record?.installation_status;
  if (status === "overdue") return "bg-red-100";
  if (status === "upcoming") return "bg-yellow-100";
  return "bg-white";
}

/** completed | late | incoming | scheduled — matches row background rules. */
export function getUpcomingInstallationStatusBucket(record) {
  if (hasActualDeliveryDate(record)) return "completed";
  const status = record?.installation_status;
  if (status === "overdue") return "late";
  if (status === "upcoming") return "incoming";
  return "scheduled";
}

export function matchesUpcomingInstallationStatusFilter(record, statusFilter) {
  const f = statusFilter || "all";
  if (f === "all") return true;
  return getUpcomingInstallationStatusBucket(record) === f;
}

/** Expected delivery date, or actual delivered_on in green when set. */
export function getUpcomingInstallationDeliveryDisplay(record) {
  if (hasActualDeliveryDate(record)) {
    return {
      text: record.delivered_on,
      className: "text-green-600 font-bold",
    };
  }
  return {
    text: record.delivery_date,
    className: installationStatusDateColor(record.installation_status),
  };
}
