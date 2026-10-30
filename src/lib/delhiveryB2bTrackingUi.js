import dayjs from "dayjs";

/** Safe string for React text nodes (empty objects are truthy in JS). */
export function delhiveryDisplayText(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") {
    if (value instanceof Date) {
      const d = dayjs(value);
      return d.isValid() ? d.format("DD MMM YYYY, hh:mm A") : fallback;
    }
    if (Array.isArray(value)) {
      const s = value.map((v) => delhiveryDisplayText(v, "")).filter(Boolean).join(", ");
      return s || fallback;
    }
    const keys = Object.keys(value);
    if (keys.length === 0) return fallback;
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  const s = String(value).trim();
  return s === "" ? fallback : s;
}

export function formatDelhiveryTimelineDate(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object" && !(value instanceof Date)) return "";
  const d = dayjs(value);
  if (!d.isValid()) return delhiveryDisplayText(value, "");
  return d.format("ddd, D MMM, h:mm A");
}

export function formatDelhiveryDateTime(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object" && !(value instanceof Date)) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD MMM YYYY, hh:mm A") : delhiveryDisplayText(value);
}

export function formatDelhiveryWeight(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} t (${n.toLocaleString("en-IN")} kg)`;
  }
  return `${n.toLocaleString("en-IN")} kg`;
}

export function orderStatusHeadline(status) {
  const raw = delhiveryDisplayText(status, "")
    .replace(/_/g, " ");
  if (!raw) return "Order status";
  const upper = raw.toUpperCase();
  if (upper === "DELIVERED") return "Order Delivered";
  if (/\bOUT\s+FOR\s+DELIVERY\b/i.test(upper)) return "Order Out for Delivery";
  if (upper.includes("TRANSIT")) return "Order In Transit";
  if (upper.includes("DISPATCH")) return "Order Dispatched";
  return `Order ${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()}`;
}

/** Normalize Delhivery status strings (LEFT_ORIGIN → LEFT ORIGIN). */
export function normalizeDelhiveryStatus(status) {
  return String(status || "")
    .trim()
    .toUpperCase()
    .replace(/_/g, " ");
}

export function isDelhiveryOutForDelivery(status, scanRemark = "") {
  const upper = normalizeDelhiveryStatus(status);
  const remark = String(scanRemark || "").toLowerCase();
  if (/\bOUT\s+FOR\s+DELIVERY\b/.test(upper)) return true;
  if (remark.includes("out for delivery")) return true;
  if (remark.includes("out for") && !remark.includes("not out for")) return true;
  return false;
}

/** True only when shipment is actually delivered — not “out for delivery” / “undelivered”. */
export function isDelhiveryShipmentDelivered(status, deliveredDate) {
  if (toValidIso(deliveredDate)) return true;
  const upper = normalizeDelhiveryStatus(status);
  if (!upper) return false;
  if (/\b(NOT|UN|NON)\s*DELIVERED\b/.test(upper)) return false;
  if (/\bUNDELIVERED\b/.test(upper)) return false;
  if (isDelhiveryOutForDelivery(status)) return false;
  if (upper === "DELIVERED") return true;
  return /\bDELIVERED\b/.test(upper);
}

/** Fixed shipment milestones (always show exactly these four). */
export const DELHIVERY_TRACKING_MILESTONES = [
  { key: "pickup", label: "Picked Up" },
  { key: "transit", label: "On the Way" },
  { key: "ofd", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

function toValidIso(value) {
  if (value == null || value === "") return null;
  const t = dayjs(value);
  return t.isValid() ? t.toISOString() : null;
}

/** Milestones for Tracking tab from B2B track API payload — always 4 steps. */
export function buildDelhiveryTrackingTimeline(data) {
  const empty = () =>
    DELHIVERY_TRACKING_MILESTONES.map((m) => ({
      ...m,
      at: null,
      state: "pending",
      footnote: null,
      highlight: false,
    }));

  if (!data || typeof data !== "object") return empty();

  const status = String(data.status || "").toUpperCase();
  const delivered = isDelhiveryShipmentDelivered(data.status, data.delivered_date);
  const remark = String(data.scan_remark || "").trim();
  const lastScan = data.timestamp;

  const dates = {
    pickup: toValidIso(data.pickup_date),
    transit: null,
    ofd: null,
    delivered: null,
  };

  if (data.manifested_date) {
    const manifest = dayjs(data.manifested_date);
    const pickup = dayjs(data.pickup_date);
    if (
      !pickup.isValid() ||
      manifest.isAfter(pickup) ||
      manifest.isSame(pickup, "day")
    ) {
      dates.transit = toValidIso(data.manifested_date);
    }
  }

  const deliveredAt = data.delivered_date || (delivered ? lastScan : null);

  if (delivered && lastScan && deliveredAt) {
    const scanT = dayjs(lastScan);
    const delT = dayjs(deliveredAt);
    if (scanT.isValid() && delT.isValid() && scanT.isBefore(delT.subtract(5, "minute"))) {
      dates.ofd = toValidIso(lastScan);
    } else if (delT.isValid()) {
      dates.ofd = toValidIso(delT.subtract(4, "hour"));
    }
    dates.delivered = toValidIso(deliveredAt || lastScan);
  } else if (!delivered && lastScan) {
    if (isDelhiveryOutForDelivery(data.status, remark)) {
      dates.ofd = toValidIso(lastScan);
    } else {
      dates.transit = dates.transit || toValidIso(lastScan);
    }
  }

  if (delivered && !dates.delivered) {
    dates.delivered = toValidIso(deliveredAt || lastScan);
  }

  let activeIndex = 0;
  if (delivered) {
    activeIndex = 3;
  } else if (dates.ofd || isDelhiveryOutForDelivery(data.status, remark)) {
    activeIndex = 2;
  } else if (dates.transit || lastScan) {
    activeIndex = 1;
  } else if (dates.pickup) {
    activeIndex = 1;
  }

  return DELHIVERY_TRACKING_MILESTONES.map((m, idx) => {
    let state = "pending";
    if (delivered) {
      state = idx < 3 ? "completed" : "active";
    } else if (idx < activeIndex) {
      state = "completed";
    } else if (idx === activeIndex) {
      state = "active";
    }

    let at = dates[m.key];
    if (state === "active" && !at && (m.key === "transit" || m.key === "ofd")) {
      at = toValidIso(lastScan);
    }
    if (state === "pending") at = null;

    let footnote = null;
    if (state === "active") {
      if (m.key === "delivered" && delivered) {
        footnote = "Your order has been delivered";
      } else if (remark && (m.key === "transit" || m.key === "ofd")) {
        footnote = remark;
      }
    }

    return {
      ...m,
      at,
      state,
      footnote,
      highlight: state === "active",
    };
  });
}

export const DELHIVERY_ORDER_DETAIL_FIELDS = [
  { key: "scan_remark", label: "Latest remark" },
  { key: "location", label: "Current location" },
  { key: "timestamp", label: "Last scan time", format: formatDelhiveryDateTime },
  { key: "client_name", label: "Client" },
  { key: "origin_city", label: "Origin city" },
  { key: "origin_branch", label: "Origin branch" },
  { key: "destination_city", label: "Destination city" },
  { key: "destination_branch", label: "Destination branch" },
  { key: "pickup_date", label: "Pickup date", format: formatDelhiveryDateTime },
  { key: "manifested_date", label: "Manifested", format: formatDelhiveryDateTime },
  {
    key: "estimated_date",
    label: "Estimated delivery",
    format: formatDelhiveryDateTime,
  },
  {
    key: "promised_delivery_date",
    label: "Promised delivery",
    format: formatDelhiveryDateTime,
  },
  { key: "delivered_date", label: "Delivered", format: formatDelhiveryDateTime },
  { key: "total_weight", label: "Total weight", format: formatDelhiveryWeight },
  { key: "count", label: "Package count" },
];

/** Grouped sections for Order Details tab UI. */
export const DELHIVERY_ORDER_DETAIL_SECTIONS = [
  {
    id: "status",
    title: "Latest update",
    fields: [
      { key: "scan_remark", label: "Remark" },
      { key: "location", label: "Location" },
      { key: "timestamp", label: "Last scan", format: formatDelhiveryDateTime },
    ],
  },
  {
    id: "route",
    title: "Route",
    route: true,
    fields: [
      { key: "origin_city", label: "Origin city" },
      { key: "origin_branch", label: "Origin branch" },
      { key: "destination_city", label: "Destination city" },
      { key: "destination_branch", label: "Destination branch" },
    ],
  },
  {
    id: "schedule",
    title: "Dates",
    columns: 2,
    fields: [
      { key: "pickup_date", label: "Pickup", format: formatDelhiveryDateTime },
      { key: "manifested_date", label: "Manifested", format: formatDelhiveryDateTime },
      {
        key: "estimated_date",
        label: "Estimated",
        format: formatDelhiveryDateTime,
      },
      {
        key: "promised_delivery_date",
        label: "Promised",
        format: formatDelhiveryDateTime,
      },
      { key: "delivered_date", label: "Delivered", format: formatDelhiveryDateTime },
    ],
  },
  {
    id: "shipment",
    title: "Shipment info",
    columns: 2,
    fields: [
      { key: "client_name", label: "Client" },
      { key: "count", label: "Packages" },
      { key: "total_weight", label: "Weight", format: formatDelhiveryWeight },
    ],
  },
];

export function delhiveryStatusBadgeClass(status) {
  const upper = normalizeDelhiveryStatus(status);
  if (isDelhiveryShipmentDelivered(status, null)) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  if (isDelhiveryOutForDelivery(status)) {
    return "bg-amber-100 text-amber-900 ring-amber-200";
  }
  if (upper.includes("TRANSIT") || upper.includes("DISPATCH") || upper.includes("ORIGIN")) {
    return "bg-amber-100 text-amber-900 ring-amber-200";
  }
  if (upper.includes("RTO") || upper.includes("CANCEL")) {
    return "bg-red-100 text-red-800 ring-red-200";
  }
  return "bg-slate-100 text-slate-800 ring-slate-200";
}

export function formatDelhiveryStatusLabel(status) {
  const raw = delhiveryDisplayText(status, "")
    .replace(/_/g, " ");
  if (!raw) return "Unknown";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
