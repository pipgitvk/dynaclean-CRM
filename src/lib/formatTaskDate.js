import dayjs from "dayjs";

/**
 * Stable calendar YYYY-MM-DD for task datetimes passed from server → client.
 * RSC serializes Date as UTC ISO; `dayjs(iso).format("DD/MM/YYYY")` in IST can
 * show the next day vs server-rendered detail pages (often UTC). Using the UTC
 * date prefix matches the instant's calendar day in ISO and fixes list vs view.
 */
export function taskCalendarDateKey(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  const d = dayjs(value);
  if (!d.isValid()) return null;
  const iso = d.toISOString();
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function formatTaskDateOnly(value) {
  const key = taskCalendarDateKey(value);
  if (key) return dayjs(key, "YYYY-MM-DD").format("DD/MM/YYYY");
  const d = dayjs(value);
  return d.isValid() ? d.format("DD/MM/YYYY") : "-";
}

export function dayjsTaskCalendarStart(value) {
  const key = taskCalendarDateKey(value);
  if (key) return dayjs(key, "YYYY-MM-DD").startOf("day");
  const d = dayjs(value);
  return d.isValid() ? d.startOf("day") : d;
}
