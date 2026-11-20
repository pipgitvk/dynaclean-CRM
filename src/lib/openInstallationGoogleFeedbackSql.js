import { sqlTrimUtf8EqColumns, sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

const INSTALLATION_SR = `UPPER(TRIM(COALESCE(sr_gf.service_type, ''))) = 'INSTALLATION'`;

export function sqlQuoteHasGoogleFeedbackCollected(orderAlias = "no") {
  return `EXISTS (
    SELECT 1
    FROM dispatch d_gf
    INNER JOIN service_records sr_gf
      ON ${sqlTrimUtf8EqColumns("sr_gf.serial_number", "d_gf.serial_no")}
    WHERE ${sqlTrimUtf8EqColumns("d_gf.quote_number", `${orderAlias}.quote_number`)}
      AND ${INSTALLATION_SR}
      AND LOWER(TRIM(COALESCE(sr_gf.google_feedback_collected, ''))) = 'yes'
  )`;
}

/** Installation marked done on order, Google feedback not recorded as Yes. */
export function sqlOrderGoogleFeedbackNotCollected(orderAlias = "no") {
  return `(
    COALESCE(${orderAlias}.installation_status, 0) = 1
    AND NOT ${sqlQuoteHasGoogleFeedbackCollected(orderAlias)}
  )`;
}

export function sqlOrderGoogleFeedbackCollected(orderAlias = "no") {
  return `(
    COALESCE(${orderAlias}.installation_status, 0) = 1
    AND ${sqlQuoteHasGoogleFeedbackCollected(orderAlias)}
  )`;
}

export function sqlCountGoogleFeedbackYesSubquery(orderAlias = "no") {
  return sqlQuoteHasGoogleFeedbackCollected(orderAlias);
}