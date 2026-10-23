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

function parseYmdDate(value) {
  const s = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Days relative to today: from delivered_on when set, else API expected-date value. */
export function getUpcomingInstallationDays(record) {
  if (hasActualDeliveryDate(record)) {
    const delivered = parseYmdDate(record.delivered_on);
    if (delivered) {
      const today = startOfLocalDay(new Date());
      const del = startOfLocalDay(delivered);
      return Math.round((del - today) / 86400000);
    }
  }
  const n = Number(record?.days_until_installation);
  return Number.isFinite(n) ? n : 0;
}

export function formatUpcomingInstallationDays(record) {
  const days = getUpcomingInstallationDays(record);
  if (hasActualDeliveryDate(record)) {
    if (days === 0) return "Delivered today";
    if (days < 0) return `Delivered ${Math.abs(days)} days ago`;
    return `Delivered in ${days} days`;
  }
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Today";
  return `In ${days} days`;
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

export function formatUpcomingInstallationYmd(value) {
  const d = parseYmdDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function displayYmdOrRaw(value) {
  const formatted = formatUpcomingInstallationYmd(value);
  if (formatted !== "—") return formatted;
  const raw = value != null ? String(value).trim() : "";
  return raw || "—";
}

/** Scheduled expected delivery (neworder.delivery_date). */
export function getUpcomingInstallationExpectedDateDisplay(record) {
  return {
    text: displayYmdOrRaw(record?.delivery_date),
    className: installationStatusDateColor(record?.installation_status),
  };
}

/**
 * Compare expected vs actual delivery.
 * Delivered after expected → Delay; before → Early (calendar days).
 */
export function getUpcomingInstallationEarlyDelayDisplay(record) {
  if (!hasActualDeliveryDate(record)) {
    return { text: "—", className: "text-gray-400" };
  }
  const exp = parseYmdDate(record?.delivery_date);
  const del = parseYmdDate(record?.delivered_on);
  if (!exp || !del) {
    return { text: "—", className: "text-gray-400" };
  }
  const diffDays = Math.round(
    (startOfLocalDay(exp) - startOfLocalDay(del)) / 86400000,
  );
  if (diffDays === 0) {
    return {
      text: "On time (0 days)",
      className: "text-gray-700 font-medium",
    };
  }
  if (diffDays > 0) {
    return {
      text: `Early ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      className: "text-green-700 font-semibold",
    };
  }
  const late = Math.abs(diffDays);
  return {
    text: `Delay ${late} day${late === 1 ? "" : "s"}`,
    className: "text-red-600 font-semibold",
  };
}

/** Actual delivery when recorded (neworder.delivered_on). */
export function getUpcomingInstallationActualDeliveryDisplay(record) {
  if (!hasActualDeliveryDate(record)) {
    return { text: "—", className: "text-gray-400" };
  }
  return {
    text: displayYmdOrRaw(record.delivered_on),
    className: "text-green-600 font-bold",
  };
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
