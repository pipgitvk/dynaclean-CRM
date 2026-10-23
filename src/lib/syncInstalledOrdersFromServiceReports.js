import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";

const INSTALLATION_COMPLETED_WITH_REPORT_SQL = `
  SELECT DISTINCT d.quote_number AS quote_number
  FROM dispatch d
  INNER JOIN service_records sr
    ON ${sqlTrimUtf8EqColumns("sr.serial_number", "d.serial_no")}
  INNER JOIN service_reports srep
    ON srep.service_id = sr.service_id
  WHERE d.serial_no IS NOT NULL
    AND TRIM(d.serial_no) <> ''
    AND UPPER(TRIM(sr.service_type)) = 'INSTALLATION'
    AND UPPER(TRIM(sr.status)) = 'COMPLETED'
`;

/** Mark orders installed when linked service is COMPLETED and service_reports exists. */
export async function syncInstalledOrdersFromCompletedInstallationReports(db) {
  const quoteJoin = sqlTrimUtf8EqColumns("no.quote_number", "done.quote_number");
  const [result] = await db.query(`
    UPDATE neworder no
    INNER JOIN (
      ${INSTALLATION_COMPLETED_WITH_REPORT_SQL}
    ) done ON ${quoteJoin}
    SET no.installation_status = 1
    WHERE no.installation_status = 0
  `);
  return result?.affectedRows ?? 0;
}

/** Re-show on upcoming when condition no longer met (e.g. status back to PENDING). */
export async function reopenOrdersWithoutCompletedServiceReport(db) {
  const quoteJoin = sqlTrimUtf8EqColumns("no.quote_number", "done.quote_number");
  const quoteEq = sqlTrimUtf8EqColumns("d.quote_number", "no.quote_number");

  const [result] = await db.query(`
    UPDATE neworder no
    SET no.installation_status = 0
    WHERE no.installation_status = 1
      AND EXISTS (
        SELECT 1
        FROM dispatch d
        INNER JOIN service_records sr
          ON ${sqlTrimUtf8EqColumns("sr.serial_number", "d.serial_no")}
        WHERE ${quoteEq}
          AND UPPER(TRIM(sr.service_type)) = 'INSTALLATION'
        LIMIT 1
      )
      AND NOT EXISTS (
        SELECT 1
        FROM (
          ${INSTALLATION_COMPLETED_WITH_REPORT_SQL}
        ) done
        WHERE ${quoteJoin}
        LIMIT 1
      )
  `);
  return result?.affectedRows ?? 0;
}

export async function syncInstallationOrderStatusFromServiceReports(db) {
  const marked = await syncInstalledOrdersFromCompletedInstallationReports(db);
  const reopened = await reopenOrdersWithoutCompletedServiceReport(db);
  return { marked, reopened };
}

/** Fast path for list page: mark newly completed only (skip expensive reopen). */
export async function syncInstallationOrderStatusMarkOnly(db) {
  return syncInstalledOrdersFromCompletedInstallationReports(db);
}
