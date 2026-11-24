import { sqlTrimUtf8EqColumns, sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";
import {
  INSTALLATION_REPORT_LATEST_JOIN_ON_SR,
  sqlInstallationReportEngineerPick,
} from "@/lib/openInstallationInstallReportSql";

const INSTALLATION_SR_TYPE_SQL = `UPPER(TRIM(COALESCE(sr2.service_type, ''))) = 'INSTALLATION'`;
const SR2_ASSIGNED_OK_SQL = `UPPER(TRIM(COALESCE(sr2.assigned_to, ''))) NOT IN ('', 'NOT ASSIGNED', 'UNASSIGNED')`;
/** Prefer COMPLETED installation SR when picking report paths (not highest id alone). */
const SR2_REPORT_PICK_ORDER = `CASE WHEN UPPER(TRIM(COALESCE(sr2.status, ''))) = 'COMPLETED' THEN 0 ELSE 1 END, sr2.service_id DESC`;
const SR2_GOOGLE_FEEDBACK_PICK_ORDER = `CASE
  WHEN LOWER(TRIM(COALESCE(sr2.google_feedback_collected, ''))) = 'yes' THEN 0
  WHEN LOWER(TRIM(COALESCE(sr2.google_feedback_collected, ''))) = 'no' THEN 1
  ELSE 2
END, sr2.service_id DESC`;

/** Attach service_id, service_details, engineers for a page of open-installation rows (by quote). */
export async function enrichOpenInstallationRowsWithServices(conn, rows) {
  if (!rows?.length) return rows || [];
  const quotes = [
    ...new Set(rows.map((r) => String(r.quote_number || "").trim()).filter(Boolean)),
  ];
  if (!quotes.length) return rows;

  const placeholders = quotes.map(() => "?").join(",");
  const quoteKeyD2 = sqlUtf8TrimExpr("d2.quote_number");

  const [svcRows] = await conn.execute(
    `SELECT
       ${quoteKeyD2} AS quote_key,
       GROUP_CONCAT(DISTINCT sr2.service_id ORDER BY sr2.service_id SEPARATOR ', ') AS service_id,
       GROUP_CONCAT(
         CONCAT_WS(
           '~',
           sr2.service_id,
           COALESCE(sr2.status, ''),
           COALESCE(
             DATE_FORMAT(sr2.planned_date, '%Y-%m-%d'),
             DATE_FORMAT(sr2.complaint_date, '%Y-%m-%d'),
             ''
           ),
           COALESCE(sr2.assigned_to, ''),
           COALESCE(sr2.status_description, ''),
           COALESCE(DATE_FORMAT(sr2.completed_date, '%Y-%m-%d'), '')
         )
         ORDER BY sr2.service_id
         SEPARATOR ';;'
       ) AS service_details,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           CASE
             WHEN ${INSTALLATION_SR_TYPE_SQL}
               AND ${SR2_ASSIGNED_OK_SQL}
               AND LOWER(TRIM(COALESCE(sr2.assigned_to_type, 'internal'))) <> 'third_party'
             THEN sr2.assigned_to
           END
           ORDER BY sr2.service_id DESC
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS service_engineer,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           CASE
             WHEN ${INSTALLATION_SR_TYPE_SQL}
               AND ${SR2_ASSIGNED_OK_SQL}
               AND LOWER(TRIM(COALESCE(sr2.assigned_to_type, ''))) = 'third_party'
             THEN sr2.assigned_to
           END
           ORDER BY sr2.service_id DESC
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS third_party_engineer,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           CASE
             WHEN ${INSTALLATION_SR_TYPE_SQL}
             THEN NULLIF(TRIM(sr2.engineer_assigned_by), '')
           END
           ORDER BY sr2.service_id DESC
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS engineer_assigned_by,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           CASE
             WHEN LOWER(TRIM(COALESCE(sr2.google_feedback_collected, ''))) = 'yes' THEN 'yes'
             WHEN LOWER(TRIM(COALESCE(sr2.google_feedback_collected, ''))) = 'no' THEN 'no'
             ELSE NULL
           END
           ORDER BY ${SR2_GOOGLE_FEEDBACK_PICK_ORDER}
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS google_feedback_collected,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           NULLIF(TRIM(sr2.google_feedback_collection), '')
           ORDER BY ${SR2_GOOGLE_FEEDBACK_PICK_ORDER}
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS google_feedback_collection,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           NULLIF(TRIM(sr2.google_feedback_proof), '')
           ORDER BY ${SR2_GOOGLE_FEEDBACK_PICK_ORDER}
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS google_feedback_proof,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           CASE
             WHEN ${INSTALLATION_SR_TYPE_SQL}
             THEN NULLIF(TRIM(sr2.installation_report), '')
           END
           ORDER BY ${SR2_REPORT_PICK_ORDER}
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS installation_report,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           CASE
             WHEN ${INSTALLATION_SR_TYPE_SQL}
             THEN NULLIF(TRIM(sr2.final_report_path), '')
           END
           ORDER BY ${SR2_REPORT_PICK_ORDER}
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS final_report_path,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           CASE
             WHEN ${INSTALLATION_SR_TYPE_SQL}
             THEN NULLIF(TRIM(sr2.completed_by_service_engineer), '')
           END
           ORDER BY sr2.service_id DESC
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS completed_by_service_engineer,
       ${sqlInstallationReportEngineerPick("sr2")} AS installation_report_engineer
     FROM dispatch d2
     INNER JOIN service_records sr2
       ON ${sqlTrimUtf8EqColumns("sr2.serial_number", "d2.serial_no")}
     ${INSTALLATION_REPORT_LATEST_JOIN_ON_SR}
     WHERE ${quoteKeyD2} IN (${placeholders})
       AND d2.serial_no IS NOT NULL
       AND ${sqlUtf8TrimExpr("d2.serial_no")} <> ''
     GROUP BY ${quoteKeyD2}`,
    quotes,
  );

  const byQuote = new Map(
    (svcRows || []).map((r) => [String(r.quote_key || "").trim().toLowerCase(), r]),
  );

  return rows.map((row) => {
    const hit = byQuote.get(String(row.quote_number || "").trim().toLowerCase());
    if (!hit) return row;
    const engineerAssignedBy =
      hit.engineer_assigned_by != null && String(hit.engineer_assigned_by).trim() !== ""
        ? String(hit.engineer_assigned_by).trim()
        : "";
    const next = { ...row };
    if (hit.service_details) {
      next.service_id = hit.service_id || row.service_id;
      next.service_details = hit.service_details;
      next.service_engineer =
        hit.service_engineer != null && String(hit.service_engineer).trim() !== ""
          ? hit.service_engineer
          : row.service_engineer;
      next.third_party_engineer =
        hit.third_party_engineer != null && String(hit.third_party_engineer).trim() !== ""
          ? hit.third_party_engineer
          : row.third_party_engineer;
    }
    if (engineerAssignedBy) {
      next.assigned_by = engineerAssignedBy;
    }
    if (
      hit.completed_by_service_engineer != null &&
      String(hit.completed_by_service_engineer).trim() !== ""
    ) {
      next.completed_by_service_engineer = String(hit.completed_by_service_engineer).trim();
    }
    if (
      hit.installation_report_engineer != null &&
      String(hit.installation_report_engineer).trim() !== ""
    ) {
      next.installation_report_engineer = String(hit.installation_report_engineer).trim();
    }
    {
      const gf = String(hit.google_feedback_collected ?? "").trim().toLowerCase();
      next.google_feedback_collected = gf === "yes" || gf === "no" ? gf : "";
    }
    if (hit.google_feedback_collection != null && String(hit.google_feedback_collection).trim() !== "") {
      next.google_feedback_collection = String(hit.google_feedback_collection).trim();
    }
    if (hit.google_feedback_proof != null && String(hit.google_feedback_proof).trim() !== "") {
      next.google_feedback_proof = String(hit.google_feedback_proof).trim();
    }
    if (hit.installation_report != null && String(hit.installation_report).trim() !== "") {
      next.installation_report = String(hit.installation_report).trim();
    }
    if (hit.final_report_path != null && String(hit.final_report_path).trim() !== "") {
      next.final_report_path = String(hit.final_report_path).trim();
    }
    return next;
  });
}