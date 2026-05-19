import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const role = payload.role;
    if (!["SUPERADMIN", "GEM"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - SUPERADMIN/GEM only" }, { status: 403 });
    }

    const conn = await getDbConnection();

    // Get total bids count
    const [totalResult] = await conn.execute(
      "SELECT COUNT(*) as total FROM bids"
    );

    // Get won bids count
    const [wonResult] = await conn.execute(
      "SELECT COUNT(*) as won FROM bids WHERE bid_status = 'won'"
    );

    // Get lost bids count
    const [lostResult] = await conn.execute(
      "SELECT COUNT(*) as lost FROM bids WHERE bid_status = 'lost'"
    );

    await conn.end();

    return NextResponse.json({
      success: true,
      data: {
        total: totalResult[0].total,
        won: wonResult[0].won,
        lost: lostResult[0].lost,
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
