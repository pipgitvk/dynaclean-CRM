import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { requireThirdPartyEngineerPortalSession } from "@/lib/thirdPartyEngineerPortalAuth";
import { ensureServiceRecordsThirdPartyAssignColumns } from "@/lib/ensureServiceRecordsThirdPartyAssignColumns";

export async function GET() {
  try {
    const auth = await requireThirdPartyEngineerPortalSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const conn = await getDbConnection();
    await ensureServiceRecordsThirdPartyAssignColumns(conn);

    const [rows] = await conn.execute(
      `SELECT
         sr.service_id,
         sr.reg_date,
         sr.serial_number,
         sr.service_type,
         sr.complaint_date,
         sr.complaint_summary,
         sr.status,
         sr.completed_date,
         sr.assigned_to,
         wp.customer_name AS customer_name,
         wp.installed_address AS installed_address
       FROM service_records sr
       LEFT JOIN warranty_products wp
         ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
       WHERE (
         sr.third_party_engineer_id = ?
         OR (sr.assigned_to_type = 'third_party' AND sr.assigned_to_id = ?)
       )
       ORDER BY sr.service_id DESC
       LIMIT 200`,
      [auth.engineerId, auth.engineerId]
    );

    return NextResponse.json({ services: rows || [] });
  } catch (error) {
    console.error("third-party-engineer-portal services:", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
