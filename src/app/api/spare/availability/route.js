import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/spare/availability?spare_id=123 or ?spare_number=1005
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const spareIdParam = searchParams.get("spare_id");
    const spareNumberParam = searchParams.get("spare_number");

    const db = await getDbConnection();

    let spare_id = null;
    if (spareIdParam) {
      spare_id = Number(spareIdParam);
      if (!Number.isFinite(spare_id)) {
        return NextResponse.json({ error: "Invalid spare_id" }, { status: 400 });
      }
    } else if (spareNumberParam) {
      const [rows] = await db.execute(`SELECT id FROM spare_list WHERE spare_number = ? LIMIT 1`, [spareNumberParam]);
      if (rows.length === 0) return NextResponse.json({ total: 0, delhi: 0, south: 0 });
      spare_id = rows[0].id;
    } else {
      return NextResponse.json({ error: "spare_id or spare_number is required" }, { status: 400 });
    }

    const [summary] = await db.execute(
      `SELECT total_quantity as total, Delhi as delhi, South as south FROM stock_summary WHERE spare_id = ? LIMIT 1`,
      [spare_id]
    );

    if (summary.length === 0) return NextResponse.json({ total: 0, delhi: 0, south: 0 });

    return NextResponse.json(summary[0]);
  } catch (e) {
    console.error("spare/availability GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
