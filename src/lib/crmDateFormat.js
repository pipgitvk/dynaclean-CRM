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
    const d = dayjs(m[1], "YYYY-MM-DD");
    return d.isValid() ? d.format(CRM_DATE_FORMAT) : empty;
  }
  const d = dayjs(value);
  if (!d.isValid()) return empty;
  return d.format(CRM_DATE_FORMAT);
}

/** @deprecated Use {@link formatCrmDateOnly}. */
export const formatCrmDate = formatCrmDateOnly;
