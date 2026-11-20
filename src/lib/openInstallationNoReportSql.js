import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";

/** INSTALLATION service record with a saved report (file path or digital {@code uploadFO}). */
export const SR2_HAS_INSTALLATION_REPORT_SQL = `
  UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'
  AND sr2.installation_report IS NOT NULL
  AND TRIM(CAST(sr2.installation_report AS CHAR)) <> ''
`;

/**
 * Quote has any INSTALLATION service_records.installation_report (file or uploadFO).
 * One EXISTS only — do not wrap in SUM over all neworder rows.
 */
export function sqlQuoteHasInstallationReport(orderAlias = "no", dAlias = "d_nir", srAlias = "sr_nir") {
  return `EXISTS (
    SELECT 1
    FROM dispatch ${dAlias}
    INNER JOIN service_records ${srAlias}
      ON ${sqlTrimUtf8EqColumns(`${srAlias}.serial_number`, `${dAlias}.serial_no`)}
    WHERE ${sqlTrimUtf8EqColumns(`${dAlias}.quote_number`, `${orderAlias}.quote_number`)}
      AND UPPER(TRIM(COALESCE(${srAlias}.service_type, ''))) = 'INSTALLATION'
      AND ${srAlias}.installation_report IS NOT NULL
      AND TRIM(CAST(${srAlias}.installation_report AS CHAR)) <> ''
  )`;
}

/**
 * Installed on neworder, but no installation report on the quote.
 * Cheap enough for list/count of the no_feedback bucket (installed subset only).
 */
export function sqlOrderMissingInstallationReport(orderAlias = "no") {
  return `(
    COALESCE(${orderAlias}.installation_status, 0) = 1
    AND NOT ${sqlQuoteHasInstallationReport(orderAlias)}
  )`;
}

export const NO_MISSING_INSTALLATION_REPORT_ON_ORDER_SQL =
  sqlOrderMissingInstallationReport("no");
