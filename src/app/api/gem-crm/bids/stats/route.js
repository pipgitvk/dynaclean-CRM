import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await getDbConnection();
    const currentEmpId = await resolveGemCrmEmployeeId(conn, payload);

    let whereClause = "";
    let params = [];

    // Only SUPERADMIN can see all stats, others see only their own bids
    if (payload.role !== "SUPERADMIN") {
      if (currentEmpId) {
        whereClause = "WHERE assigned_employee_id = ?";
        params.push(currentEmpId);
      } else {
        // Fallback: try to get employee ID from username
        const username = payload?.username;
        if (username) {
          const [empRows] = await conn.execute(
            "SELECT empId FROM emplist WHERE LOWER(username) = LOWER(?) LIMIT 1",
            [username]
          );
          if (empRows?.[0]?.empId) {
            whereClause = "WHERE assigned_employee_id = ?";
            params.push(empRows[0].empId);
          } else {
            const [repRows] = await conn.execute(
              "SELECT empId FROM rep_list WHERE LOWER(username) = LOWER(?) LIMIT 1",
              [username]
            );
            if (repRows?.[0]?.empId) {
              whereClause = "WHERE assigned_employee_id = ?";
              params.push(repRows[0].empId);
            }
          }
        }
      }
    }

    // Get all stats in a single query with filtering
    const [result] = await conn.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN bid_status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN bid_status = 'lost' THEN 1 ELSE 0 END) as lost
      FROM bids
      ${whereClause}
    `, params);

    return NextResponse.json({
      success: true,
      data: {
        total: result[0].total || 0,
        won: result[0].won || 0,
        lost: result[0].lost || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching bid stats:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
