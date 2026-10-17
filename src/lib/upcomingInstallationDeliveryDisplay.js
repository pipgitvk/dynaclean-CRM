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
