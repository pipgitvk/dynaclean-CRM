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

    if (!product_code) {
      return NextResponse.json({ error: "Product code is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Fetch transfer history for the specific product
    const [transferHistory] = await conn.execute(
      `SELECT 
        product_code,
        quantity,
        stock_status,
        godown,
        note,
        added_by,
        added_date,
        total,
        delhi,
        south
      FROM product_stock 
      WHERE product_code = ? AND stock_status = 'TRANSFER'
      ORDER BY added_date DESC`,
      [product_code]
    );

    return NextResponse.json({
      success: true,
      data: transferHistory
    });

  } catch (error) {
    console.error("Error fetching transfer history:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
