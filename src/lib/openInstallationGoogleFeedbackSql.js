import { sqlTrimUtf8EqColumns, sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

/** Any service record on this quote's dispatch serial with Google feedback = yes. */
export function sqlQuoteHasGoogleFeedbackCollected(orderAlias = "no") {
  return `EXISTS (
    SELECT 1
    FROM dispatch d_gf
    INNER JOIN service_records sr_gf
      ON ${sqlTrimUtf8EqColumns("sr_gf.serial_number", "d_gf.serial_no")}
    WHERE ${sqlTrimUtf8EqColumns("d_gf.quote_number", `${orderAlias}.quote_number`)}
      AND d_gf.serial_no IS NOT NULL
      AND ${sqlUtf8TrimExpr("d_gf.serial_no")} <> ''
      AND UPPER(TRIM(COALESCE(sr_gf.service_type, ''))) = 'INSTALLATION'
      AND LOWER(TRIM(COALESCE(sr_gf.google_feedback_collected, ''))) = 'yes'
  )`;
}

function sqlOrderInstallationDone(orderAlias = "no") {
  return `(
    COALESCE(${orderAlias}.installation_status, 0) = 1
    OR EXISTS (
      SELECT 1
      FROM dispatch d_ic
      INNER JOIN service_records sr_ic
        ON ${sqlTrimUtf8EqColumns("sr_ic.serial_number", "d_ic.serial_no")}
      WHERE ${sqlTrimUtf8EqColumns("d_ic.quote_number", `${orderAlias}.quote_number`)}
        AND UPPER(TRIM(COALESCE(sr_ic.service_type, ''))) = 'INSTALLATION'
        AND UPPER(TRIM(COALESCE(sr_ic.status, ''))) = 'COMPLETED'
    )
  )`;
}

/** Installation marked done on order, Google feedback not recorded as Yes. */
export function sqlOrderGoogleFeedbackNotCollected(orderAlias = "no") {
  return `(
    ${sqlOrderInstallationDone(orderAlias)}
    AND NOT ${sqlQuoteHasGoogleFeedbackCollected(orderAlias)}
  )`;
}

export function sqlOrderGoogleFeedbackCollected(orderAlias = "no") {
  return `(
    ${sqlOrderInstallationDone(orderAlias)}
    AND ${sqlQuoteHasGoogleFeedbackCollected(orderAlias)}
  )`;
}

export function sqlCountGoogleFeedbackYesSubquery(orderAlias = "no") {
  return sqlQuoteHasGoogleFeedbackCollected(orderAlias);
}