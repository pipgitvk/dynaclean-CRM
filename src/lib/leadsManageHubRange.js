import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { getCurrentMonthThroughTodayIso } from "@/lib/crmDateFormat";

dayjs.extend(utc);
dayjs.extend(timezone);

const HUB_RANGE_TZ = "Asia/Kolkata";

function hubToday() {
  return dayjs().tz(HUB_RANGE_TZ).startOf("day");
}

export const LEADS_HUB_RANGE_OPTIONS = [
  { id: "month", label: "Current Month (till today)" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "custom", label: "Custom date range" },
];

/** Inclusive YYYY-MM-DD bounds + previous period of equal length (for % change). */
export function resolveLeadsHubRange(rangeKey = "month", { from: customFrom, to: customTo } = {}) {
  const key = String(rangeKey || "month").trim().toLowerCase();

  if (key === "custom" && customFrom && customTo) {
    let start = dayjs(String(customFrom).trim());
    let end = dayjs(String(customTo).trim());
    if (!start.isValid() || !end.isValid()) {
      return resolveLeadsHubRange("month");
    }
    if (end.isBefore(start, "day")) {
      const swap = start;
      start = end;
      end = swap;
    }
    const spanDays = end.diff(start, "day") + 1;
    const prevTo = start.subtract(1, "day");
    const prevFrom = prevTo.subtract(spanDays - 1, "day");
    return {
      from: start.format("YYYY-MM-DD"),
      to: end.format("YYYY-MM-DD"),
      prevFrom: prevFrom.format("YYYY-MM-DD"),
      prevTo: prevTo.format("YYYY-MM-DD"),
      rangeKey: "custom",
      rangeLabel: `${start.format("DD-MM-YYYY")} – ${end.format("DD-MM-YYYY")}`,
    };
  }

  const today = hubToday();

  if (key === "today") {
    const ymd = today.format("YYYY-MM-DD");
    const yesterday = today.subtract(1, "day");
    const prevYmd = yesterday.format("YYYY-MM-DD");
    return {
      from: ymd,
      to: ymd,
      prevFrom: prevYmd,
      prevTo: prevYmd,
      rangeKey: "today",
      rangeLabel: `Today (${today.format("D MMM YYYY")})`,
    };
  }

  if (key === "7d") {
    const from = today.subtract(6, "day");
    const to = today;
    const span = 7;
    const prevTo = from.subtract(1, "day");
    const prevFrom = prevTo.subtract(span - 1, "day");
    const label = LEADS_HUB_RANGE_OPTIONS.find((o) => o.id === key)?.label || "Last 7 Days";
    return {
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
      prevFrom: prevFrom.format("YYYY-MM-DD"),
      prevTo: prevTo.format("YYYY-MM-DD"),
      rangeKey: key,
      rangeLabel: label,
    };
  }

  if (key === "30d") {
    const from = today.subtract(29, "day");
    const to = today;
    const span = 30;
    const prevTo = from.subtract(1, "day");
    const prevFrom = prevTo.subtract(span - 1, "day");
    const label = LEADS_HUB_RANGE_OPTIONS.find((o) => o.id === key)?.label || "Last 30 Days";
    return {
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
      prevFrom: prevFrom.format("YYYY-MM-DD"),
      prevTo: prevTo.format("YYYY-MM-DD"),
      rangeKey: key,
      rangeLabel: label,
    };
  }

  if (key === "month") {
    const month = getCurrentMonthThroughTodayIso();
    const from = dayjs(month.from);
    const to = dayjs(month.to);
    const spanDays = to.diff(from, "day") + 1;
    const prevTo = from.subtract(1, "day");
    const prevFrom = prevTo.subtract(spanDays - 1, "day");

    const todayLabel = to.format("D MMM YYYY");
    const monthStartLabel = from.format("D MMM");
    const label = `Current Month (${monthStartLabel} – ${todayLabel})`;
    return {
      from: month.from,
      to: month.to,
      prevFrom: prevFrom.format("YYYY-MM-DD"),
      prevTo: prevTo.format("YYYY-MM-DD"),
      rangeKey: "month",
      rangeLabel: label,
    };
  }

  return resolveLeadsHubRange("month");
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