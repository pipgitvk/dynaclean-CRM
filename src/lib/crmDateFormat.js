import dayjs from "dayjs";

/** Standard CRM calendar date display (India). */
export const CRM_DATE_FORMAT = "DD-MM-YYYY";

/** Datetime with 12-hour clock. */
export const CRM_DATETIME_FORMAT = "DD-MM-YYYY hh:mm A";

/** Datetime with 24-hour clock. */
export const CRM_DATETIME_24_FORMAT = "DD-MM-YYYY HH:mm";

const EMPTY = "—";

/**
 * Date-only display. Uses the YYYY-MM-DD calendar prefix when present so
 * date fields are not shifted by timezone.
 */
export function formatCrmDateOnly(value, empty = EMPTY) {
  if (value == null || value === "") return empty;
  const s = String(value).trim();
  if (!s) return empty;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) {
    const d = dayjs(m[1]);
    return d.isValid() ? d.format(CRM_DATE_FORMAT) : empty;
  }
  // Already DD-MM-YYYY (or D-M-YYYY). Do not let dayjs read this as MM-DD-YYYY.
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    const d = dayjs(`${year}-${month}-${day}`);
    if (
      d.isValid() &&
      d.format("YYYY-MM-DD") === `${year}-${month}-${day}`
    ) {
      return d.format(CRM_DATE_FORMAT);
    }
    return empty;
  }
  const d = dayjs(value);
  if (!d.isValid()) return empty;
  return d.format(CRM_DATE_FORMAT);
}

/** @deprecated Use {@link formatCrmDateOnly}. */
export const formatCrmDate = formatCrmDateOnly;

/** First and last calendar day of the current month as YYYY-MM-DD (filters, APIs). */
export function getCurrentMonthRangeIso() {
  const start = dayjs().startOf("month");
  const end = dayjs().endOf("month");
  return {
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
  };
}
