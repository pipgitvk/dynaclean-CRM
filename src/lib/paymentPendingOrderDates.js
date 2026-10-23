import dayjs from "dayjs";

function toDayjs(value) {
  if (value == null || value === "") return null;
  const d = dayjs(value);
  return d.isValid() ? d.startOf("day") : null;
}

/** Unique calendar dates (YYYY-MM-DD), ascending. */
export function uniqueSortedDateStrings(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const d = toDayjs(raw);
    if (!d) continue;
    const key = d.format("YYYY-MM-DD");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/** Actual delivery only: neworder.delivered_on + order_delivery_batches.delivered_on */
export function collectOrderDeliveryDateStrings({
  deliveredOn,
  deliveryBatchDates = [],
}) {
  return uniqueSortedDateStrings([deliveredOn, ...deliveryBatchDates]);
}

/** Latest date used to compute payment due date. */
export function pickDeliveryAnchorForDueDate(deliveryDateStrings) {
  const list = deliveryDateStrings || [];
  if (!list.length) return null;
  return list[list.length - 1];
}

export function computeDueDateFromDeliveryAndTerms(
  deliveryAnchorYmd,
  paymentTermDays,
) {
  const anchor = toDayjs(deliveryAnchorYmd);
  if (!anchor) return null;
  const days = Number(paymentTermDays) || 0;
  return anchor.add(days, "day").format("YYYY-MM-DD");
}

export function formatPaymentPendingDateList(dateStrings) {
  const list = dateStrings || [];
  if (!list.length) return "";
  return list.map((d) => dayjs(d).format("DD-MM-YYYY")).join(", ");
}
