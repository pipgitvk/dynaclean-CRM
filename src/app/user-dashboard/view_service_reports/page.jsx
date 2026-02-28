// app/service-reports/page.js

import { getDbConnection } from "@/lib/db"; // DB connection utility
import ServiceTable from "@/components/services/ServiceTable"; // Import the new Table Component
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getSessionPayload } from "@/lib/auth";

export default async function ViewServiceReportsPage() {
  let serviceRecords = [];

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let role = "Unknown";

  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }

  role = payload.role;

  console.log("this is the role: ", role);

  try {
    const conn = await getDbConnection();
    const sql = `
      SELECT
    sr.*,
    wp.customer_name AS customer_name_from_wp,
    wp.contact_person AS contact_person_from_wp,
    wp.installed_address AS installed_address_from_wp,
    wp.email, wp.contact, wp.invoice_date, wp.product_name, wp.specification, wp.model,
    CASE
        WHEN sr_report.service_id IS NOT NULL THEN 1
        ELSE 0
    END AS view_status
FROM service_records sr
LEFT JOIN warranty_products wp ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
LEFT JOIN service_reports sr_report ON sr.service_id = sr_report.service_id
ORDER BY sr.service_id DESC;
    `;

    const [rows] = await conn.execute(sql);

    // console.log("this is the rows: ", rows);

    serviceRecords = rows.map((row) => ({
      ...row,
      customer_name: row.customer_name_from_wp || row.contact_person_from_wp || "N/A",
      installed_address: row.installed_address_from_wp || "N/A",
      // Ensure the date fields are converted to a readable string format
      completed_date: row.completed_date
        ? new Date(row.completed_date).toLocaleDateString()
        : "N/A",
    }));

    // conn.end();
  } catch (error) {
    console.error("Error fetching service records:", error);
    serviceRecords = [];
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className=" mx-auto">
        <h2 className="text-3xl  text-gray-800 text-center">Service Reports</h2>
        <ServiceTable serviceRecords={serviceRecords} role={role} />
      </div>
    </div>
  );
}
