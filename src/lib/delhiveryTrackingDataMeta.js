import dayjs from "dayjs";

/** Normalize Delhivery API date fields for DB / API responses. */
export function normalizeDelhiveryStoredDate(value) {
  if (value == null || value === "") return null;
  const d = dayjs(value);
  if (!d.isValid()) return null;
  return d.format("YYYY-MM-DD HH:mm:ss");
}

export function pickDelhiveryTrackingDates(data) {
  if (!data || typeof data !== "object") {
    return {
      pickup_date: null,
      estimated_delivery_date: null,
      delivered_date: null,
    };
  }
  return {
    pickup_date: normalizeDelhiveryStoredDate(data.pickup_date),
    estimated_delivery_date:
      normalizeDelhiveryStoredDate(data.estimated_date) ||
      normalizeDelhiveryStoredDate(data.promised_delivery_date),
    delivered_date: normalizeDelhiveryStoredDate(data.delivered_date),
  };
}

/** Fill date columns from saved payload when empty (legacy rows). */
export function enrichTrackingDataRow(row) {
  if (!row || typeof row !== "object") return row;
  let pickup = row.pickup_date ?? null;
  let estimated = row.estimated_delivery_date ?? null;
  let delivered = row.delivered_date ?? null;

  if ((!pickup || !estimated || !delivered) && row.payload) {
    try {
      const data =
        typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
      const dates = pickDelhiveryTrackingDates(data);
      if (!pickup) pickup = dates.pickup_date;
      if (!estimated) estimated = dates.estimated_delivery_date;
      if (!delivered) delivered = dates.delivered_date;
    } catch {
      /* ignore bad payload */
    }
  }

  const { payload: _payload, ...rest } = row;
  return {
    ...rest,
    pickup_date: pickup,
    estimated_delivery_date: estimated,
    delivered_date: delivered,
  };
}
