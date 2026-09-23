import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { isGemCrmRoleAllowed } from "@/lib/gemCrmAuth";

export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(payload.role || "").trim().toUpperCase();
    if (!isGemCrmRoleAllowed(role)) {
      return NextResponse.json({ error: "Forbidden - SUPERADMIN/GEM/DIRECTOR only" }, { status: 403 });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT empId, username, userRole
       FROM rep_list
       WHERE status = 1 AND UPPER(TRIM(userRole)) = 'GEM'
       ORDER BY username`
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching GEM employees:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch GEM employees", success: false },
      { status: 500 }
    );
  }
}
