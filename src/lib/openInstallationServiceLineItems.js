import { parseOpenInstallationDispatchItems } from "@/lib/openInstallationDispatchItems";
import {
  listUpcomingInstallationServiceIds,
  parseUpcomingInstallationServiceDetails,
} from "@/components/installation/UpcomingInstallationServiceStatusColumn";

export function listOpenInstallationSerialNumbers(record) {
  const raw = String(record?.serial_number || "").trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,|;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Align service IDs, products, serials, and service_details by row index. */
export function buildOpenInstallationServiceLineItems(row) {
  const details = parseUpcomingInstallationServiceDetails(row?.service_details);
  const detailById = new Map(
    details.map((d) => [String(d.serviceId || "").trim(), d]).filter(([id]) => id),
  );

  const serviceIds = listUpcomingInstallationServiceIds(row);
  const ids =
    serviceIds.length > 0
      ? serviceIds
      : details.map((d) => String(d.serviceId || "").trim()).filter(Boolean);

  const products = parseOpenInstallationDispatchItems(row?.model, row?.name);
  const serials = listOpenInstallationSerialNumbers(row);
  const fallbackName = String(row?.product_name || row?.name || "").trim();

  const count = Math.max(ids.length, products.length, serials.length, details.length);
  if (count === 0) return [];

  const lines = [];
  for (let i = 0; i < count; i += 1) {
    const serviceId = ids[i] || details[i]?.serviceId || "";
    if (!serviceId) continue;

    const detail = detailById.get(serviceId) ||
      details[i] || {
        serviceId,
        status: row?.status || "PENDING",
        scheduledDate: "—",
        assignedTo: "—",
        statusDescription: "",
        completedDate: "",
      };

    const product = products[i] || {};
    const productName =
      product.name ||
      product.code ||
      products[0]?.name ||
      fallbackName ||
      "—";

    lines.push({
      serviceId,
      productCode: product.code || "",
      productName,
      serial: serials[i] || "",
      status: detail.status && detail.status !== "—" ? detail.status : "PENDING",
      serviceDetail: detail,
      reportIds: listOpenInstallationReportIdsForService(row, serviceId),
    });
  }

  return lines;
}

/** `235803:12,13;;235268:14` → report ids for one service_id. */
export function parseOpenInstallationServiceReportIds(raw) {
  const map = new Map();
  for (const part of String(raw || "").split(";;")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    const serviceId = (colon === -1 ? trimmed : trimmed.slice(0, colon)).trim();
    const idsRaw = colon === -1 ? "" : trimmed.slice(colon + 1);
    if (!serviceId) continue;
    const ids = idsRaw
      .split(",")
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (!ids.length) continue;
    const prev = map.get(serviceId) || [];
    map.set(serviceId, [...new Set([...prev, ...ids])]);
  }
  return map;
}

export function listOpenInstallationReportIdsForService(row, serviceId) {
  const id = String(serviceId || "").trim();
  if (!id) return [];
  return parseOpenInstallationServiceReportIds(row?.service_report_ids).get(id) || [];
}