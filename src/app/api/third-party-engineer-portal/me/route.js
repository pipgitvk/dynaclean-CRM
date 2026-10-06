import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { requireThirdPartyEngineerPortalSession } from "@/lib/thirdPartyEngineerPortalAuth";
import { ensureThirdPartyEngineerColumns } from "@/lib/thirdPartyEngineerSchema";

export async function GET() {
  try {
    const auth = await requireThirdPartyEngineerPortalSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const conn = await getDbConnection();
    await ensureThirdPartyEngineerColumns(conn);

    const [rows] = await conn.execute(
      `SELECT engineer_id, name, mobile, secondary_contact_number, email, address, state,
              geo_location, remark, service_charge, status, created_at, updated_at
       FROM third_party_service_engineers
       WHERE engineer_id = ? AND status = 'active'
       LIMIT 1`,
      [auth.engineerId]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Account not found or inactive" }, { status: 404 });
    }

    return NextResponse.json({ engineer: rows[0] });
  } catch (error) {
    console.error("third-party-engineer-portal me:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
