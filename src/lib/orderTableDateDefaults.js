import dayjs from "dayjs";

/** ISO date (YYYY-MM-DD) for order list filters — current calendar month. */
export function getOrderTableDefaultDateFrom() {
  return dayjs().startOf("month").format("YYYY-MM-DD");
}

export function getOrderTableDefaultDateTo() {
  return dayjs().endOf("month").format("YYYY-MM-DD");
}
