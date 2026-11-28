import { getDbConnection } from "@/lib/db";
import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";

const PENDING_STATUS_SQL = `UPPER(TRIM(COALESCE(sr.status, ''))) NOT IN ('COMPLETED', 'CANCELLED')`;

export async function fetchSbiExpenseServiceOptions({ username, serviceType }) {
  const type = String(serviceType || "")
    .trim()
    .toUpperCase();
  if (type !== "INSTALLATION" && type !== "COMPLAINT") {
    return [];
  }

  const engineer = String(username || "").trim();
  if (!engineer) return [];

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT
       sr.service_id,
       sr.serial_number,
       sr.service_type,
       sr.status,
       wp.customer_name
     FROM service_records sr
     LEFT JOIN warranty_products wp
       ON ${sqlTrimUtf8EqColumns("wp.serial_number", "sr.serial_number")}
     WHERE UPPER(TRIM(COALESCE(sr.service_type, ''))) = ?
       AND TRIM(COALESCE(sr.assigned_to, '')) = ?
       AND ${PENDING_STATUS_SQL}
     ORDER BY COALESCE(sr.complaint_date, sr.reg_date) DESC, sr.service_id DESC
     LIMIT 150`,
    [type, engineer],
  );

  return (rows || []).map((row) => ({
    service_id: row.service_id,
    serial_number: row.serial_number,
    service_type: row.service_type,
    status: row.status,
    customer_name: row.customer_name,
    label: [
      row.service_id ? `#${row.service_id}` : null,
      row.serial_number ? `SN ${row.serial_number}` : null,
      row.customer_name ? String(row.customer_name).trim() : null,
    ]
      .filter(Boolean)
      .join(" — "),
  }));
}