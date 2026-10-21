import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";

/**
 * When a linked service has a completed installation report, mark the order installed
 * so it drops off Upcoming Installations (same as manual "Installed" action).
 */
export async function syncInstalledOrdersFromCompletedInstallationReports(db) {
  const serialEq = sqlTrimUtf8EqColumns("sr.serial_number", "d.serial_no");
  const serviceIdEq = sqlTrimUtf8EqColumns("ir.service_id", "sr.service_id");
  const quoteEq = sqlTrimUtf8EqColumns("d.quote_number", "no.quote_number");

  const [result] = await db.query(`
    UPDATE neworder no
    SET no.installation_status = 1
    WHERE no.installation_status = 0
      AND EXISTS (
        SELECT 1
        FROM dispatch d
        INNER JOIN service_records sr
          ON ${serialEq}
        LEFT JOIN installation_reports ir
          ON ${serviceIdEq}
        WHERE ${quoteEq}
          AND d.serial_no IS NOT NULL
          AND d.serial_no <> ''
          AND UPPER(TRIM(sr.status)) = 'COMPLETED'
          AND (
            (
              ir.service_id IS NOT NULL
              AND UPPER(TRIM(COALESCE(ir.status, ''))) = 'COMPLETED'
            )
            OR (
              sr.installation_report IS NOT NULL
              AND TRIM(sr.installation_report) <> ''
            )
          )
        LIMIT 1
      )
  `);
  return result?.affectedRows ?? 0;
}
