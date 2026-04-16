import dayjs from "dayjs";
import { parseCrmDatetimeToDayjs } from "@/lib/timezone";

function followupParsedInstants(customer) {
  const raws = [customer.tl_next_followup, customer.latest_next_followup].filter(
    (x) => x != null && x !== "",
  );
  return raws
    .map((r) => parseCrmDatetimeToDayjs(r))
    .filter((d) => d != null && d.isValid());
}

/**
 * Effective next follow-up for list/cards/filters: if either TL or generic follow-up
 * has a **future** (or same-minute) date, uses the **earliest** upcoming — so a stale
 * past TL date does not hide a newer `customers_followup` next date. If every date is
 * in the past, uses the **most recent** past (strongest overdue signal).
 *
 * Uses {@link parseCrmDatetimeToDayjs} so DB UTC wall-clock datetimes compare and
 * display correctly as IST in the UI.
 *
 * @param {{ tl_next_followup?: unknown; latest_next_followup?: unknown }} customer
 * @returns {import("dayjs").Dayjs | null}
 */
export function pickEffectiveNextFollowup(customer) {
  const ds = followupParsedInstants(customer);
  if (!ds.length) return null;
  const now = dayjs();
  const upcoming = ds.filter((d) => !d.isBefore(now));
  if (upcoming.length) {
    const chosen = upcoming.reduce((a, b) => (a.isBefore(b) ? a : b));
    return chosen;
  }
  return ds.reduce((a, b) => (a.isAfter(b) ? a : b));
}

/**
 * When TL management mode is on: show the **later** scheduled next follow-up
 * between TL and regular follow-up (`GREATEST` of the two datetimes), so the
 * column reflects the latest calendar date, not the earliest upcoming slot.
 *
 * @param {{ tl_next_followup?: unknown; latest_next_followup?: unknown }} customer
 * @returns {import("dayjs").Dayjs | null}
 */
export function pickLatestChronologicalNextFollowup(customer) {
  const ds = followupParsedInstants(customer);
  if (!ds.length) return null;
  return ds.reduce((a, b) => (a.isAfter(b) ? a : b));
}

/** Raw DB row (e.g. TL_followups) — true if next_followup_date is a non-empty parseable datetime. */
export function hasRowNextFollowupDate(row) {
  const v = row?.next_followup_date;
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
}
