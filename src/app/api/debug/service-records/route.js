import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const conn = await getDbConnection();

    // Check if service_records table exists and has data
    const [counts] = await conn.execute(`
      SELECT 
        (SELECT COUNT(*) FROM service_records) as service_records_count,
        (SELECT COUNT(*) FROM warranty_products) as warranty_products_count,
        (SELECT COUNT(*) FROM service_reports) as service_reports_count
    `);

    // Get sample records
    const [serviceRecords] = await conn.execute(`
      SELECT sr.service_id, sr.complaint_date, sr.assigned_to, sr.status, sr.serial_number
      FROM service_records sr
      LIMIT 10
    `);

    const [warrantyProducts] = await conn.execute(`
      SELECT serial_number, customer_name, contact_person
      FROM warranty_products
      LIMIT 10
    `);

    return Response.json({
      success: true,
      counts: counts[0],
      serviceRecords: serviceRecords,
      warrantyProducts: warrantyProducts,
      message: "Debug data retrieved successfully"
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
