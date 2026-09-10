import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const product_code = searchParams.get("product_code");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!product_code) {
      return NextResponse.json({ error: "product_code is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Ensure table exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS product_stock_edit_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_code VARCHAR(100) NOT NULL,
        item_name VARCHAR(255),
        edited_by VARCHAR(100) NOT NULL,
        old_delhi INT,
        new_delhi INT,
        old_south INT,
        new_south INT,
        old_min_qty INT,
        new_min_qty INT,
        old_max_qty INT,
        new_max_qty INT,
        change_description TEXT,
        edited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_product_code (product_code),
        INDEX idx_edited_by (edited_by),
        INDEX idx_edited_at (edited_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Fetch history records
    const [history] = await conn.execute(
      `SELECT 
        id, product_code, item_name, edited_by, 
        old_delhi, new_delhi, old_south, new_south, 
        old_min_qty, new_min_qty, old_max_qty, new_max_qty,
        change_description, edited_at, created_at
       FROM product_stock_edit_history 
       WHERE product_code = ?
       ORDER BY edited_at DESC
       LIMIT ? OFFSET ?`,
      [product_code, limit, offset]
    );

    // Get total count
    const [countResult] = await conn.execute(
      `SELECT COUNT(*) as total FROM product_stock_edit_history WHERE product_code = ?`,
      [product_code]
    );

    return NextResponse.json({
      success: true,
      history,
      total: countResult[0]?.total || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error("Stock edit history fetch error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
