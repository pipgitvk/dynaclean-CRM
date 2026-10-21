/**
 * When a linked service has a completed installation report, mark the order installed
 * so it drops off Upcoming Installations (same as manual "Installed" action).
 */
export async function syncInstalledOrdersFromCompletedInstallationReports(db) {
  const [result] = await db.query(`
    UPDATE neworder no
    SET no.installation_status = 1
    WHERE no.installation_status = 0
      AND EXISTS (
        SELECT 1
        FROM dispatch d
        INNER JOIN service_records sr
          ON sr.serial_number COLLATE utf8mb4_unicode_ci = d.serial_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN installation_reports ir
          ON ir.service_id COLLATE utf8mb4_unicode_ci = sr.service_id COLLATE utf8mb4_unicode_ci
        WHERE d.quote_number COLLATE utf8mb4_unicode_ci = no.quote_number COLLATE utf8mb4_unicode_ci
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
