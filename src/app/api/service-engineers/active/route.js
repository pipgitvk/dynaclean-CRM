import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

/**
 * GET /api/service-engineers/active
 * Active internal service engineers (rep_list) for assignment dropdowns.
 */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roleNorm = String(payload.role || payload.userRole || "")
      .toUpperCase()
      .trim();

    const allowed = [
      "SUPERADMIN",
      "ADMIN",
      "DIRECTOR",
      "SERVICE HEAD",
      "SERVICE SUPPORT",
      "EA",
      "SERVICE ENGINEER",
    ];
    if (!allowed.includes(roleNorm) && !roleNorm.includes("SERVICE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT username FROM rep_list
       WHERE status = 1 AND TRIM(userRole) = 'SERVICE ENGINEER'
       ORDER BY username ASC`
    );

    return NextResponse.json({ users: rows });
  } catch (error) {
    console.error("Error fetching active service engineers:", error);
    return NextResponse.json({ users: [] });
  }
}
