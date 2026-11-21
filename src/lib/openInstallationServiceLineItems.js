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
    });
  }

  return lines;
}