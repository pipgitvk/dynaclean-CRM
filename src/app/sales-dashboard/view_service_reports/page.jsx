import { getDbConnection } from "@/lib/db";
import { formatCrmDateOnly } from "@/lib/crmDateFormat";
import ServiceTable from "@/components/services/ServiceTable";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { ensureServiceReportStepsTable } from "@/lib/ensureServiceReportStepsTable";
import { ensureServiceRecordsFollowupColumns } from "@/lib/ensureServiceRecordsFollowupColumns";
import { ensureServiceRecordsPlannedDateColumn } from "@/lib/ensureServiceRecordsPlannedDateColumn";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const PRIVILEGED_ROLES = [
  "ADMIN",
  "SUPERADMIN",
  "SERVICE HEAD",
  "TEAM LEADER",
  "SALES CUM BACKOFFICE",
  "SERVICE SUPPORT",
];

function canViewAllServiceRecords(role) {
  const k = normalizeRoleKey(role || "");
  return PRIVILEGED_ROLES.some((r) => normalizeRoleKey(r) === k);
}

export default async function ViewServiceReportsPage() {
  let serviceRecords = [];

  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const role = payload.role;
  const username = payload.username;
  const isPrivileged = canViewAllServiceRecords(role);

  try {
    await ensureServiceReportStepsTable();
    await ensureServiceRecordsFollowupColumns();
    await ensureServiceRecordsPlannedDateColumn();
    const conn = await getDbConnection();

    const whereClause = isPrivileged ? "" : "WHERE sr.assigned_to = ?";
    const params = isPrivileged ? [] : [username];

    const sql = `
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
      ${whereClause}
      ORDER BY sr.service_id DESC;
    `;

    const [rows] = await conn.execute(sql, params);

    serviceRecords = rows.map((row) => ({
      ...row,
      customer_name: row.customer_name_from_wp || row.contact_person_from_wp || "N/A",
      installed_address: row.installed_address_from_wp || "N/A",
      completed_date: row.completed_date
        ? formatCrmDateOnly(row.completed_date)
        : "N/A",
    }));
  } catch (error) {
    console.error("Error fetching service records:", error);
    serviceRecords = [];
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <h2 className="text-xl sm:text-2xl lg:text-3xl text-gray-800 mb-4">
        Service Reports
      </h2>
      <ServiceTable serviceRecords={serviceRecords} role={role} />
    </div>
  );
}
