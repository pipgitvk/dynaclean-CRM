import { ensureServiceReportStepsTable } from "@/lib/ensureServiceReportStepsTable";
import { ensureServiceRecordsFollowupColumns } from "@/lib/ensureServiceRecordsFollowupColumns";
import { ensureServiceRecordsPlannedDateColumn } from "@/lib/ensureServiceRecordsPlannedDateColumn";

export async function fetchThirdPartyEngineerServiceRecords(conn, engineerId) {
  await ensureServiceReportStepsTable();
  await ensureServiceRecordsFollowupColumns();
  await ensureServiceRecordsPlannedDateColumn();

  const [rows] = await conn.execute(
    `
      SELECT
        sr.*,
        srs.video_360,
        srs.video_problem,
        srs.video_damaged,
        srs.video_completion,
        wp.customer_name AS customer_name_from_wp,
        wp.contact_person AS contact_person_from_wp,
        wp.installed_address AS installed_address_from_wp,
        wp.id AS machine_id, wp.email, wp.contact, wp.invoice_date, wp.product_name, wp.specification, wp.model,
        wp.lat, wp.longt,
        (
          SELECT GROUP_CONCAT(srp.id ORDER BY srp.id SEPARATOR ',')
          FROM service_reports srp
          WHERE srp.service_id = sr.service_id
        ) AS report_ids,
        (
          SELECT GROUP_CONCAT(srp.service_date ORDER BY srp.id SEPARATOR ',')
          FROM service_reports srp
          WHERE srp.service_id = sr.service_id
        ) AS report_dates,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM service_reports srp2 WHERE srp2.service_id = sr.service_id
          ) THEN 1
          ELSE 0
        END AS view_status
      FROM service_records sr
      LEFT JOIN service_report_steps srs ON srs.service_id = sr.service_id
      LEFT JOIN warranty_products wp ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
      WHERE sr.assigned_to_type = 'third_party' AND sr.assigned_to_id = ?
      ORDER BY sr.service_id DESC
    `,
    [engineerId]
  );

  return (rows || []).map((row) => ({
    ...row,
    customer_name: row.customer_name_from_wp || row.contact_person_from_wp || "N/A",
    installed_address: row.installed_address_from_wp || "N/A",
    completed_date: row.completed_date
      ? new Date(row.completed_date).toLocaleDateString()
      : "N/A",
  }));
}
