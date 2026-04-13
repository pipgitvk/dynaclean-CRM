import dayjs from "dayjs";

/**
 * Effective next follow-up for list/cards/filters: if either TL or generic follow-up
 * has a **future** (or same-minute) date, uses the **earliest** upcoming — so a stale
 * past TL date does not hide a newer `customers_followup` next date. If every date is
 * in the past, uses the **most recent** past (strongest overdue signal).
 *
 * @param {{ tl_next_followup?: unknown; latest_next_followup?: unknown }} customer
 * @returns {import("dayjs").Dayjs | null}
 */
export function pickEffectiveNextFollowup(customer) {
  const raw = [customer.tl_next_followup, customer.latest_next_followup].filter(
    (x) => x != null && x !== "",
  );
  const ds = raw.map((r) => dayjs(r)).filter((d) => d.isValid());
  if (!ds.length) return null;
  const now = dayjs();
  const upcoming = ds.filter((d) => !d.isBefore(now));
  if (upcoming.length) {
    return upcoming.reduce((a, b) => (a.isBefore(b) ? a : b));
  }
  return ds.reduce((a, b) => (a.isAfter(b) ? a : b));
}
