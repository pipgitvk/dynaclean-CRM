import dayjs from "dayjs";

/** ISO date (YYYY-MM-DD) for order list filters — current calendar month. */
export function getOrderTableDefaultDateFrom() {
  return dayjs().startOf("month").format("YYYY-MM-DD");
}

export function getOrderTableDefaultDateTo() {
  return dayjs().endOf("month").format("YYYY-MM-DD");
}

/** If From > To (bad filter), swap so the API still returns rows. */
export function normalizeOrderListDateRange(dateFrom, dateTo) {
  const from = String(dateFrom ?? "").trim();
  const to = String(dateTo ?? "").trim();
  if (from && to && from > to) {
    return { dateFrom: to, dateTo: from };
  }
  return { dateFrom: from, dateTo: to };
}
