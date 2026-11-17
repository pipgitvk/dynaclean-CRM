import dayjs from "dayjs";
import { getCurrentMonthThroughTodayIso } from "@/lib/crmDateFormat";

export const LEADS_HUB_RANGE_OPTIONS = [
  { id: "month", label: "Current Month (till today)" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
];

/** Inclusive YYYY-MM-DD bounds + previous period of equal length (for % change). */
export function resolveLeadsHubRange(rangeKey = "month") {
  const key = String(rangeKey || "month").trim().toLowerCase();
  const today = dayjs().startOf("day");

  if (key === "7d") {
    const from = today.subtract(6, "day");
    const to = today;
    const span = 7;
    const prevTo = from.subtract(1, "day");
    const prevFrom = prevTo.subtract(span - 1, "day");
    return {
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
      prevFrom: prevFrom.format("YYYY-MM-DD"),
      prevTo: prevTo.format("YYYY-MM-DD"),
      rangeKey: key,
    };
  }

  if (key === "30d") {
    const from = today.subtract(29, "day");
    const to = today;
    const span = 30;
    const prevTo = from.subtract(1, "day");
    const prevFrom = prevTo.subtract(span - 1, "day");
    return {
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
      prevFrom: prevFrom.format("YYYY-MM-DD"),
      prevTo: prevTo.format("YYYY-MM-DD"),
      rangeKey: key,
    };
  }

  const month = getCurrentMonthThroughTodayIso();
  const from = dayjs(month.from);
  const to = dayjs(month.to);
  const spanDays = to.diff(from, "day") + 1;
  const prevTo = from.subtract(1, "day");
  const prevFrom = prevTo.subtract(spanDays - 1, "day");

  return {
    from: month.from,
    to: month.to,
    prevFrom: prevFrom.format("YYYY-MM-DD"),
    prevTo: prevTo.format("YYYY-MM-DD"),
    rangeKey: "month",
  };
}

export function fillDailySeries(from, to, points) {
  const map = new Map(points.map((p) => [String(p.date), Number(p.total || 0)]));
  const out = [];
  let cursor = dayjs(from);
  const end = dayjs(to);
  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    const key = cursor.format("YYYY-MM-DD");
    out.push({
      date: key,
      label: cursor.format("MMM D"),
      total: map.get(key) ?? 0,
    });
    cursor = cursor.add(1, "day");
  }
  return out;
}