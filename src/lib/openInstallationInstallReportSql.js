/** Latest installation_reports row per service_id (engineer who completed on report). */
export const INSTALLATION_REPORT_LATEST_JOIN_ON_SR = `
  LEFT JOIN (
    SELECT ir.service_id, ir.authorized_person_name
    FROM installation_reports ir
    INNER JOIN (
      SELECT service_id, MAX(id) AS max_id
      FROM installation_reports
      GROUP BY service_id
    ) ir_max ON ir_max.max_id = ir.id
  ) ir_latest ON ir_latest.service_id = sr2.service_id
`;

export function sqlInstallationReportEngineerPick(serviceAlias = "sr2") {
  return `SUBSTRING_INDEX(
    GROUP_CONCAT(
      CASE
        WHEN UPPER(TRIM(COALESCE(${serviceAlias}.service_type, ''))) = 'INSTALLATION'
        THEN NULLIF(TRIM(ir_latest.authorized_person_name), '')
      END
      ORDER BY ${serviceAlias}.service_id DESC
      SEPARATOR '||'
    ),
    '||',
    1
  )`;
}