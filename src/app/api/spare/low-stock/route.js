import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDbConnection();

    // Low stock: total_quantity <= min_qty (and min_qty > 0)
    const [lowStockRows] = await db.execute(`
      SELECT
        ss.spare_id,
        spl.spare_number,
        spl.item_name,
        spl.min_qty,
        spl.image AS spare_image,
        ss.total_quantity,
        ss.Delhi  AS delhi,
        ss.South  AS south,
        ss.updated_at
      FROM stock_summary ss
      LEFT JOIN spare_list spl ON ss.spare_id = spl.id
      WHERE ss.total_quantity <= spl.min_qty
        AND spl.min_qty > 0
      ORDER BY ss.total_quantity ASC
    `);

    // Zero stock: total_quantity = 0 (or negative, treated as 0)
    const [zeroStockRows] = await db.execute(`
      SELECT
        ss.spare_id,
        spl.spare_number,
        spl.item_name,
        spl.min_qty,
        spl.image AS spare_image,
        ss.total_quantity,
        ss.Delhi  AS delhi,
        ss.South  AS south,
        ss.updated_at
      FROM stock_summary ss
      LEFT JOIN spare_list spl ON ss.spare_id = spl.id
      WHERE ss.total_quantity <= 0
      ORDER BY spl.item_name ASC
    `);

    return NextResponse.json({
      lowStock: lowStockRows,
      zeroStock: zeroStockRows,
      lowStockCount: lowStockRows.length,
      zeroStockCount: zeroStockRows.length,
    });
  } catch (error) {
    console.error("Failed to fetch low/zero stock for spares:", error);
    return NextResponse.json({ error: "Failed to fetch stock alerts" }, { status: 500 });
  }
}
