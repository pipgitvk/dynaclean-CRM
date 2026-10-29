import dayjs from "dayjs";

export function formatDelhiveryTimelineDate(value) {
  if (value == null || value === "") return "";
  const d = dayjs(value);
  if (!d.isValid()) return String(value);
  return d.format("ddd, D MMM, h:mm A");
}

export function formatDelhiveryDateTime(value) {
  if (value == null || value === "") return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD MMM YYYY, hh:mm A") : String(value);
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
  const raw = String(status || "")
    .trim()
    .replace(/_/g, " ");
  if (!raw) return "Order status";
  const upper = raw.toUpperCase();
  if (upper === "DELIVERED") return "Order Delivered";
  if (upper.includes("TRANSIT")) return "Order In Transit";
  if (upper.includes("DISPATCH")) return "Order Dispatched";
  return `Order ${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()}`;
}

/** Milestones for Tracking tab from B2B track API payload. */
export function buildDelhiveryTrackingTimeline(data) {
  if (!data || typeof data !== "object") return [];

  const status = String(data.status || "").toUpperCase();
  const delivered = status.includes("DELIVER");
  const steps = [];

  const push = (label, at, extra = {}) => {
    if (!at) return;
    const t = dayjs(at);
    if (!t.isValid()) return;
    steps.push({ label, at: t.toISOString(), ...extra });
  };

  push("Picked Up", data.pickup_date, { key: "pickup" });

  if (data.manifested_date) {
    const manifest = dayjs(data.manifested_date);
    const pickup = dayjs(data.pickup_date);
    if (
      !pickup.isValid() ||
      manifest.isAfter(pickup) ||
      manifest.isSame(pickup, "day")
    ) {
      push("On the Way", data.manifested_date, { key: "transit" });
    }
  }

  const lastScan = data.timestamp;
  const deliveredAt = data.delivered_date || (delivered ? lastScan : null);

  if (delivered && lastScan && deliveredAt) {
    const scanT = dayjs(lastScan);
    const delT = dayjs(deliveredAt);
    if (scanT.isValid() && delT.isValid() && scanT.isBefore(delT.subtract(5, "minute"))) {
      push("Out for Delivery", lastScan, { key: "ofd" });
    } else if (delT.isValid()) {
      push("Out for Delivery", delT.subtract(4, "hour"), { key: "ofd" });
    }
  } else if (!delivered && lastScan) {
    const remark = String(data.scan_remark || "").toLowerCase();
    if (remark.includes("out for") || remark.includes("dispatch")) {
      push("Out for Delivery", lastScan, { key: "ofd" });
    } else {
      push("On the Way", lastScan, { key: "transit" });
    }
  }

  if (delivered) {
    push("Delivered", deliveredAt || lastScan, {
      key: "delivered",
      footnote: "Your order has been delivered",
      highlight: true,
    });
  } else if (status) {
    push(
      String(data.status).replace(/_/g, " "),
      lastScan || data.estimated_date,
      { key: "current", highlight: true },
    );
  }

  const seen = new Set();
  const unique = [];
  for (const step of steps.sort(
    (a, b) => dayjs(a.at).valueOf() - dayjs(b.at).valueOf(),
  )) {
    const dedupeKey = `${step.label}|${dayjs(step.at).format("YYYY-MM-DD HH:mm")}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    unique.push(step);
  }

  return unique;
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
  const upper = String(status || "")
    .trim()
    .toUpperCase();
  if (upper.includes("DELIVER")) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  if (upper.includes("TRANSIT") || upper.includes("DISPATCH")) {
    return "bg-amber-100 text-amber-900 ring-amber-200";
  }
  if (upper.includes("RTO") || upper.includes("CANCEL")) {
    return "bg-red-100 text-red-800 ring-red-200";
  }
  return "bg-slate-100 text-slate-800 ring-slate-200";
}

export function formatDelhiveryStatusLabel(status) {
  const raw = String(status || "").trim().replace(/_/g, " ");
  if (!raw) return "Unknown";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
