
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conn = await getDbConnection();
    const testIds = [235178, 235175];

    // Check service_records
    const [recordsRows] = await conn.execute(
      "SELECT * FROM service_records WHERE service_id IN (?)",
      [testIds]
    );
    console.log("✅ [TEST API] service_records found:", recordsRows.length, recordsRows);

    // Check service_reports
    const [reportsRows] = await conn.execute(
      "SELECT * FROM service_reports WHERE service_id IN (?)",
      [testIds]
    );
    console.log("✅ [TEST API] service_reports found:", reportsRows.length, reportsRows);

    // Run the exact query from view_service_reports page
    const sql = `
      SELECT
        sr.*,
        wp.customer_name AS customer_name_from_wp,
        wp.contact_person AS contact_person_from_wp,
        wp.installed_address AS installed_address_from_wp,
        wp.email, wp.contact, wp.invoice_date, wp.product_name, wp.specification, wp.model, wp.state,
        CASE
            WHEN sr_report.service_id IS NOT NULL THEN 1
            ELSE 0
        END AS view_status
      FROM service_records sr
      LEFT JOIN warranty_products wp ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
      LEFT JOIN service_reports sr_report ON sr.service_id = sr_report.service_id
      WHERE sr.service_id IN (?)
      ORDER BY sr.service_id DESC;
    `;

    const [finalRows] = await conn.execute(sql, [testIds]);
    console.log("✅ [TEST API] Full query results found:", finalRows.length, finalRows);

    return NextResponse.json({
      success: true,
      service_records_count: recordsRows.length,
      service_reports_count: reportsRows.length,
      full_query_count: finalRows.length,
      service_records_data: recordsRows,
      service_reports_data: reportsRows,
      full_query_data: finalRows
    });

  } catch (error) {
    console.error("❌ [TEST API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
