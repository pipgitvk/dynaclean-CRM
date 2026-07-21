import { NextResponse } from "next/server";
import { withPool } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(payload.role || "").trim().toUpperCase();
    if (!["SUPERADMIN", "GEM"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - SUPERADMIN/GEM only" }, { status: 403 });
    }

    return await withPool(async (conn) => {
      if (role === "GEM") {
        const empId = await resolveGemCrmEmployeeId(payload);
        if (!empId) {
          return NextResponse.json({ error: "Employee id missing in session." }, { status: 403 });
        }
        const [rows] = await conn.execute(
          `SELECT DISTINCT b.assigned_employee_id AS empId, COALESCE(r.username, e.username, ?) AS username
           FROM bids b
           LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
           LEFT JOIN rep_list r ON b.assigned_employee_id = r.empId
           WHERE b.assigned_employee_id = ?
           ORDER BY username`,
          [payload.username || "Me", empId]
        );
        return NextResponse.json({ success: true, data: rows });
      }

      const [rows] = await conn.execute(
        `SELECT DISTINCT b.assigned_employee_id AS empId, COALESCE(r.username, e.username, CONCAT('Employee #', b.assigned_employee_id)) AS username
         FROM bids b
         LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
         LEFT JOIN rep_list r ON b.assigned_employee_id = r.empId
         WHERE b.assigned_employee_id IS NOT NULL
         ORDER BY username`
      );
      return NextResponse.json({ success: true, data: rows });
    });
  } catch (error) {
    console.error("Error fetching GEM CRM assigned employees:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch assigned employees", success: false },
      { status: 500 }
    );
  }
}
