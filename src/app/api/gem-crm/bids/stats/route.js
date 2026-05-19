import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conn = await getDbConnection();

    // Get all stats in a single query
    const [result] = await conn.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN bid_status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN bid_status = 'lost' THEN 1 ELSE 0 END) as lost
      FROM bids
    `);

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
