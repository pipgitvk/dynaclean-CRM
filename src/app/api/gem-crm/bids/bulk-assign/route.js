import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPERADMIN can bulk assign
    if (payload.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden - SUPERADMIN only" }, { status: 403 });
    }

    const body = await request.json();
    const { bid_ids, employee_id } = body;

    if (!bid_ids || !Array.isArray(bid_ids) || bid_ids.length === 0) {
      return NextResponse.json({ error: "Invalid bid_ids" }, { status: 400 });
    }

    if (!employee_id) {
      return NextResponse.json({ error: "employee_id is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Update all selected bids with the new employee_id
    const placeholders = bid_ids.map(() => "?").join(",");
    const updateQuery = `
      UPDATE bids 
      SET assigned_employee_id = ? 
      WHERE bid_id IN (${placeholders})
    `;

    const params = [employee_id, ...bid_ids];
    const [result] = await conn.execute(updateQuery, params);

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${result.affectedRows} bid(s) to employee`,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error in bulk-assign:", error);
    return NextResponse.json(
      { error: error.message || "Failed to bulk assign bids", success: false },
      { status: 500 }
    );
  }
}
