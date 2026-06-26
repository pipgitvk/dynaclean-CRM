import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDbConnection();

    // Low stock: total_quantity <= min_qty (and min_qty > 0)
    const [lowStockRows] = await db.execute(`
      SELECT
        pss.product_code,
        pl.item_name,
        pl.product_number,
        pl.min_qty,
        pl.product_image,
        pss.total_quantity,
        pss.Delhi  AS delhi,
        pss.South  AS south,
        pss.updated_at
      FROM product_stock_summary pss
      LEFT JOIN products_list pl ON pss.product_code = pl.item_code
      WHERE pss.total_quantity <= pl.min_qty
        AND pl.min_qty > 0
      ORDER BY pss.total_quantity ASC
    `);

    // Zero stock: total_quantity = 0  (or negative, treated as 0)
    const [zeroStockRows] = await db.execute(`
      SELECT
        pss.product_code,
        pl.item_name,
        pl.product_number,
        pl.min_qty,
        pl.product_image,
        pss.total_quantity,
        pss.Delhi  AS delhi,
        pss.South  AS south,
        pss.updated_at
      FROM product_stock_summary pss
      LEFT JOIN products_list pl ON pss.product_code = pl.item_code
      WHERE pss.total_quantity <= 0
      ORDER BY pl.item_name ASC
    `);

    return NextResponse.json({
      lowStock: lowStockRows,
      zeroStock: zeroStockRows,
      lowStockCount: lowStockRows.length,
      zeroStockCount: zeroStockRows.length,
    });
  } catch (error) {
    console.error("Failed to fetch low/zero stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock alerts" }, { status: 500 });
  }
}
